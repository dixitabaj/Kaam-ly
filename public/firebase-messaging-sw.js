// public/firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyD4MNdeLF9QnorEeHPzfZ5Y4Zmhl7HPh8M",
  authDomain:        "kaam-ly.firebaseapp.com",
  projectId:         "kaam-ly",
  storageBucket:     "kaam-ly.firebasestorage.app",
  messagingSenderId: "983636611425",
  appId:             "1:983636611425:web:c66dfc1a19af0242b9f520",
});

const messaging = firebase.messaging();
const API_BASE  = "http://localhost:8000";

// ── 1. Push listener (handles background notifications) ───────────────────────
// public/firebase-messaging-sw.js
// firebase-messaging-sw.js
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background message:", payload);

  // Debug: check how many clients are found
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    console.log("[SW] Found clients:", clients.length);
    clients.forEach((client) => {
      console.log("[SW] Posting to client:", client.url);
      client.postMessage({ type: "fcm-background", payload });
    });
  });

  const title = payload.notification?.title || payload.data?.title || "Kaam-ly";
  const body  = payload.notification?.body  || payload.data?.body  || "";

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data || {},
  });
});

// ── 2. Notification click handler ────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  const { action }                 = event;
  const { url, taskId, eventType } = event.notification.data || {};
  event.notification.close();

  const handleAction = async () => {
    try {
      if (action === "start_work" && taskId) {
        const res = await fetch(`${API_BASE}/api/tasks/${taskId}/start-from-notification`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ source: "notification_action" }),
        });
        const data = await res.json();
        return self.registration.showNotification(
          data.success ? "Work Started ▶" : "Could Not Start",
          { body: data.message, icon: "/icon-192.png", tag: "action-result", data: { url: "/worker/requests" } }
        );
      }

      if (action === "complete" && taskId) {
        const res = await fetch(`${API_BASE}/api/tasks/${taskId}/complete-from-notification`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ source: "notification_action" }),
        });
        const data = await res.json();
        return self.registration.showNotification(
          data.success ? "Task Completed ✓" : "Could Not Complete",
          { body: data.message, icon: "/icon-192.png", tag: "action-result", data: { url: "/worker/requests" } }
        );
      }

      // Default: open/focus the app
      const clientsList = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url || "/");

    } catch (err) {
      console.error("[SW] Click action failed:", err);
    }
  };

  event.waitUntil(handleAction());
});

// ── 3. Force immediate activation ───────────────────────────────────────────
self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));