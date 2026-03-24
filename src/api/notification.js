// src/api/notification.js
import { getToken, onMessage } from "firebase/messaging";
import { initMessaging }       from "./firebase";


// ─── 1. Request Permission & Get FCM Token ────────────────────────────────────
export const requestNotificationPermission = async () => {
  try {
    // Register SW + init messaging first (the critical fix for Vite)
    const messaging = await initMessaging();
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[FCM] Permission denied");
      return null;
    }

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) {
      console.warn("[FCM] No token returned — check VAPID key");
      return null;
    }

    console.log("[FCM] Token obtained ✓", token.slice(0, 20) + "...");
    return token;
  } catch (err) {
    console.error("[FCM] Error getting token:", err);
    return null;
  }
};

// ─── 2. Foreground Message Listener ──────────────────────────────────────────
export const listenForMessages = async (onMessageCallback) => {
  const messaging = await initMessaging();
  if (!messaging) return () => {};

  const unsubscribe = onMessage(messaging, (payload) => {
    console.log("[FCM] Foreground message:", payload);
    if (onMessageCallback) onMessageCallback(payload);
  });

  return unsubscribe; // call this to clean up
};

// ─── 3. Internal trigger helper ───────────────────────────────────────────────
const sendNotificationTrigger = async (payload) => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/send`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) console.error("[FCM] Trigger failed:", await res.text());
    return res.ok;
  } catch (err) {
    console.error("[FCM] Trigger error:", err);
    return false;
  }
};

// ─── 4. Event triggers ────────────────────────────────────────────────────────

export const notifyTaskAssigned = (workerEmail, taskName) =>
  sendNotificationTrigger({
    recipient_email: workerEmail,
    title:           "New Task Assigned 🔔",
    body:            `You've been assigned "${taskName}". Tap to review.`,
    click_action:    "/worker/requests",
    event_type:      "task_assigned",
  });

// Sends "▶ Start Work" action button to worker
export const notifyTaskConfirmedWorker = (workerEmail, taskName, taskId) =>
  sendNotificationTrigger({
    recipient_email: workerEmail,
    title:           "Payment Secured — Start When Ready",
    body:            `Payment for "${taskName}" is held. Tap to start work.`,
    click_action:    "/worker/requests",
    event_type:      "task_confirmed",
    task_id:         taskId,
  });

// Sends "✓ Mark Complete" action button to worker
export const notifyTaskInProgressWorker = (workerEmail, taskName, taskId) =>
  sendNotificationTrigger({
    recipient_email: workerEmail,
    title:           "Task In Progress",
    body:            `You started "${taskName}". Tap to mark complete when done.`,
    click_action:    "/worker/requests",
    event_type:      "task_in_progress",
    task_id:         taskId,
  });

export const notifyTaskStarted = (customerEmail, taskName) =>
  sendNotificationTrigger({
    recipient_email: customerEmail,
    title:           "Task Started ▶",
    body:            `Your worker has started "${taskName}".`,
    click_action:    "/tasks",
    event_type:      "task_started",
  });

export const notifyTaskCompleted = (customerEmail, taskName, taskId) =>
  sendNotificationTrigger({
    recipient_email: customerEmail,
    title:           "Task Completed ✓",
    body:            `"${taskName}" is done. Please review and release payment.`,
    click_action:    "/tasks",
    event_type:      "task_completed",
    task_id:         taskId,
  });

export const notifyPaymentReleased = (workerEmail, taskName, amount) =>
  sendNotificationTrigger({
    recipient_email: workerEmail,
    title:           "Payment Released 🎉",
    body:            `Rs. ${amount} for "${taskName}" has been sent to your eSewa.`,
    click_action:    "/worker/earnings",
    event_type:      "payment_released",
  });

export const notifyQuoteSet = (customerEmail, taskName, price, hours) =>
  sendNotificationTrigger({
    recipient_email: customerEmail,
    title:           "Quote Ready",
    body:            `"${taskName}": Rs. ${price} · Est. ${hours} hrs. Tap to confirm.`,
    click_action:    "/tasks",
    event_type:      "quote_set",
  });

export const notifySystemAlert = (recipientEmail, title, body, link = "/") =>
  sendNotificationTrigger({
    recipient_email: recipientEmail,
    title,
    body,
    click_action:    link,
    event_type:      "system_alert",
  });