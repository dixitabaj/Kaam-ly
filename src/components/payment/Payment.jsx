import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import BookingNavbar from "../Navbar/Navbar";

const API = "http://127.0.0.1:8000";

/* ── HELPERS ── */
function submitEsewaForm(formData, esewaUrl) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = esewaUrl;
  Object.entries(formData).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

/* ── UI COMPONENTS ── */
function Pill({ status }) {
  const map = {
    pending:     { label: "Pending",     color: "#b45309", bg: "#fef3c7", dot: "#f59e0b" },
    confirmed:   { label: "Confirmed",   color: "#1d4ed8", bg: "#dbeafe", dot: "#3b82f6" },
    in_progress: { label: "In Progress", color: "#6d28d9", bg: "#ede9fe", dot: "#8b5cf6" },
    completed:   { label: "Completed",   color: "#065f46", bg: "#d1fae5", dot: "#10b981" },
    declined:    { label: "Cancelled",   color: "#374151", bg: "#f3f4f6", dot: "#9ca3af" },
    held:        { label: "Held",        color: "#92400e", bg: "#fef3c7", dot: "#f59e0b" },
    released:    { label: "Released",    color: "#065f46", bg: "#d1fae5", dot: "#10b981" },
    unpaid:      { label: "Unpaid",      color: "#991b1b", bg: "#fee2e2", dot: "#ef4444" },
    paid:        { label: "Paid",        color: "#065f46", bg: "#d1fae5", dot: "#10b981" },
  };
  const s = map[status] || { label: status, color: "#374151", bg: "#f3f4f6", dot: "#9ca3af" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 12px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
      color: s.color, background: s.bg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

function AmountBadge({ amount, label }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
      borderRadius: 16, padding: "20px 24px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: 20,
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {label || "Total Amount"}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "'DM Mono', monospace" }}>
          NPR {amount?.toLocaleString() ?? "—"}
        </p>
      </div>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>💳</div>
    </div>
  );
}

/* ── STEP COMPONENTS ── */
function StepPay({ task }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const handlePay = async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API}/task/${task._id}/pay/esewa`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Payment init failed");
      submitEsewaForm(data.form_data, data.esewa_url);
    } catch (err) { setError(err.message); setLoading(false); }
  };
  return (
    <>
      <p style={S.panelTitle}>💳 Complete Your Payment</p>
      <AmountBadge amount={task.totalCost} />
      <div style={S.infoRow}><span style={S.infoKey}>Task</span><span style={S.infoVal}>{task.taskName}</span></div>
      <div style={S.infoRow}><span style={S.infoKey}>Service Date</span><span style={S.infoVal}>{task.serviceDate ? new Date(task.serviceDate).toLocaleDateString() : "—"}</span></div>
      <div style={S.infoRow}><span style={S.infoKey}>Address</span><span style={S.infoVal}>{task.address || "—"}</span></div>
      <div style={{ height: 1, background: "#f1f1f1", margin: "18px 0" }} />
      <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "12px 14px", marginBottom: 18, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 16 }}>🔒</span>
        <p style={{ margin: 0, fontSize: 12, color: "#166534", lineHeight: 1.5 }}>Funds are held securely in escrow until you confirm the task is complete.</p>
      </div>
      {error && <p style={S.error}>{error}</p>}
      <button onClick={handlePay} disabled={loading} style={{ ...S.btn, ...S.btnGreen }}>
        {loading ? <><span style={S.spin} /> Processing…</> : <><EsewaIcon /> Pay with eSewa</>}
      </button>
    </>
  );
}

function StepWaiting({ task }) {
  return (
    <>
      <div style={S.statusBox}>
        <div style={{ ...S.iconCircle, background: "#fef3c7", color: "#d97706" }}>⏳</div>
        <div>
          <p style={S.statusTitle}>Payment Confirmed!</p>
          <p style={S.statusSub}>NPR {task.totalCost?.toLocaleString()} is safely held in escrow. Waiting for the worker to start.</p>
        </div>
      </div>
      <div style={S.timeline}>
        <Step done  label="Payment received"    />
        <Step active label="Worker starting soon" />
        <Step        label="Task in progress"    />
        <Step        label="Release payment"     />
      </div>
    </>
  );
}

function StepConfirmComplete({ task, userId, onComplete }) {
  const [loading,   setLoading]   = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error,     setError]     = useState("");
  const handleComplete = async () => {
    if (!confirmed) { setError("Please confirm the checkbox first."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API}/task/${task._id}/complete`, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ user_id: userId }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      onComplete(data);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  return (
    <>
      <p style={S.panelTitle}>🎉 Ready to Release Payment?</p>
      <div style={{ background: "linear-gradient(135deg,#ecfdf5,#d1fae5)", borderRadius: 14, padding: "18px 20px", marginBottom: 20, display: "flex", gap: 14, alignItems: "center", border: "1px solid #a7f3d0" }}>
        <span style={{ fontSize: 32 }}>🔒</span>
        <div>
          <p style={{ margin: 0, fontWeight: 800, color: "#065f46", fontSize: 18 }}>NPR {task.totalCost?.toLocaleString()}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#047857" }}>Confirming releases funds to the worker immediately.</p>
        </div>
      </div>
      <label style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 20, cursor: "pointer", padding: "14px 16px", background: "#f9fafb", borderRadius: 10, border: confirmed ? "1.5px solid #10b981" : "1.5px solid #e5e7eb" }}>
        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, accentColor: "#10b981", cursor: "pointer", flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>I confirm the task has been completed to my satisfaction.</span>
      </label>
      {error && <p style={S.error}>{error}</p>}
      <button onClick={handleComplete} disabled={loading || !confirmed} style={{ ...S.btn, ...S.btnGreen, opacity: (!confirmed || loading) ? 0.5 : 1 }}>
        {loading ? <><span style={S.spin} /> Processing…</> : "✅ Confirm & Release Payment"}
      </button>
    </>
  );
}

function StepWorkerInProgress({ task }) {
  return (
    <>
      <div style={S.statusBox}>
        <div style={{ ...S.iconCircle, background: "#ede9fe", color: "#7c3aed" }}>🛠️</div>
        <div>
          <p style={S.statusTitle}>Task In Progress</p>
          <p style={S.statusSub}>NPR {task.totalCost?.toLocaleString()} is held securely. Complete the task and ask the customer to confirm.</p>
        </div>
      </div>
      <div style={S.timeline}>
        <Step done  label="Customer paid"                    />
        <Step done  label="Work started"                     />
        <Step active label="Awaiting customer confirmation"  />
        <Step        label="Payment released to you"         />
      </div>
    </>
  );
}

function StepWorkerWaitingPayment() {
  return (
    <div style={S.statusBox}>
      <div style={{ ...S.iconCircle, background: "#fef3c7", color: "#d97706" }}>💰</div>
      <div>
        <p style={S.statusTitle}>Waiting for Payment</p>
        <p style={S.statusSub}>The customer hasn't paid yet. You'll be notified once payment is confirmed.</p>
      </div>
    </div>
  );
}

function StepDone({ task, role }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 0" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>{role === "worker" ? "💰" : "✅"}</div>
      <p style={{ margin: 0, fontWeight: 800, fontSize: 22, color: "#111" }}>{role === "worker" ? "Payment Released!" : "Task Completed!"}</p>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: "#6b7280" }}>
        {role === "worker"
          ? `NPR ${(task.worker_payout || task.totalCost)?.toLocaleString()} has been released to your account.`
          : "Thank you! Payment has been released to the worker."}
      </p>
    </div>
  );
}

function Step({ label, done, active }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, border: done ? "none" : active ? "2px solid #8b5cf6" : "2px solid #e5e7eb", background: done ? "#10b981" : active ? "#ede9fe" : "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>
        {done ? "✓" : active ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#8b5cf6", display: "block" }} /> : null}
      </div>
      <span style={{ fontSize: 12, fontWeight: done ? 600 : active ? 700 : 400, color: done ? "#065f46" : active ? "#5b21b6" : "#9ca3af" }}>{label}</span>
    </div>
  );
}

function EsewaIcon() {
  return <span style={{ fontSize: 16, fontWeight: 900, fontFamily: "serif", color: "#fff", letterSpacing: "-0.5px" }}>e</span>;
}

/* ─────────────────────────────────────────────────────────────
   THE CARD CONTENT
───────────────────────────────────────────────────────────── */
function PaymentCard({ task, loading, error, taskId, role, userId, successMsg, setSuccessMsg, refresh, isModal, onClose }) {
  const navigate = useNavigate();
  
  const isPaid       = task?.payment_status === "paid";
  const isHeld       = task?.escrow_status  === "held";
  const isInProgress = task?.status === "in_progress";
  const isCompleted  = task?.status === "completed";

  return (
    <div
      style={{
        background: "#fff", borderRadius: 24,
        width: "100%", maxWidth: 480,
        maxHeight: isModal ? "90vh" : "none",
        overflowY: isModal ? "auto" : "visible",
        boxShadow: "0 32px 80px rgba(0,0,0,.3)",
        animation: "fadeUp .35s cubic-bezier(0.16,1,0.3,1) both",
        display: "flex", flexDirection: "column",
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f1f1", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9ca3af" }}>
            {role === "worker" ? "Worker View" : "Customer View"}
          </p>
          <h1 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "#111" }}>
            {loading ? "Loading…" : (task?.taskName || "Task Payment")}
          </h1>
          {task?.address && <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>{task.address}</p>}
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexShrink: 0, marginLeft: 12 }}>
          {task && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
              <Pill status={task.status} />
              <Pill status={task.payment_status || "unpaid"} />
              {task.escrow_status && <Pill status={task.escrow_status} />}
            </div>
          )}
          {isModal && (
            <button
              onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: "50%", background: "#f3f4f6", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#6b7280", fontSize: 18, fontWeight: 700, marginTop: 2 }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "20px 24px 24px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTop: "3px solid #10b981", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Loading payment details…</p>
          </div>
        )}

        {!loading && (error || !task) && (
          <div style={{ borderLeft: "4px solid #ef4444", paddingLeft: 14 }}>
            <p style={{ margin: 0, fontWeight: 700, color: "#dc2626" }}>⚠ {error || "Failed to load task"}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>Task ID: {taskId}</p>
          </div>
        )}

        {successMsg && !loading && task && (
          <div style={{ background: "#ecfdf5", border: "1.5px solid #6ee7b7", borderRadius: 14, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>🎉</span>
            <p style={{ margin: 0, fontWeight: 700, color: "#065f46", fontSize: 13 }}>{successMsg}</p>
          </div>
        )}

        {!loading && task && (
          <>
            {role === "customer" && (
              <>
                {!isPaid && !isCompleted && (
                  <StepPay task={task} />
                )}
                {isPaid && isHeld && !isInProgress && !isCompleted && (
                  <StepWaiting task={task} />
                )}
                {isInProgress && isPaid && isHeld && (
                  <StepConfirmComplete task={task} userId={userId} onComplete={(data) => {
                    setSuccessMsg(data.message || "Payment released to worker!");
                    refresh({ status: "completed", escrow_status: "released" });
                  }} />
                )}
                {isCompleted && <StepDone task={task} role="customer" />}
              </>
            )}
            {role === "worker" && (
              <>
                {!isPaid && !isCompleted && <StepWorkerWaitingPayment />}
                {isInProgress && isPaid && isHeld && <StepWorkerInProgress task={task} />}
                {isCompleted && <StepDone task={task} role="worker" />}
              </>
            )}
            
            <button
              onClick={() => navigate(`/tasks/user/${userId}`)}
              style={{
                marginTop: 20,
                padding: "10px 16px",
                width: "100%",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: "#374151",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              ← Back to My Requests
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
export default function PaymentFlow({ taskIdProp, userIdProp, roleProp, onClose }) {
  const params  = useParams();
  const taskId  = taskIdProp ?? params.taskId;
  const userId  = userIdProp ?? params.userId;
  const role    = roleProp   ?? params.role ?? "customer";
  const isModal = !!onClose;

  const [searchParams]              = useSearchParams();
  const paymentSuccess              = searchParams.get("payment") === "success";

  const [task,       setTask]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [successMsg, setSuccessMsg] = useState(
    paymentSuccess ? "Payment verified! Funds are now held in escrow." : ""
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError("");
      try {
        if (!taskId || taskId === "undefined") throw new Error("Invalid task ID");
        const res  = await fetch(`${API}/task/${taskId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Task not found");
        setTask({ ...data, _id: String(data._id || data.id || taskId) });
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    };
    load();
  }, [taskId]);

  const refresh = (updates) => setTask(prev => ({ ...prev, ...updates }));

  const sharedProps = { task, loading, error, taskId, role, userId, successMsg, setSuccessMsg, refresh, isModal, onClose };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(12px) scale(0.98); } to { opacity:1; transform:none; } }
      `}</style>

      {isModal ? (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "'DM Sans', sans-serif" }}
          onClick={onClose}
        >
          <PaymentCard {...sharedProps} />
        </div>
      ) : (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f3f4f6", fontFamily: "'DM Sans', sans-serif" }}>
          <BookingNavbar />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
            <PaymentCard {...sharedProps} />
          </div>
        </div>
      )}
    </>
  );
}

const S = {
  panelTitle: { margin: "0 0 18px", fontSize: 16, fontWeight: 800, color: "#111" },
  statusBox:  { display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 },
  iconCircle: { width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 },
  statusTitle:{ margin: 0, fontWeight: 800, fontSize: 16, color: "#111" },
  statusSub:  { margin: "4px 0 0", fontSize: 13, color: "#6b7280", lineHeight: 1.55 },
  timeline:   { display: "flex", flexDirection: "column", gap: 10, paddingLeft: 4, borderLeft: "2px solid #f1f1f1", marginLeft: 8, paddingTop: 4 },
  infoRow:    { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #f9f9f9" },
  infoKey:    { fontSize: 12, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" },
  infoVal:    { fontSize: 13, fontWeight: 600, color: "#374151", textAlign: "right", maxWidth: "60%" },
  btn:        { width: "100%", padding: "14px 20px", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'DM Sans', sans-serif", transition: "all .2s" },
  btnGreen:   { background: "linear-gradient(135deg, #059669, #10b981)", color: "#fff", boxShadow: "0 4px 14px rgba(16,185,129,.35)" },
  error:      { margin: "0 0 12px", padding: "10px 14px", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#dc2626" },
  spin:       { width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTop: "2px solid #fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" },
};