import { initializeApp }                       from "firebase/app";
import { getAuth }                             from "firebase/auth";
import { getFirestore }                        from "firebase/firestore";
// firebase.js — top of file
import { getMessaging, isSupported, getToken, onMessage } from "firebase/messaging";


const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

let _messaging = null;
let _swReg     = null;
let _listenerRegistered = false;

export const initMessaging = async () => {
  if (_messaging) return _messaging; // ✅ already initialized, reuse

  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  if (!("serviceWorker" in navigator)) return null;

  try {
    // ✅ Reuse existing SW registration if already registered
    const existingRegs = await navigator.serviceWorker.getRegistrations();
    _swReg = existingRegs.find(r => r.active?.scriptURL.includes("firebase-messaging-sw.js"));

    if (!_swReg) {
      _swReg = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/" }
      );
      console.log("[FCM] SW registered ✓ scope:", _swReg.scope);
    } else {
      console.log("[FCM] SW reused ✓ scope:", _swReg.scope);
    }

    await navigator.serviceWorker.ready;
    console.log("[FCM] SW ready ✓");

    _messaging = getMessaging(app);
    console.log("[FCM] Messaging initialized ✓");
    return _messaging;

  } catch (err) {
    console.error("[FCM] Init failed:", err);
    return null;
  }
};

export const initForegroundListener = async () => {
  if (_listenerRegistered) return;

  const messaging = await initMessaging();
  if (!messaging) return;

  _listenerRegistered = true;

  onMessage(messaging, (payload) => {
    console.log("[FCM] ✅ Foreground message caught:", payload);
    // Dispatch event so Notification.jsx can pick it up
    window.dispatchEvent(new CustomEvent("fcm-message", { detail: payload }));
  });

  console.log("[FCM] Foreground listener registered ✓");
};

export default app;