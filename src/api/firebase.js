// src/firebase.js
// ✅ Correct JS syntax
// src/api/firebase.js
// Import the functions you need from the Firebase SDK
// src/api/firebase.js
// Firebase SDK initialization — single source of truth for the whole app.
// All other files should import { messaging, auth, db } from here.

// src/api/firebase.js
import { initializeApp }             from "firebase/app";
import { getAuth }                   from "firebase/auth";
import { getFirestore }              from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";



const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── messaging is NOT exported directly ────────────────────────────────────────
// Always call initMessaging() first — it registers the SW, then returns
// the messaging instance bound to it. Without this Vite never registers
// the service worker and FCM has nowhere to deliver pushes.

let _messaging = null;

export const initMessaging = async () => {
  if (_messaging) return _messaging;

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    console.warn("[FCM] Not supported in this browser");
    return null;
  }

  if (!("serviceWorker" in navigator)) {
    console.warn("[FCM] Service workers not available");
    return null;
  }

  try {
    // Explicitly register the SW — Vite does NOT do this automatically
    const reg = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );
    console.log("[FCM] SW registered ✓ scope:", reg.scope);

    // Wait until fully active before getting messaging
    await navigator.serviceWorker.ready;
    console.log("[FCM] SW ready ✓");

    _messaging = getMessaging(app);
    console.log("[FCM] Messaging initialized ✓");
    return _messaging;
  } catch (err) {
    console.error("[FCM] SW registration failed:", err);
    return null;
  }
};

export default app;
