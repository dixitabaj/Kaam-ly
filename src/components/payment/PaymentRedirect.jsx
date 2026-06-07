// src/components/payment/PaymentVerifyRedirect.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BookingNavbar from "../Navbar/Navbar";

const API = "http://127.0.0.1:8000";

export default function PaymentVerifyRedirect() {
  const { taskId } = useParams();
  const [status, setStatus]   = useState("verifying");
  const [message, setMessage] = useState("");
  const [dots, setDots]       = useState(".");

  useEffect(() => {
    const t = setInterval(
      () => setDots(d => (d.length >= 3 ? "." : d + ".")),
      500
    );
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const verifyPayment = async () => {
      const searchParams = new URLSearchParams(window.location.search);

      // ── Khalti callback ──
      const pidx = searchParams.get("pidx");
      if (pidx) {
        const khaltiStatus = searchParams.get("status");
        if (khaltiStatus === "Completed") {
          setStatus("success");
          setTimeout(() => {
            window.location.href = `/customer/pay/${taskId}?payment=success`;
          }, 1500);
        } else {
          setStatus("error");
          setMessage("Khalti payment was not completed.");
        }
        return;
      }

      // ── eSewa callback ──
      const data        = searchParams.get("data");
      const amt         = searchParams.get("amt");
      const pid         = searchParams.get("pid");
      const refId       = searchParams.get("refId");
      const statusParam = searchParams.get("status");

      if (!data && !(amt && pid && refId && statusParam)) {
        setStatus("error");
        setMessage("No payment data received.");
        return;
      }

      try {
        const query = data
          ? `data=${encodeURIComponent(data)}`
          : `amt=${amt}&pid=${pid}&refId=${refId}&status=${statusParam}`;

        const res    = await fetch(`${API}/payment/verify/esewa/${taskId}?${query}`);
        const result = await res.json();

        if (res.ok) {
          setStatus("success");
          setTimeout(() => {
            window.location.href = `/customer/pay/${taskId}?payment=success`;
          }, 1500);
        } else {
          setStatus("error");
          setMessage(result.detail || result.message || "Payment verification failed");
        }
      } catch (err) {
        setStatus("error");
        setMessage(err.message || "Something went wrong");
      }
    };

    verifyPayment();
  }, [taskId]);

  return (
    <>
      <BookingNavbar />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;800&display=swap');

        /* ── Design tokens ── */
        :root {
          --color-bg-start:   #f0fdf4;
          --color-bg-end:     #ecfdf5;
          --color-surface:    #ffffff;
          --color-brand:      #059669;
          --color-brand-lt:   #10b981;
          --color-brand-pale: #d1fae5;
          --color-brand-deep: #065f46;
          --color-danger:     #dc2626;
          --color-danger-lt:  #ef4444;
          --color-danger-pale:#fee2e2;
          --color-danger-deep:#991b1b;
          --color-muted:      #6b7280;
          --color-shadow:     rgba(0,0,0,.08);
          --color-shadow-brand: rgba(16,185,129,.35);
          --color-shadow-danger: rgba(239,68,68,.3);

          /* Fluid sizing — works from 320 px phone to 3840 px 4K TV */
          --space-xs:   clamp(0.5rem,  1vw,  1rem);
          --space-sm:   clamp(0.75rem, 1.5vw, 1.5rem);
          --space-md:   clamp(1rem,    2vw,   2.5rem);
          --space-lg:   clamp(1.5rem,  3vw,   4rem);
          --space-xl:   clamp(2rem,    4vw,   6rem);

          --radius-card: clamp(16px, 2.5vw, 32px);
          --radius-btn:  clamp(8px,  1vw,   14px);

          --icon-size:   clamp(56px,  8vw,  120px);
          --icon-fs:     clamp(24px,  3.5vw, 52px);
          --spinner-sz:  clamp(48px,  7vw,  100px);
          --spinner-bw:  clamp(3px,   .4vw,  6px);

          --fs-heading:  clamp(1.1rem, 2.5vw, 2.2rem);
          --fs-sub:      clamp(0.75rem, 1.2vw, 1.1rem);
          --fs-btn:      clamp(0.8rem,  1.2vw, 1.1rem);

          --card-max:    clamp(320px, 45vw, 520px);
          --card-pad-v:  clamp(2rem,   5vw,  5rem);
          --card-pad-h:  clamp(1.5rem, 4vw,  4rem);
        }

        /* ── Keyframes ── */
        @keyframes pvr-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pvr-fadeUp {
          from { opacity: 0; transform: translateY(clamp(8px, 1.5vw, 20px)); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pvr-grow {
          from { width: 5%; }
          to   { width: 90%; }
        }
        @keyframes pvr-popIn {
          0%   { transform: scale(.5);   opacity: 0; }
          70%  { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }

        /* ── Layout ── */
        .pvr-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--color-bg-start), var(--color-bg-end));
          font-family: 'DM Sans', sans-serif;
          padding: var(--space-md);
          box-sizing: border-box;
        }

        /* ── Card ── */
        .pvr-card {
          background: var(--color-surface);
          border-radius: var(--radius-card);
          padding: var(--card-pad-v) var(--card-pad-h);
          text-align: center;
          box-shadow: 0 8px 40px var(--color-shadow);
          max-width: var(--card-max);
          width: 100%;
          animation: pvr-fadeUp .4s ease both;
          box-sizing: border-box;
        }

        /* ── Spinner ── */
        .pvr-spinner {
          width:  var(--spinner-sz);
          height: var(--spinner-sz);
          border: var(--spinner-bw) solid var(--color-brand-pale);
          border-top-color: var(--color-brand-lt);
          border-radius: 50%;
          animation: pvr-spin .8s linear infinite;
          margin: 0 auto var(--space-md);
          flex-shrink: 0;
        }

        /* ── Icon circles ── */
        .pvr-icon {
          width:  var(--icon-size);
          height: var(--icon-size);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--space-sm);
          font-size: var(--icon-fs);
          color: #fff;
          animation: pvr-popIn .5s cubic-bezier(.36,.07,.19,.97) both;
          flex-shrink: 0;
        }
        .pvr-icon--success {
          background: linear-gradient(135deg, var(--color-brand), var(--color-brand-lt));
          box-shadow: 0 8px 24px var(--color-shadow-brand);
        }
        .pvr-icon--error {
          background: linear-gradient(135deg, var(--color-danger), var(--color-danger-lt));
          box-shadow: 0 8px 24px var(--color-shadow-danger);
        }

        /* ── Typography ── */
        .pvr-heading {
          margin: 0;
          font-size: var(--fs-heading);
          font-weight: 800;
          line-height: 1.2;
        }
        .pvr-heading--brand  { color: var(--color-brand-deep); }
        .pvr-heading--danger { color: var(--color-danger-deep); }

        .pvr-sub {
          margin: var(--space-xs) 0 var(--space-md);
          font-size: var(--fs-sub);
          color: var(--color-muted);
          line-height: 1.6;
        }
        .pvr-sub--tight {
          margin-bottom: 0;
        }

        /* ── Progress bar ── */
        .pvr-bar-track {
          height: clamp(3px, .5vw, 6px);
          background: var(--color-brand-pale);
          border-radius: 99px;
          overflow: hidden;
          margin-top: var(--space-md);
        }
        .pvr-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--color-brand), var(--color-brand-lt));
          border-radius: 99px;
          animation: pvr-grow 2s ease forwards;
        }

        /* ── Button ── */
        .pvr-btn {
          display: inline-block;
          padding: var(--space-xs) var(--space-md);
          background: var(--color-danger-pale);
          border: none;
          border-radius: var(--radius-btn);
          color: var(--color-danger);
          font-weight: 700;
          font-size: var(--fs-btn);
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: opacity .15s;
          white-space: nowrap;
        }
        .pvr-btn:hover  { opacity: .85; }
        .pvr-btn:active { opacity: .7;  }
      `}</style>

      <div className="pvr-page">
        <div className="pvr-card">

          {/* ── Verifying ── */}
          {status === "verifying" && (
            <>
              <div className="pvr-spinner" />
              <p className="pvr-heading pvr-heading--brand">
                Verifying Payment{dots}
              </p>
              <p className="pvr-sub">
                Please wait while we confirm your payment. Do not close this page.
              </p>
              <div className="pvr-bar-track">
                <div className="pvr-bar-fill" />
              </div>
            </>
          )}

          {/* ── Success ── */}
          {status === "success" && (
            <>
              <p className="pvr-heading pvr-heading--brand">Payment Verified!</p>
              <p className="pvr-sub pvr-sub--tight">Redirecting you now…</p>
            </>
          )}

          {/* ── Error ── */}
          {status === "error" && (
            <>
              <p className="pvr-heading pvr-heading--danger">Verification Failed</p>
              <p className="pvr-sub">{message}</p>
              <button className="pvr-btn" onClick={() => window.history.back()}>
                ← Go Back
              </button>
            </>
          )}

        </div>
      </div>
    </>
  );
}