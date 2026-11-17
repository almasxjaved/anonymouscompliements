
const admin = require("firebase-admin");

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verify the Firebase user's identity.
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authorization.split("Bearer ")[1];
    await admin.auth().verifyIdToken(idToken);

    const { complimentId } = req.body || {};

    if (
      typeof complimentId !== "string" ||
      complimentId.length === 0 ||
      complimentId.length > 150
    ) {
      return res.status(400).json({ error: "Invalid compliment ID" });
    }

    // Get the compliment directly from Firestore.
    const complimentRef = db.collection("compliments").doc(complimentId);
    const complimentSnap = await complimentRef.get();

    if (!complimentSnap.exists) {
      return res.status(404).json({ error: "Compliment not found" });
    }

    const compliment = complimentSnap.data();

    if (
      typeof compliment.recipient !== "string" ||
      typeof compliment.message !== "string" ||
      compliment.message.length === 0 ||
      compliment.message.length > 300 ||
      typeof compliment.createdAt !== "number"
    ) {
      return res.status(400).json({ error: "Invalid compliment data" });
    }

    // Only accept recently created compliments.
    const age = Date.now() - compliment.createdAt;

    if (age < -60000 || age > 10 * 60 * 1000) {
      return res.status(400).json({ error: "Compliment is not recent" });
    }

    // Prevent the same compliment from triggering notifications twice.
    const notificationRef = db
      .collection("notifiedCompliments")
      .doc(complimentId);

    const claim = await db.runTransaction(async (transaction) => {
      const notificationSnap = await transaction.get(notificationRef);

      if (notificationSnap.exists) {
        const previous = notificationSnap.data();

        if (previous.status === "sent") {
          return "already-sent";
        }

        if (
          previous.status === "processing" &&
          Date.now() - previous.startedAt < 2 * 60 * 1000
        ) {
          return "processing";
        }
      }

      transaction.set(notificationRef, {
        status: "processing",
        startedAt: Date.now(),
      });

      return "claimed";
    });

    if (claim === "already-sent") {
      return res.status(200).json({ message: "Already notified" });
    }

    if (claim === "processing") {
      return res.status(202).json({ message: "Notification is processing" });
    }

    // Read all visitors who enabled notifications.
    const tokensSnap = await db.collection("pushTokens").get();

    const tokenDocuments = tokensSnap.docs.filter((doc) => {
      const token = doc.data().token;
      return typeof token === "string" && token.length > 0;
    });

    const tokens = tokenDocuments.map((doc) => doc.data().token);

    if (tokens.length === 0) {
      await notificationRef.update({
        status: "sent",
        sentAt: Date.now(),
        recipientCount: 0,
      });

      return res.status(200).json({
        message: "No notification subscribers yet",
      });
    }

    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "Someone sent a little hype! 💖",
        body: `${compliment.recipient}: ${compliment.message}`,
      },
      data: {
        complimentId,
      },
      webpush: {
        notification: {
          title: "Someone sent a little hype! 💖",
          body: `${compliment.recipient}: ${compliment.message}`,
        },
      },
    });

    // Remove tokens that are no longer registered with FCM.
    const invalidTokenCodes = [
      "messaging/invalid-registration-token",
      "messaging/registration-token-not-registered",
    ];

    const deletePromises = [];

    result.responses.forEach((response, index) => {
      if (
        !response.success &&
        invalidTokenCodes.includes(response.error?.code)
      ) {
        deletePromises.push(tokenDocuments[index].ref.delete());
      }
    });

    await Promise.all(deletePromises);

    await notificationRef.update({
      status: "sent",
      sentAt: Date.now(),
      recipientCount: result.successCount,
      failureCount: result.failureCount,
    });

    return res.status(200).json({
      message: "Notifications processed",
      sent: result.successCount,
      failed: result.failureCount,
    });
  } catch (error) {
    console.error("Notification API error:", error);

    return res.status(500).json({
      error: "Could not process notifications",
    });
  }
};
