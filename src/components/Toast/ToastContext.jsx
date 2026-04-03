// src/context/ToastContext.jsx
import React, { createContext, useContext, useState, useCallback } from "react";
import { X } from "lucide-react";

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, ...toast }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 10000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(p => p.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}

      {/* Global toast container — always mounted */}
      <div style={{
        position: "fixed", top: "80px", right: "20px", zIndex: 9999,
        display: "flex", flexDirection: "column", gap: "10px",
        alignItems: "flex-end", pointerEvents: "none",
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            pointerEvents: "auto", position: "relative",
            display: "flex", alignItems: "center", gap: "12px",
            padding: "12px 16px", borderRadius: "12px",
            minWidth: "260px", maxWidth: "340px",
            background: "white", border: "1px solid #e8e0d4", color: "#1c1008",
            fontSize: "13px", fontWeight: "600",
            boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
            animation: "toastIn 0.3s ease", overflow: "hidden",
          }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: t.color, flexShrink: 0 }}/>
            <div style={{ flex: 1, lineHeight: "1.5" }}>{t.message}</div>
            <button onClick={() => removeToast(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#a8a29e", display: "flex" }}>
              <X size={13}/>
            </button>
            <div style={{ position: "absolute", bottom: 0, left: 0, height: "2px", width: "100%", background: "#f5efe6" }}>
              <div style={{ height: "100%", background: t.color, opacity: 0.6, animation: "toastBar 10s linear forwards" }}/>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes toastIn  { from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)} }
        @keyframes toastBar { from{width:100%}to{width:0%} }
      `}</style>
    </ToastContext.Provider>
  );
};