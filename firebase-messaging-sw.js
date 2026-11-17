
importScripts(
  "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyDRCOFT07ltPHhfSOTuPEAMIU-Az6cxOQU",
  authDomain: "anonymous-compliment-model.firebaseapp.com",
  projectId: "anonymous-compliment-model",
  storageBucket: "anonymous-compliment-model.firebasestorage.app",
  messagingSenderId: "1092525262550",
  appId: "1:1092525262550:web:2d0c854968d7898bab2b77",
  measurementId: "G-MS8NB2JBSN"
});

const messaging = firebase.messaging();

// Handle background messages.
// FCM displays notification payloads automatically.
messaging.onBackgroundMessage((payload) => {
  console.log("Background compliment notification received:", payload);
});

// Open or focus the website when a notification is clicked.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = self.location.origin + "/";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          return client.focus();
        }
      }

      return clients.openWindow(targetUrl);
    })
  );
});
