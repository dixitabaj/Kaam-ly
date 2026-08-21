import { useEffect } from "react";
import { useToast } from "./ToastContext";

const makeToast = (event, taskName, extra) => {
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
    new_message:      { color: "#0891b2", message: `${extra?.senderName || "Someone"}: ${extra?.preview || "sent you a message"}` },
    offer:            { color: "#7c3aed", message: `${extra?.senderName || "Someone"} sent you a service offer for ${label}.` },
    offer_accepted:   { color: "#059669", message: `${extra?.senderName || "Someone"} accepted your offer for ${label}.` },
    offer_rejected:   { color: "#dc2626", message: `${extra?.senderName || "Someone"} rejected your offer for ${label}.` },
  };
  return map[event] || null;
};
  

const GlobalTaskListener = () => {
  const { addToast } = useToast();

  useEffect(() => {
    let pollTimer  = null;
    let retryTimer = null;
    let pingTimer  = null;
    let ws         = null;
    let active     = true;
    let started    = false;

    const handleMessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data.type === "ping" || data.type === "pong") return;

    let type     = data.type === "task_status" ? data.status : data.type;
    let taskName = data.taskName;
    let extra    = { senderName: data.senderName, preview: data.preview };

    if (data.type === "new_message" && data.preview) {
      // preview may be truncated so we just check the start
      const raw = data.preview.trim();
      if (raw.includes('"type":"offer_accepted"') || raw.includes('"type": "offer_accepted"'))
        extra.preview = "accepted your offer";
      else if (raw.includes('"type":"offer_rejected"') || raw.includes('"type": "offer_rejected"'))
        extra.preview = "rejected your offer";
      else if (raw.includes('"type":"offer"') || raw.includes('"type": "offer"'))
        extra.preview = "sent you a service offer";
      else if (raw.includes('"type":"media"') || raw.includes('"type": "media"')) {
        if (raw.includes("image/"))      extra.preview = "📷 sent a photo";
        else if (raw.includes("video/")) extra.preview = "🎥 sent a video";
        else if (raw.includes("audio/")) extra.preview = "🎤 sent a voice message";
        else                             extra.preview = "📎 sent a file";
      }
    }

    const toast = makeToast(type, taskName, extra);
    if (toast) addToast(toast);
  } catch {}
};

    const connect = (userId, retryDelay = 1000) => {
      if (!active) return;

      ws = new WebSocket(`ws://127.0.0.1:8000/ws/task-updates/${userId}`);

      ws.onopen = () => {
        // flush missed notifications
        fetch(`http://127.0.0.1:8000/api/notifications/pending/${userId}`)
          .then(r => r.json())
          .then(({ messages = [] }) => {
            messages.forEach(msg => {
              const toast = makeToast(
                msg.type === "task_status" ? msg.status : msg.type,
                msg.taskName
              );
              if (toast) addToast(toast);
            });
          })
          .catch(() => {});

        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: "ping" }));
        }, 25000);
      };

      ws.onmessage = handleMessage;
      ws.onerror   = () => {};
      ws.onclose   = () => {
        clearInterval(pingTimer);
        if (!active) return;
        const nextDelay = Math.min(retryDelay * 2, 30000);
        retryTimer = setTimeout(() => connect(userId, nextDelay), retryDelay);
      };
    };

    const tryConnect = () => {
      if (!active) return;

      const storedUser  = localStorage.getItem("user") || sessionStorage.getItem("user");
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      const userId      = currentUser?.id || currentUser?._id;

      if (!userId) {
        pollTimer = setTimeout(tryConnect, 2000);
        return;
      }

      if (started) return;
      started = true;
      connect(userId);
    };

    tryConnect();

    return () => {
      active = false;
      clearTimeout(pollTimer);
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      ws?.close();
    };
  }, [addToast]);

  return null;
};

export default GlobalTaskListener;