/*
 * Zelos push notifications (Firebase Cloud Messaging service worker).
 * Lives at the site root so it can receive notifications for every page.
 * The server (functions/main.py, alert_push) sends a Web Push notification with
 * a title, body, image and link; Firebase shows it, and tapping it opens the link.
 */
self.window = self;
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
importScripts('firebase-config.js');
firebase.initializeApp(self.ZELOS_FIREBASE_CONFIG);
firebase.messaging();

// Open (or focus) the alert when a notification is tapped, if the browser didn't already.
self.addEventListener('notificationclick', function (event) {
  var link = (event.notification.data && (event.notification.data.link || (event.notification.data.FCM_MSG && event.notification.data.FCM_MSG.data && event.notification.data.FCM_MSG.data.link))) || '/dashboard.html';
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if (list[i].url === link && 'focus' in list[i]) return list[i].focus(); }
    return clients.openWindow(link);
  }));
});
