import { initializeApp }                    from "firebase/app";
import { getAuth }                          from "firebase/auth";
import { getFirestore }                     from "firebase/firestore";
import { getMessaging, isSupported, getToken } from "firebase/messaging";

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

export const initMessaging = async () => {
  if (_messaging) return _messaging;

  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  if (!("serviceWorker" in navigator)) return null;

  try {
    //  Unregister any conflicting SWs first
    const existingRegs = await navigator.serviceWorker.getRegistrations();
    for (const reg of existingRegs) {
      if (!reg.scope.endsWith("/")) {
        await reg.unregister();
        console.log("[FCM] Unregistered conflicting SW:", reg.scope);
      }
    }

    //  Register with explicit scope
    const reg = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );
    console.log("[FCM] SW registered ✓ scope:", reg.scope);

    await navigator.serviceWorker.ready;
    console.log("[FCM] SW ready ✓");

    // ✅ Bind messaging to YOUR registration — prevents Firebase making a second one
    _messaging = getMessaging(app);
    await getToken(_messaging, {
      vapidKey: "BFID2OKKVjuBAh3Q0DyC8IpdgythnwvDa_55_gZwqGJIJVcufyrLS_zK92bODBdV525zC-C39QCRtU9siSEOVvc",
      serviceWorkerRegistration: reg,  // ← THIS is the key fix
    }).catch(() => null);

    console.log("[FCM] Messaging initialized ✓");
    return _messaging;
  } catch (err) {
    console.error("[FCM] SW registration failed:", err);
    return null;
  }
};

export default app;
