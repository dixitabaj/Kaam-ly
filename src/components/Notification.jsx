import { useEffect, useRef, useState } from "react";
import { requestNotificationPermission } from "../api/notification";
import { initForegroundListener } from "../api/firebase";

const API_BASE = "http://127.0.0.1:8000";

const Toast = ({ title, body, onClose }) => {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("open-notif-panel"));
    onClose();
  };
  return (
    <div onClick={handleClick} style={{
      position:"fixed", top:"90px", right:"20px", zIndex:9999,
      background:"white", border:"1px solid #e8dfd0", borderRadius:"14px",
      padding:"14px 18px", maxWidth:"320px",
      boxShadow:"0 10px 25px rgba(0,0,0,0.10)",
      display:"flex", alignItems:"flex-start", gap:"12px",
      animation:"toastSlide 0.3s ease", cursor:"pointer",
    }}>
      <div style={{ width:10, height:10, borderRadius:"50%", background:"#f6a623", marginTop:4, flexShrink:0 }}/>
      <div style={{ flex:1 }}>
        {title && <div style={{ fontWeight:700, fontSize:14, color:"#1c1008", marginBottom:2 }}>{title}</div>}
        {body  && <div style={{ fontSize:13, color:"#57534e" }}>{body}</div>}
      </div>
      <button onClick={e=>{ e.stopPropagation(); onClose(); }}
        style={{ background:"none", border:"none", cursor:"pointer", color:"#a8a29e", fontSize:18, lineHeight:1, padding:0 }}>×</button>
      <style>{`@keyframes toastSlide { from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)} }`}</style>
    </div>
  );
};

function Notification() {
  console.log("🔔 Notification component mounted");
  const initialized = useRef(false);
  const [toast, setToast] = useState(null);

  const showToast = (title, body) => {
    setToast({ title, body });
    setTimeout(() => setToast(null), 8000);
  };
  
  // ✅ Listen for foreground FCM messages
  useEffect(() => {
    const handler = (e) => {
      console.log("🔔 fcm-message event received:", e.detail);
      const payload = e.detail;
      const title = payload?.notification?.title || payload?.data?.title || "Kaam-ly";
      const body  = payload?.notification?.body  || payload?.data?.body  || "";
      showToast(title, body);
    };
    window.addEventListener("fcm-message", handler);
    return () => window.removeEventListener("fcm-message", handler);
  }, []);

  // ✅ Save token to backend after login
  useEffect(() => {
    const init = async () => {
      const stored      = localStorage.getItem("user") || sessionStorage.getItem("user");
      const currentUser = stored ? JSON.parse(stored) : null;
      const userId      = currentUser?.email || currentUser?.id || currentUser?._id;
      if (!userId) return;

      if (initialized.current) return;
      initialized.current = true;

      const token = await requestNotificationPermission();
      if (!token) return;

      try {
        const res  = await fetch(`${API_BASE}/api/notifications/save-token`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ userId, token }),
        });
        const data = await res.json();
        console.log("[FCM] Token saved:", data);
      } catch (err) {
        console.error("[FCM] Token save failed:", err);
      }

      await initForegroundListener();
    };

    init();
    window.addEventListener("storage", init);
    return () => window.removeEventListener("storage", init);
  }, []);

  if (!toast) return null;
  return <Toast title={toast.title} body={toast.body} onClose={() => setToast(null)} />;
}

export default Notification;