# Push notifications setup for Secret Hype Hub

This package adds opt-in browser push notifications to the existing Firebase + Vercel site.
Every subscribed browser receives a notification whenever a document is created in `compliments`.

## Files

- `index.html` — updated existing site, with an Enable Alerts button and FCM token registration.
- `firebase-messaging-sw.js` — required root-level service worker for background push.
- `functions/index.js` — Firestore-triggered Cloud Function that sends the push to every saved token.
- `functions/package.json`, `firebase.json` — Cloud Functions deployment configuration.
- `firestore-rules-snippet.txt` — secure rules to merge into the existing Firestore rules.

## 1. Generate the Web Push key

1. Open Firebase Console for project `anonymous-compliment-model`.
2. Go to Project settings → Cloud Messaging → Web configuration → Web Push certificates.
3. Generate a key pair if one does not already exist.
4. Copy the **public** key (never put the private key in the website).
5. In `index.html`, replace `PASTE_YOUR_PUBLIC_VAPID_KEY_HERE` with that public key.

## 2. Add the files to your Vercel project

Copy the updated `index.html` and `firebase-messaging-sw.js` into the root of the same project (the folder Vercel deploys). The service worker must be available at:

`https://YOUR-VERCEL-DOMAIN/firebase-messaging-sw.js`

Keep the site on HTTPS (Vercel provides HTTPS).

## 3. Update Firestore rules

In Firebase Console → Firestore Database → Rules, add the contents of `firestore-rules-snippet.txt` inside the existing `match /databases/{database}/documents` block. Do not replace your existing `/compliments` rules with this snippet. Publish the rules.

The `pushTokens` collection stores one token document per anonymous Firebase UID. Client reads are denied; the Cloud Function uses the Admin SDK and can read the collection.

## 4. Configure the Cloud Function

Cloud Functions deployment requires the Firebase project to use the Blaze (pay-as-you-go) plan and a linked billing account. Firebase Cloud Messaging itself is no-cost, but other Google Cloud resources can incur charges. Set a budget alert in Google Cloud Billing.

Install Node.js 20 and Firebase CLI, then run these commands from this folder:

```bash
npm install -g firebase-tools
firebase login
firebase use anonymous-compliment-model
cd functions
npm install
cd ..
firebase deploy --only functions
```

When deployment asks for `SITE_URL`, enter your exact Vercel HTTPS URL, for example `https://your-project.vercel.app` (no trailing slash). If prompted for the parameter at deploy time, use that exact URL.

If you prefer to configure it before deploying, create `functions/.env.anonymous-compliment-model` containing:

```env
SITE_URL=https://your-project.vercel.app
```

Do not commit any private service-account key. The deployed Cloud Function uses its built-in service identity.

## 5. Deploy the website

Commit/push the updated root `index.html` and `firebase-messaging-sw.js` to the GitHub branch connected to Vercel, or deploy the same files through your usual Vercel workflow.

## 6. Test it

1. Open the deployed HTTPS Vercel URL in Chrome or Edge.
2. Click **Enable Alerts** and allow notifications.
3. Repeat on a second browser/device to subscribe another visitor.
4. Post a new compliment from any browser.
5. Both subscribed browsers should receive the push. Test once with the website tab open and once with it closed/backgrounded.

A visitor who only opens the link but does not grant notification permission will not receive pushes. Each browser/device must opt in separately. If a visitor clears browser data or revokes permission, they may need to subscribe again.

## Important

- This does not send a push for old compliments; only new Firestore document creations trigger it.
- The notification text is generic and does not expose the compliment message or recipient on the lock screen.
- A foreground visitor sees a browser notification and an in-page toast.
- Background/closed-tab delivery depends on the browser and operating system supporting Web Push and allowing background notifications.
