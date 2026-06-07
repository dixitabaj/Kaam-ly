// useFraudWorker.js
// Singleton Web Worker using inline blob — no external file, no Vite issues.
// Worker survives navigation within the same tab.

import { useEffect, useState, useCallback } from "react";

export const SCAN_INTERVALS = [
  { label: "5 min",  value: 5  * 60 * 1000 },
  { label: "15 min", value: 15 * 60 * 1000 },
  { label: "30 min", value: 30 * 60 * 1000 },
  { label: "1 hr",   value: 60 * 60 * 1000 },
];
const DEFAULT_INTERVAL = SCAN_INTERVALS[1].value;

// ── Inline worker code as a string ───────────────────────────────────────────
const WORKER_CODE = `
  const API_BASE = "http://127.0.0.1:8000/api";
  let scanInterval = ${DEFAULT_INTERVAL};
  let scanTimer    = null;
  let isScanning   = false;
  let token        = null;

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
  });

  const post = (type, payload) => self.postMessage({ type, ...(payload || {}) });

  async function runScan() {
    if (isScanning) return;
    isScanning = true;
    post("SCAN_START");
    console.log("[FraudWorker] Scan started, token:", token ? "present" : "MISSING");

    try {
      const res = await fetch(API_BASE + "/fraud/scan-all", {
        method: "POST",
        headers: authHeaders(),
      });

      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const job_id = data.job_id;
      console.log("[FraudWorker] Job started:", job_id);

      await new Promise((resolve) => {
        const poll = setInterval(async () => {
          try {
            const p   = await fetch(API_BASE + "/fraud/scan-progress/" + job_id, { headers: authHeaders() });
            const job = await p.json();
            console.log("[FraudWorker] Poll:", job);
            post("SCAN_PROGRESS", { progress: job.progress || 0, total: job.total || 0 });
            if (job.status === "done" || job.status === "error") {
              clearInterval(poll);
              resolve();
            }
          } catch(e) {
            console.error("[FraudWorker] Poll error:", e.message);
            clearInterval(poll);
            resolve();
          }
        }, 2000);
      });

      post("SCAN_DONE", { lastScanAt: new Date().toISOString() });
      console.log("[FraudWorker] Scan done");

    } catch (e) {
      console.error("[FraudWorker] Scan error:", e.message);
      post("SCAN_ERROR", { message: e.message });
    } finally {
      isScanning = false;
      scheduleNext();
    }
  }

  function scheduleNext() {
    clearTimeout(scanTimer);
    const nextFireAt = Date.now() + scanInterval;
    post("SCHEDULED", { nextFireAt });
    console.log("[FraudWorker] Next scan in", Math.round(scanInterval / 60000), "min");
    scanTimer = setTimeout(runScan, scanInterval);
  }

  self.onmessage = (e) => {
    const { type, payload } = e.data;
    console.log("[FraudWorker] Received:", type, payload);
    switch (type) {
      case "INIT":
        token        = payload.token;
        scanInterval = payload.interval || scanInterval;
        runScan();
        break;
      case "SET_TOKEN":
        token = payload.token;
        break;
      case "SET_INTERVAL":
        scanInterval = payload.interval;
        clearTimeout(scanTimer);
        scheduleNext();
        break;
      case "SCAN_NOW":
        clearTimeout(scanTimer);
        runScan();
        break;
      case "STOP":
        clearTimeout(scanTimer);
        break;
    }
  };

  console.log("[FraudWorker] Worker thread ready");
`;

// ── Singleton state (outside React — survives navigation) ─────────────────────
let worker      = null;
let workerState = {
  isScanning: false,
  progress:   0,
  total:      0,
  lastScanAt: null,
  nextFireAt: null,
  error:      null,
};
const listeners = new Set();

const notify = (patch) => {
  workerState = { ...workerState, ...patch };
  listeners.forEach(fn => fn({ ...workerState }));
};

const getToken = () => {
  try {
    const u = localStorage.getItem("user");
    if (u) return JSON.parse(u)?.token;
    return localStorage.getItem("access_token") || localStorage.getItem("token") || null;
  } catch { return null; }
};

const initWorker = (interval = DEFAULT_INTERVAL) => {
  if (worker) return; // already running — do nothing

  const blob = new Blob([WORKER_CODE], { type: "application/javascript" });
  const url  = URL.createObjectURL(blob);
  worker     = new Worker(url);

  worker.onmessage = ({ data }) => {
    const { type, ...rest } = data;
    switch (type) {
      case "SCAN_START":    notify({ isScanning: true,  progress: 0, total: 0, error: null }); break;
      case "SCAN_PROGRESS": notify({ progress: rest.progress, total: rest.total });             break;
      case "SCAN_DONE":     notify({ isScanning: false, lastScanAt: rest.lastScanAt });         break;
      case "SCAN_ERROR":    notify({ isScanning: false, error: rest.message });                 break;
      case "SCHEDULED":     notify({ nextFireAt: rest.nextFireAt });                            break;
    }
  };

  worker.onerror = (e) => {
    console.error("[FraudWorker] Uncaught error:", e.message);
    notify({ isScanning: false, error: e.message });
  };

  worker.postMessage({
    type: "INIT",
    payload: { token: getToken(), interval },
  });
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useFraudWorker(interval = DEFAULT_INTERVAL) {
  const [state,      setState]    = useState({ ...workerState });
  const [nextScanIn, setNextScanIn] = useState(0);

  useEffect(() => {
    initWorker(interval); // no-op if already running

    // Refresh token in case it changed since last mount
    worker?.postMessage({ type: "SET_TOKEN", payload: { token: getToken() } });

    const sub = (s) => setState({ ...s });
    listeners.add(sub);
    return () => listeners.delete(sub); // unsubscribe only — worker keeps running
  }, []);

  // Countdown ticker (UI only)
  useEffect(() => {
    const t = setInterval(() => {
      if (workerState.nextFireAt && !workerState.isScanning) {
        setNextScanIn(Math.max(0, workerState.nextFireAt - Date.now()));
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const scanNow = useCallback(() => {
    worker?.postMessage({ type: "SCAN_NOW" });
  }, []);

  const setWorkerInterval = useCallback((ms) => {
    worker?.postMessage({ type: "SET_INTERVAL", payload: { interval: ms } });
  }, []);

  return {
    isScanning:  state.isScanning,
    progress:    state.progress,
    total:       state.total,
    lastScanAt:  state.lastScanAt,
    error:       state.error,
    nextScanIn,
    scanNow,
    setWorkerInterval,
    SCAN_INTERVALS,
  };
}