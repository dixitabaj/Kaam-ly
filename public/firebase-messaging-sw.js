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

// ── 1. Push listener ──────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  // ── Safely parse payload — handles both real FCM JSON and DevTools plain text
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    // DevTools sends plain text — treat it as a simple notification
    payload = {
      notification: {
        title: "Kaam-ly",
        body:  event.data.text() || "You have a new update.",
      },
    };
  }

  const title     = payload.notification?.title || payload.data?.title || "Kaam-ly";
  const body      = payload.notification?.body  || payload.data?.body  || "You have a new update.";
  const eventType = payload.data?.event_type || "";
  const taskId    = payload.data?.task_id    || "";
  const link      = payload.fcm_options?.link || payload.data?.click_action || "/";

  // Action buttons based on event type
  let actions = [];
  if (eventType === "task_confirmed" && taskId) {
    actions = [
      { action: "start_work", title: "▶ Start Work" },
      { action: "view",       title: "View Details"  },
    ];
  } else if (eventType === "task_in_progress" && taskId) {
    actions = [
      { action: "complete", title: "✓ Mark Complete" },
      { action: "view",     title: "View Details"    },
    ];
  }

  console.log("[SW] Showing notification:", title, body, eventType || "(no event type)");

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:     "/icon-192.png",
      badge:    "/icon-192.png",
      vibrate:  [200, 100, 200],
      tag:      `${eventType}-${taskId}` || "kaamly",
      renotify: true,
      actions,
      data:     { url: link, taskId, eventType },
    })
  );
});

// ── 2. Firebase background handler (fallback) ─────────────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] onBackgroundMessage:", payload);
  // Display already handled by push listener above
});

// ── 3. Notification click handler ─────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  const { action }                 = event;
  const { url, taskId, eventType } = event.notification.data || {};

  event.notification.close();

  // "▶ Start Work"
  if (action === "start_work" && taskId) {
    event.waitUntil(
      fetch(`${API_BASE}/api/tasks/${taskId}/start-from-notification`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ source: "notification_action" }),
      })
        .then(r => r.json())
        .then(data =>
          self.registration.showNotification(
            data.success ? "Work Started ▶" : "Could Not Start",
            { body: data.message, icon: "/icon-192.png", tag: "action-result", data: { url: "/worker/requests" } }
          )
        )
        .catch(() =>
          self.registration.showNotification("Error", {
            body: "Could not start the task. Please open the app.",
            icon: "/icon-192.png", tag: "action-error", data: { url: "/worker/requests" },
          })
        )
    );
    return;
  }

  // "✓ Mark Complete"
  if (action === "complete" && taskId) {
    event.waitUntil(
      fetch(`${API_BASE}/api/tasks/${taskId}/complete-from-notification`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ source: "notification_action" }),
      })
        .then(r => r.json())
        .then(data =>
          self.registration.showNotification(
            data.success ? "Task Completed ✓" : "Could Not Complete",
            { body: data.message, icon: "/icon-192.png", tag: "action-result", data: { url: "/worker/requests" } }
          )
        )
        .catch(() =>
          self.registration.showNotification("Error", {
            body: "Could not complete the task. Please open the app.",
            icon: "/icon-192.png", tag: "action-error", data: { url: "/worker/requests" },
          })
        )
    );
    return;
  }

  // Plain tap or "View Details" → open/focus the app
  const targetUrl = url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      for (const client of all) {
        if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── Force immediate activation ────────────────────────────────────────────────
self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));