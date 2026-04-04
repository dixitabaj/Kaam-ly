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

  // Animate dots
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const verifyPayment = async () => {
      const searchParams = new URLSearchParams(window.location.search);

      // ── Khalti callback (backend already verified, just check status param) ──
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

      // ── eSewa callback (frontend must call backend to verify) ──
      const data      = searchParams.get("data");
      const amt       = searchParams.get("amt");
      const pid       = searchParams.get("pid");
      const refId     = searchParams.get("refId");
      const statusParam = searchParams.get("status");

      if (!data && !(amt && pid && refId && statusParam)) {
        setStatus("error");
        setMessage("No payment data received.");
        return;
      }

      try {
        let query = data
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
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)",
        fontFamily: "'DM Sans', sans-serif",
        padding: 16,
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;800&display=swap');
          @keyframes spin   { to { transform: rotate(360deg); } }
          @keyframes fadeIn { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
          @keyframes grow   { from { width:5%; } to { width:90%; } }
          @keyframes popIn  { 0% { transform:scale(0.5); opacity:0; } 70% { transform:scale(1.15); } 100% { transform:scale(1); opacity:1; } }
        `}</style>

        <div style={{
          background: "#fff",
          borderRadius: 24,
          padding: "48px 40px",
          textAlign: "center",
          boxShadow: "0 8px 40px rgba(0,0,0,.08)",
          maxWidth: 380,
          width: "100%",
          animation: "fadeIn .4s ease both",
        }}>

          {/* ── Verifying ── */}
          {status === "verifying" && (
            <>
              <div style={{
                width: 56, height: 56,
                border: "3px solid #d1fae5",
                borderTop: "3px solid #10b981",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
                margin: "0 auto 24px",
              }} />
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#065f46" }}>
                Verifying Payment{dots}
              </p>
              <p style={{ margin: "8px 0 24px", fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
                Please wait while we confirm your payment. Do not close this page.
              </p>
              <div style={{ height: 4, background: "#d1fae5", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #059669, #10b981)",
                  borderRadius: 99,
                  animation: "grow 2s ease forwards",
                }} />
              </div>
            </>
          )}

          {/* ── Success ── */}
          {status === "success" && (
            <>
              <div style={{
                width: 72, height: 72,
                background: "linear-gradient(135deg, #059669, #10b981)",
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: 32, color: "#fff",
                animation: "popIn .5s cubic-bezier(.36,.07,.19,.97) both",
                boxShadow: "0 8px 24px rgba(16,185,129,.35)",
              }}>
                ✓
              </div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#065f46" }}>
                Payment Verified!
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280" }}>
                Redirecting you now…
              </p>
            </>
          )}

          {/* ── Error ── */}
          {status === "error" && (
            <>
              <div style={{
                width: 72, height: 72,
                background: "linear-gradient(135deg, #dc2626, #ef4444)",
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: 32, color: "#fff",
                animation: "popIn .5s cubic-bezier(.36,.07,.19,.97) both",
                boxShadow: "0 8px 24px rgba(239,68,68,.3)",
              }}>
                ✕
              </div>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#991b1b" }}>
                Verification Failed
              </p>
              <p style={{ margin: "8px 0 20px", fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
                {message}
              </p>
              <button
                onClick={() => window.history.back()}
                style={{
                  padding: "12px 24px",
                  background: "#fee2e2",
                  border: "none",
                  borderRadius: 10,
                  color: "#dc2626",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ← Go Back
              </button>
            </>
          )}

        </div>
      </div>
    </>
  );
}