// src/context/GlobalTaskListener.jsx
import { useEffect } from "react";
import { useToast } from "./ToastContext";

const makeToast = (event, taskName) => {
  const label = taskName ? `"${taskName}"` : "A task";
  const map = {
    new_task:         { color: "#f59e0b", message: `New request: ${label} has been assigned to you.` },
    confirmed:        { color: "#059669", message: `${label} has been confirmed.` },
    in_progress:      { color: "#2563eb", message: `${label} is now in progress.` },
    completed:        { color: "#065f46", message: `${label} has been marked as completed.` },
    declined:         { color: "#dc2626", message: `${label} was declined.` },
    cancelled:        { color: "#991b1b", message: `${label} was cancelled.` },
    accepted:         { color: "#b45309", message: `${label} has been accepted.` },
    payment_reminder: { color: "#c2410c", message: `⏰ 1 hour left to pay for ${label}!` },
    task_created:     { color: "#6d28d9", message: `${label} has been created successfully.` },
  };
  return map[event] || null;
};

const GlobalTaskListener = () => {
  const { addToast } = useToast();

  useEffect(() => {
    const storedUser  = localStorage.getItem("user") || sessionStorage.getItem("user");
    const currentUser = storedUser ? JSON.parse(storedUser) : null;
    const userId      = currentUser?.id || currentUser?._id;
    if (!userId) return;

    let ws         = null;
    let retryDelay = 1000;
    let retryTimer = null;
    let pingTimer  = null;
    let active     = true;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ping" || data.type === "pong") return;

        const toast = makeToast(data.type === "task_status" ? data.status : data.type, data.taskName);
        if (toast) addToast(toast);
      } catch {}
    };

    const connect = () => {
      if (!active) return;
      ws = new WebSocket(`ws://127.0.0.1:8000/ws/task-updates/${userId}`);

      ws.onopen = () => {
        retryDelay = 1000;
        pingTimer  = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: "ping" }));
        }, 25000);
      };

      ws.onmessage = handleMessage;
      ws.onerror   = () => {};
      ws.onclose   = () => {
        clearInterval(pingTimer);
        if (!active) return;
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30000);
          connect();
        }, retryDelay);
      };
    };

    connect();

    // FCM foreground listener
    let unsubFCM = () => {};
    const setupFCM = async () => {
      try {
        const { initMessaging } = await import("../../api/notification");
        const { onMessage }     = await import("firebase/messaging");
        const messaging = await initMessaging();
        if (!messaging) return;
        unsubFCM = onMessage(messaging, (payload) => {
          const eventType = payload.data?.event_type || "new_task";
          const taskName  = payload.data?.taskName || payload.notification?.title || null;
          const toast     = makeToast(eventType, taskName);
          if (toast) addToast(toast);
        });
      } catch {}
    };
    setupFCM();

    return () => {
      active = false;
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      ws?.close();
      unsubFCM();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null; // renders nothing
};

export default GlobalTaskListener;