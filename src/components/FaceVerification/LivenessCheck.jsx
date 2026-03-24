// components/FaceVerification/LivenessCheck.jsx
// Install: npm install @mediapipe/face_mesh @mediapipe/camera_utils
//
// Props:
//   workerId       — worker email or ID (sent to backend)
//   referencePhoto — base64 profile photo from Step 3 (used as face reference)
//   onComplete(result) — called when verification succeeds
//   onSkip()           — called when user skips

import React, { useEffect, useRef, useState } from "react";

const styles = `
  .fv-root {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
    min-height: 100vh;
    background-color: #FDFBF0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .fv-card {
    background: #fff;
    border-radius: 24px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.08);
    padding: 2.5rem;
    width: 100%;
    max-width: 500px;
  }

  .fv-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.25rem;
  }

  .fv-subtitle {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0 0 2rem;
    line-height: 1.5;
  }

  /* Steps */
  .fv-steps {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }
  .fv-step {
    flex: 1;
    background: #f8fafc;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    padding: 0.75rem 0.5rem;
    text-align: center;
    transition: all 0.25s;
  }
  .fv-step.active {
    border-color: #1e293b;
    background: #f8fafc;
  }
  .fv-step.done {
    border-color: #10b981;
    background: rgba(16,185,129,0.05);
  }
  .fv-step-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    display: block;
  }
  .fv-step.active .fv-step-label { color: #1e293b; }
  .fv-step.done   .fv-step-label { color: #10b981; }

  /* Progress bar — matches registration.css yellow */
  .fv-progress {
    height: 5px;
    background: #e2e8f0;
    border-radius: 99px;
    overflow: hidden;
    margin-bottom: 2rem;
  }
  .fv-progress-bar {
    height: 100%;
    background: #F8DB89;
    border-radius: 99px;
    transition: width 0.4s ease;
  }
  .fv-progress-bar.success { background: #10b981; }

  /* Reference strip */
  .fv-reference-strip {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #f8fafc;
    border: 2px solid #e2e8f0;
    border-radius: 14px;
    padding: 12px 16px;
    margin-bottom: 1.25rem;
  }
  .fv-ref-thumb {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #e2e8f0;
    flex-shrink: 0;
  }
  .fv-ref-text { flex: 1; }
  .fv-ref-label {
    font-size: 0.68rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .fv-ref-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: #1e293b;
    margin-top: 2px;
  }
  .fv-ref-badge {
    font-size: 0.68rem;
    font-weight: 600;
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 4px 8px;
    white-space: nowrap;
  }

  /* Camera */
  .fv-camera-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 4/3;
    border-radius: 16px;
    overflow: hidden;
    background: #0f172a;
    margin-bottom: 1rem;
    border: 2px solid #e2e8f0;
  }
  .fv-video {
    width: 100%; height: 100%;
    object-fit: cover;
    transform: scaleX(-1);
    display: block;
  }
  .fv-canvas {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    transform: scaleX(-1);
  }
  .fv-overlay {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  }
  .fv-face-guide {
    width: 50%;
    aspect-ratio: 3/4;
    border: 2.5px solid rgba(255,255,255,0.4);
    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    box-shadow: 0 0 0 2000px rgba(0,0,0,0.45);
    transition: border-color 0.3s;
  }
  .fv-face-guide.active {
    border-color: #F8DB89;
    box-shadow: 0 0 0 2000px rgba(0,0,0,0.35), 0 0 24px rgba(248,219,137,0.25);
  }
  .fv-face-guide.success {
    border-color: #10b981;
    box-shadow: 0 0 0 2000px rgba(0,0,0,0.35), 0 0 24px rgba(16,185,129,0.25);
  }

  /* Instruction pill */
  .fv-instruction {
    position: absolute;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255,255,255,0.95);
    border-radius: 30px;
    padding: 7px 16px;
    font-size: 0.78rem;
    font-weight: 500;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 7px;
    white-space: nowrap;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
  }
  .fv-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .fv-dot.amber  { background: #F8DB89; animation: fv-pulse 1.2s ease-in-out infinite; }
  .fv-dot.green  { background: #10b981; }
  .fv-dot.gray   { background: #cbd5e1; }
  @keyframes fv-pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.5; transform:scale(0.75); }
  }

  /* Challenge pills */
  .fv-challenge-pills {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }
  .fv-pill {
    flex: 1;
    padding: 10px 8px;
    border-radius: 10px;
    text-align: center;
    border: 2px solid #e2e8f0;
    background: #f8fafc;
    font-size: 0.75rem;
    font-weight: 600;
    color: #94a3b8;
    transition: all 0.3s;
  }
  .fv-pill.done {
    border-color: #10b981;
    background: rgba(16,185,129,0.06);
    color: #10b981;
  }

  /* Buttons */
  .fv-btn {
    width: 100%;
    padding: 13px;
    border: none;
    border-radius: 12px;
    font-family: inherit;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 0.5rem;
  }
  .fv-btn-primary {
    background: #1e293b;
    color: #fff;
  }
  .fv-btn-primary:hover {
    background: #0f172a;
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.15);
  }
  .fv-btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  .fv-btn-success {
    background: #10b981;
    color: #fff;
  }
  .fv-btn-success:hover {
    background: #059669;
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(16,185,129,0.25);
  }
  .fv-btn-ghost {
    background: #fff;
    border: 2px solid #e2e8f0;
    color: #64748b;
    margin-top: 0.5rem;
  }
  .fv-btn-ghost:hover {
    border-color: #94a3b8;
    background: #f8fafc;
  }

  /* Error */
  .fv-error {
    background: #fef2f2;
    border: 2px solid #fecaca;
    border-radius: 12px;
    padding: 12px 16px;
    font-size: 0.8rem;
    color: #dc2626;
    margin-bottom: 1rem;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    line-height: 1.5;
  }
  .fv-error-icon {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #dc2626;
    color: #fff;
    font-size: 0.6rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }

  /* Compare layout in verify step */
  .fv-compare-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }
  .fv-compare-item { flex: 1; }
  .fv-compare-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
    display: block;
  }
  .fv-compare-img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 14px;
    border: 2px solid #e2e8f0;
    display: block;
  }
  .fv-compare-img.reference {
    border-color: #1e293b;
  }

  /* Success panel */
  .fv-success-panel { text-align: center; padding: 0.5rem 0; }
  .fv-success-icon {
    width: 64px;
    height: 64px;
    background: rgba(16,185,129,0.1);
    border: 2px solid #10b981;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.25rem;
    animation: fv-pop 0.4s cubic-bezier(0.34,1.56,0.64,1);
  }
  .fv-success-checkmark {
    width: 26px;
    height: 26px;
    stroke: #10b981;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
  }
  @keyframes fv-pop {
    from { transform: scale(0); opacity: 0; }
    to   { transform: scale(1); opacity: 1; }
  }
  .fv-result-title {
    font-size: 1.2rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.4rem;
  }
  .fv-result-sub {
    font-size: 0.83rem;
    color: #64748b;
    margin: 0 0 1.5rem;
  }
  .fv-score-row {
    display: flex;
    justify-content: space-around;
    background: #f8fafc;
    border: 2px solid #e2e8f0;
    border-radius: 14px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }
  .fv-score-item { text-align: center; }
  .fv-score-val {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e293b;
    display: block;
  }
  .fv-score-lbl {
    font-size: 0.65rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: block;
    margin-top: 3px;
  }
`;

// ── MediaPipe landmark indices ─────────────────────────────────────────────
const LEFT_EYE    = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE   = [33,  160, 158, 133, 153, 144];
const NOSE_TIP    = 1;
const LEFT_CHEEK  = 234;
const RIGHT_CHEEK = 454;

const BLINK_THRESHOLD     = 0.22;
const HEAD_TURN_THRESHOLD = 0.12;
const CENTER_THRESHOLD    = 0.05;
const BLINK_MIN_FRAMES    = 2;
const HEAD_MIN_FRAMES     = 8;
const CENTER_MIN_FRAMES   = 5;

function eyeAspectRatio(landmarks, indices) {
  const p  = (i) => landmarks[i];
  const d  = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  const v1 = d(p(indices[1]), p(indices[5]));
  const v2 = d(p(indices[2]), p(indices[4]));
  const h  = d(p(indices[0]), p(indices[3]));
  return (v1 + v2) / (2.0 * h);
}

function headTurnRatio(landmarks) {
  const nose   = landmarks[NOSE_TIP];
  const left   = landmarks[LEFT_CHEEK];
  const right  = landmarks[RIGHT_CHEEK];
  const faceW  = Math.abs(right.x - left.x);
  if (faceW < 0.01) return 0;
  const center = (left.x + right.x) / 2;
  return (nose.x - center) / faceW;
}

const STEPS = [
  { id: "liveness", label: "Liveness check" },
  { id: "verify",   label: "Confirm match"  },
];

// ══════════════════════════════════════════════════════════════════════════════
export default function LivenessCheck({ workerId, referencePhoto, onComplete, onSkip }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const meshRef   = useRef(null);
  const doneRef   = useRef(false);

  const ch = useRef({
    blinkFramesClosed: 0,
    blinkDone:         false,
    headFramesTurned:  0,
    headTurnDone:      false,
    centerFrames:      0,
    framesTotal:       0,
    startTime:         null,
  });

  const [step,        setStep]        = useState(0);
  const [selfie,      setSelfie]      = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceIn,      setFaceIn]      = useState(false);

  const [blinkDone,   setBlinkDone]   = useState(false);
  const [headDone,    setHeadDone]    = useState(false);
  const [challengeUI, setChallengeUI] = useState("position");

  const [verifying, setVerifying] = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState(null);

  const noReference = !referencePhoto;
  const progress    = step === 0 ? 30 : result ? 100 : 70;

  // ── Stop camera ────────────────────────────────────────────────────────────
  const stopCamera = () => {
    if (cameraRef.current) { cameraRef.current.stop(); cameraRef.current = null; }
    if (meshRef.current)   { meshRef.current.close();  meshRef.current   = null; }
  };

  // ── Capture selfie when face returns to centre ─────────────────────────────
  const finishChallenge = () => {
    if (doneRef.current) return;
    doneRef.current = true;

    const video = videoRef.current;
    if (!video) return;

    const c   = document.createElement("canvas");
    c.width   = video.videoWidth;
    c.height  = video.videoHeight;
    const ctx = c.getContext("2d");
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -c.width, 0);
    ctx.restore();

    const selfieB64 = c.toDataURL("image/jpeg", 0.85);
    setSelfie(selfieB64);
    stopCamera();
    setChallengeUI("done");
    setTimeout(() => setStep(1), 600);
  };

  // ── MediaPipe onResults ────────────────────────────────────────────────────
  const handleResults = (results) => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ch.current.framesTotal++;

    if (!results.multiFaceLandmarks?.length) {
      setFaceIn(false);
      if (!ch.current.blinkDone) setChallengeUI("position");
      return;
    }

    setFaceIn(true);
    const lm = results.multiFaceLandmarks[0];

    // Subtle mesh dots
    ctx.fillStyle = "rgba(248,219,137,0.55)";
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc(p.x * canvas.width, p.y * canvas.height, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Blink phase
    if (!ch.current.blinkDone) {
      setChallengeUI("blink");
      const ear = (eyeAspectRatio(lm, LEFT_EYE) + eyeAspectRatio(lm, RIGHT_EYE)) / 2;
      if (ear < BLINK_THRESHOLD) {
        ch.current.blinkFramesClosed++;
      } else if (ch.current.blinkFramesClosed >= BLINK_MIN_FRAMES) {
        ch.current.blinkDone = true;
        setBlinkDone(true);
        ch.current.blinkFramesClosed = 0;
      } else {
        ch.current.blinkFramesClosed = 0;
      }
      return;
    }

    // Head turn phase
    if (!ch.current.headTurnDone) {
      setChallengeUI("turn");
      const ratio = Math.abs(headTurnRatio(lm));
      if (ratio > HEAD_TURN_THRESHOLD) {
        ch.current.headFramesTurned++;
        if (ch.current.headFramesTurned >= HEAD_MIN_FRAMES) {
          ch.current.headTurnDone = true;
          setHeadDone(true);
          setChallengeUI("center");
        }
      } else {
        ch.current.headFramesTurned = 0;
      }
      return;
    }

    // Return to centre — capture only once face is stable and forward
    if (ch.current.headTurnDone && challengeUI !== "done") {
      setChallengeUI("center");
      const ratio = Math.abs(headTurnRatio(lm));
      if (ratio < CENTER_THRESHOLD) {
        ch.current.centerFrames++;
        if (ch.current.centerFrames >= CENTER_MIN_FRAMES) {
          finishChallenge();
        }
      } else {
        ch.current.centerFrames = 0;
      }
    }
  };

  // ── Load MediaPipe ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 0 || noReference) return;
    doneRef.current = false;
    ch.current = {
      blinkFramesClosed: 0,
      blinkDone:         false,
      headFramesTurned:  0,
      headTurnDone:      false,
      centerFrames:      0,
      framesTotal:       0,
      startTime:         Date.now(),
    };

    let cancelled = false;

    const load = async () => {
      try {
        const { FaceMesh } = await import("@mediapipe/face_mesh");
        const { Camera }   = await import("@mediapipe/camera_utils");
        if (cancelled) return;

        const fm = new FaceMesh({
          locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
        });
        fm.setOptions({
          maxNumFaces:            1,
          refineLandmarks:        true,
          minDetectionConfidence: 0.7,
          minTrackingConfidence:  0.7,
        });
        fm.onResults(handleResults);
        meshRef.current = fm;

        const cam = new Camera(videoRef.current, {
          onFrame: async () => {
            if (meshRef.current && videoRef.current)
              await meshRef.current.send({ image: videoRef.current });
          },
          width: 640, height: 480,
        });
        await cam.start();
        cameraRef.current = cam;
        setCameraReady(true);
      } catch (e) {
        console.error(e);
        setError("Camera access failed. Please allow camera permissions and try again.");
      }
    };

    load();
    return () => { cancelled = true; stopCamera(); };
  }, [step, noReference]);

  // ── Instruction text ───────────────────────────────────────────────────────
  const getInstruction = () => {
    if (!cameraReady)             return { dot: "gray",  text: "Starting camera..." };
    if (!faceIn)                  return { dot: "gray",  text: "Position your face inside the oval" };
    if (challengeUI === "blink")  return { dot: "amber", text: "Slowly blink your eyes" };
    if (challengeUI === "turn")   return { dot: "amber", text: "Gently turn your head to one side" };
    if (challengeUI === "center") return { dot: "amber", text: "Look straight ahead" };
    if (challengeUI === "done")   return { dot: "green", text: "All done, hold still..." };
    return { dot: "amber", text: "Keep your face centred" };
  };
  const ins = getInstruction();

  // ── Submit to backend ──────────────────────────────────────────────────────
  const submit = async () => {
    if (!selfie || !referencePhoto) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/face/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker_id:       workerId,
          selfie:          selfie,
          reference_photo: referencePhoto,
          liveness_proof: {
            blink_detected:     true,
            head_turn_detected: true,
            challenge_passed:   true,
            timestamp:          Date.now(),
            frames_count:       ch.current.framesTotal,
          },
        }),
      });
      const data     = await res.json();
      const enriched = { ...data, selfiePhoto: selfie };
      setResult(enriched);
      if (data.verified && onComplete) onComplete(enriched);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setVerifying(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setBlinkDone(false);
    setHeadDone(false);
    setChallengeUI("position");
    setSelfie(null);
    doneRef.current = false;
    ch.current = {
      blinkFramesClosed: 0,
      blinkDone:         false,
      headFramesTurned:  0,
      headTurnDone:      false,
      centerFrames:      0,
      framesTotal:       0,
      startTime:         null,
    };
    setStep(0);
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{styles}</style>
      <div className="fv-root">
        <div className="fv-card">

          <h1 className="fv-title">Face Verification</h1>
          <p className="fv-subtitle">
            Complete a quick liveness check to confirm your identity matches your profile photo.
          </p>

          {/* Step indicators */}
          <div className="fv-steps">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`fv-step ${i === step ? "active" : i < step ? "done" : ""}`}
              >
                <span className="fv-step-label">
                  {i < step ? "Done" : `Step ${i + 1}`}
                </span>
                <span className="fv-step-label" style={{ marginTop: 3, fontSize: "0.78rem", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="fv-progress">
            <div
              className={`fv-progress-bar ${result?.verified ? "success" : ""}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Guard — no reference photo */}
          {noReference && (
            <div className="fv-error">
              <div className="fv-error-icon">!</div>
              <div>
                <strong style={{ display: "block", marginBottom: 2 }}>No profile photo found</strong>
                Please go back to Step 3 and upload your profile photo first.
              </div>
            </div>
          )}

          {/* General error */}
          {error && !noReference && (
            <div className="fv-error">
              <div className="fv-error-icon">!</div>
              <span>{error}</span>
            </div>
          )}

          {/* ── STEP 0: Liveness camera ────────────────────────────────── */}
          {step === 0 && !noReference && (
            <>
              {/* What we're comparing against */}
              <div className="fv-reference-strip">
                <img src={referencePhoto} alt="Your profile" className="fv-ref-thumb" />
                <div className="fv-ref-text">
                  <div className="fv-ref-label">Comparing against</div>
                  <div className="fv-ref-name">Your profile photo</div>
                </div>
                <div className="fv-ref-badge">Reference</div>
              </div>

              {/* Camera feed */}
              <div className="fv-camera-wrap">
                <video ref={videoRef} className="fv-video" autoPlay playsInline muted />
                <canvas ref={canvasRef} className="fv-canvas" />
                <div className="fv-overlay">
                  <div className={`fv-face-guide ${
                    faceIn ? (challengeUI === "done" ? "success" : "active") : ""
                  }`} />
                </div>
                <div className="fv-instruction">
                  <div className={`fv-dot ${ins.dot}`} />
                  {ins.text}
                </div>
              </div>

              {/* Challenge progress */}
              <div className="fv-challenge-pills">
                <div className={`fv-pill ${blinkDone ? "done" : ""}`}>
                  {blinkDone ? "Blink detected" : "Blink your eyes"}
                </div>
                <div className={`fv-pill ${headDone ? "done" : ""}`}>
                  {headDone ? "Head turn detected" : "Turn your head"}
                </div>
              </div>
            </>
          )}

          {/* ── STEP 1: Review & Verify ────────────────────────────────── */}
          {step === 1 && !result && (
            <>
              <p style={{ fontSize: "0.875rem", color: "#475569", marginBottom: "1rem", lineHeight: 1.6 }}>
                Check that both photos look like you, then tap confirm to complete verification.
              </p>
              <div className="fv-compare-row">
                <div className="fv-compare-item">
                  <span className="fv-compare-label">Profile photo</span>
                  <img
                    src={referencePhoto}
                    alt="Profile"
                    className="fv-compare-img reference"
                  />
                </div>
                <div className="fv-compare-item">
                  <span className="fv-compare-label">Your selfie</span>
                  {selfie && (
                    <img
                      src={selfie}
                      alt="Selfie"
                      className="fv-compare-img"
                    />
                  )}
                </div>
              </div>

              <button
                className="fv-btn fv-btn-primary"
                onClick={submit}
                disabled={verifying}
              >
                {verifying ? "Verifying..." : "Confirm and verify"}
              </button>
              <button
                className="fv-btn fv-btn-ghost"
                onClick={reset}
                disabled={verifying}
              >
                Retake selfie
              </button>
            </>
          )}

          {/* ── Verified ──────────────────────────────────────────────── */}
          {result?.verified && (
            <div className="fv-success-panel">
              <div className="fv-success-icon">
                <svg className="fv-success-checkmark" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="fv-result-title">Identity confirmed</h2>
              <p className="fv-result-sub">
                {result.message || "Your selfie matches your profile photo."}
              </p>
              <div className="fv-score-row">
                <div className="fv-score-item">
                  <span className="fv-score-val">{result.confidence}%</span>
                  <span className="fv-score-lbl">Match score</span>
                </div>
                <div className="fv-score-item">
                  <span className="fv-score-val">Passed</span>
                  <span className="fv-score-lbl">Liveness</span>
                </div>
                <div className="fv-score-item">
                  <span className="fv-score-val">Passed</span>
                  <span className="fv-score-lbl">Anti-spoof</span>
                </div>
              </div>
              <button
                className="fv-btn fv-btn-success"
                onClick={() => onComplete?.(result)}
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Failed ────────────────────────────────────────────────── */}
          {result && !result.verified && (
            <>
              <div className="fv-error">
                <div className="fv-error-icon">!</div>
                <div>
                  <strong style={{ display: "block", marginBottom: 2 }}>
                    Verification failed
                    {result.failed_at ? ` — ${result.failed_at.replace("_", " ")}` : ""}
                  </strong>
                  {result.message}
                </div>
              </div>
              <button className="fv-btn fv-btn-primary" onClick={reset}>
                Try again
              </button>
            </>
          )}

          {/* Skip */}
          {onSkip && !result?.verified && (
            <button
              className="fv-btn fv-btn-ghost"
              style={{ marginTop: "0.5rem" }}
              onClick={() => { stopCamera(); onSkip(); }}
            >
              Skip for now
            </button>
          )}

        </div>
      </div>
    </>
  );
}