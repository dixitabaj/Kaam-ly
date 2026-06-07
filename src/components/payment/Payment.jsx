import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import BookingNavbar from "../Navbar/Navbar";
import timeImg from '../../images/image.png';
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
    pending:     { label: "Pending",     color: "var(--pill-amber-text)",   bg: "var(--pill-amber-bg)" },
    confirmed:   { label: "Confirmed",   color: "var(--pill-blue-text)",    bg: "var(--pill-blue-bg)" },
    in_progress: { label: "In Progress", color: "var(--pill-purple-text)",  bg: "var(--pill-purple-bg)" },
    completed:   { label: "Completed",   color: "var(--pill-green-text)",   bg: "var(--pill-green-bg)" },
    declined:    { label: "Cancelled",   color: "var(--pill-gray-text)",    bg: "var(--pill-gray-bg)" },
    held:        { label: "Held",        color: "var(--pill-amber-text)",   bg: "var(--pill-amber-bg)" },
    released:    { label: "Released",    color: "var(--pill-green-text)",   bg: "var(--pill-green-bg)" },
    unpaid:      { label: "Unpaid",      color: "var(--pill-red-text)",     bg: "var(--pill-red-bg)" },
    paid:        { label: "Paid",        color: "var(--pill-green-text)",   bg: "var(--pill-green-bg)" },
  };
  const s = map[status] || { label: status, color: "var(--pill-gray-text)", bg: "var(--pill-gray-bg)" };
  return (
    <span className="pill" style={{ color: s.color, background: s.bg }}>
      <span className="pill-dot" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

function AmountBadge({ amount, label }) {
  return (
    <div className="amount-badge">
      <div>
        <p className="amount-label">{label || "Total Amount"}</p>
        <p className="amount-value">NPR {amount?.toLocaleString() ?? "—"}</p>
      </div>
    </div>
  );
}

/* ── STEP COMPONENTS ── */
function StepPay({ task }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePayEsewa = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/task/${task._id}/pay/esewa`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "eSewa payment init failed");
      submitEsewaForm(data.form_data, data.esewa_url);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handlePayKhalti = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/task/${task._id}/pay/khalti`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Khalti payment init failed");
      window.location.href = data.payment_url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <>
      <p className="panel-title">Complete your payment</p>
      <AmountBadge amount={task.totalCost} />
      <div className="info-row"><span className="info-key">Task</span><span className="info-val">{task.taskName}</span></div>
      <div className="info-row"><span className="info-key">Service date</span><span className="info-val">{task.serviceDate ? new Date(task.serviceDate).toLocaleDateString() : "—"}</span></div>
      <div className="info-row"><span className="info-key">Address</span><span className="info-val">{task.address || "—"}</span></div>
      <div className="divider" />
      <div className="escrow-notice">
        <p className="notice-text">Funds are held securely in escrow until you confirm the task is complete.</p>
      </div>
      {error && <p className="error-msg">{error}</p>}
      <p className="method-label">Choose your payment method</p>
      <button onClick={handlePayEsewa} disabled={loading} className="btn btn-esewa">
     Pay with eSewa
      </button>
      <button onClick={handlePayKhalti} disabled={loading} className="btn btn-khalti">
         Pay with Khalti
      </button>
    </>
  );
}

function StepWaiting({ task }) {
  return (
    <>
      <div className="status-box">
        <div className="icon-circle icon-amber"><img src={timeImg} alt="Time" width={30}/></div>
        <div>
          <p className="status-title">Payment confirmed</p>
          <p className="status-sub">NPR {task.totalCost?.toLocaleString()} is safely held in escrow. Waiting for the worker to start.</p>
        </div>
      </div>
      <div className="timeline">
        <TimelineStep done  label="Payment received" />
        <TimelineStep active label="Worker starting soon" />
        <TimelineStep        label="Task in progress" />
        <TimelineStep        label="Release payment" />
      </div>
    </>
  );
}

function StepConfirmComplete({ task, userId, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  const handleComplete = async () => {
    if (!confirmed) { setError("Please confirm the checkbox first."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/task/${task._id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      onComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <p className="panel-title">Ready to release payment?</p>
      <div className="release-badge">
        <div>
          <p className="release-amount">NPR {task.totalCost?.toLocaleString()}</p>
          <p className="release-sub">Confirming releases funds to the worker immediately.</p>
        </div>
      </div>
      <label className={`confirm-label${confirmed ? " confirm-label--checked" : ""}`}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={e => setConfirmed(e.target.checked)}
          className="confirm-checkbox"
        />
        <span className="confirm-text">I confirm the task has been completed to my satisfaction.</span>
      </label>
      {error && <p className="error-msg">{error}</p>}
      <button onClick={handleComplete} disabled={loading || !confirmed} className={`btn btn-esewa${(!confirmed || loading) ? " btn--disabled" : ""}`}>
        {loading ? <><span className="spinner" /> Processing…</> : "Confirm & release payment"}
      </button>
    </>
  );
}

function StepWorkerInProgress({ task }) {
  return (
    <>
      <div className="status-box">
        <div className="icon-circle icon-purple">🛠️</div>
        <div>
          <p className="status-title">Task in progress</p>
          <p className="status-sub">NPR {task.totalCost?.toLocaleString()} is held securely. Complete the task and ask the customer to confirm.</p>
        </div>
      </div>
      <div className="timeline">
        <TimelineStep done  label="Customer paid" />
        <TimelineStep done  label="Work started" />
        <TimelineStep active label="Awaiting customer confirmation" />
        <TimelineStep        label="Payment released to you" />
      </div>
    </>
  );
}

function StepWorkerWaitingPayment() {
  return (
    <div className="status-box">
      <div className="icon-circle icon-amber">💰</div>
      <div>
        <p className="status-title">Waiting for payment</p>
        <p className="status-sub">The customer hasn't paid yet. You'll be notified once payment is confirmed.</p>
      </div>
    </div>
  );
}

function StepDone({ task, role }) {
  return (
    <div className="done-view">
      <div className="done-icon">{role === "worker" ? "💰" : "✅"}</div>
      <p className="done-title">{role === "worker" ? "Payment released!" : "Task completed!"}</p>
      <p className="done-sub">
        {role === "worker"
          ? `NPR ${(task.worker_payout || task.totalCost)?.toLocaleString()} has been released to your account.`
          : "Thank you! Payment has been released to the worker."}
      </p>
    </div>
  );
}

function TimelineStep({ label, done, active }) {
  return (
    <div className="timeline-step">
      <div className={`timeline-dot${done ? " timeline-dot--done" : active ? " timeline-dot--active" : ""}`}>
        {done ? "✓" : active ? <span className="timeline-pulse" /> : null}
      </div>
      <span className={`timeline-label${done ? " timeline-label--done" : active ? " timeline-label--active" : ""}`}>
        {label}
      </span>
    </div>
  );
}



/* ── CARD ── */
function PaymentCard({ task, loading, error, taskId, role, userId, successMsg, setSuccessMsg, refresh, isModal, onClose }) {
  const navigate = useNavigate();

  const isPaid       = task?.payment_status === "paid";
  const isHeld       = task?.escrow_status  === "held";
  const isInProgress = task?.status === "in_progress";
  const isCompleted  = task?.status === "completed";

  return (
    <div className="payment-card" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="card-header">
        <div className="card-header-left">
       
          <h1 className="card-title">
            {loading ? "Loading…" : (task?.taskName || "Task payment")}
          </h1>
          {task?.address && <p className="card-address">{task.address}</p>}
        </div>
        <div className="card-header-right">
          {task && (
            <div className="pill-stack">
              <Pill status={task.status} />
              <Pill status={task.payment_status || "unpaid"} />
              {task.escrow_status && <Pill status={task.escrow_status} />}
            </div>
          )}
          {isModal && (
            <button onClick={onClose} className="close-btn" aria-label="Close">×</button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="card-body">
        {loading && (
          <div className="loading-state">
            <div className="spinner spinner--lg" />
            <p className="loading-text">Loading payment details…</p>
          </div>
        )}

        {!loading && (error || !task) && (
          <div className="error-block">
            <p className="error-block-title">⚠ {error || "Failed to load task"}</p>
            <p className="error-block-sub">Task ID: {taskId}</p>
          </div>
        )}

        {successMsg && !loading && task && (
          <div className="success-banner">
            <p className="success-text">{successMsg}</p>
          </div>
        )}

        {!loading && task && (
          <>
            {role === "customer" && (
              <>
                {!isPaid && !isCompleted && <StepPay task={task} />}
                {isPaid && isHeld && !isInProgress && !isCompleted && <StepWaiting task={task} />}
                {isInProgress && isPaid && isHeld && (
                  <StepConfirmComplete
                    task={task}
                    userId={userId}
                    onComplete={(data) => {
                      setSuccessMsg(data.message || "Payment released to worker!");
                      refresh({ status: "completed", escrow_status: "released" });
                    }}
                  />
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
              className="back-btn"
            >
              ← Back to my requests
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── MAIN ── */
export default function PaymentFlow({ taskIdProp, userIdProp, roleProp, onClose }) {
  const params  = useParams();
  const taskId  = taskIdProp ?? params.taskId;
  const userId  = userIdProp ?? params.userId;
  const role    = roleProp   ?? params.role ?? "customer";
  const isModal = !!onClose;

  const [searchParams] = useSearchParams();
  const paymentSuccess = searchParams.get("payment") === "success";

  const [task, setTask]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [successMsg, setSuccessMsg] = useState(
    paymentSuccess ? "Payment verified! Funds are now held in escrow." : ""
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        if (!taskId || taskId === "undefined") throw new Error("Invalid task ID");
        const res  = await fetch(`${API}/task/${taskId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Task not found");
        setTask({ ...data, _id: String(data._id || data.id || taskId) });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [taskId]);

  const refresh = (updates) => setTask(prev => ({ ...prev, ...updates }));

  const sharedProps = { task, loading, error, taskId, role, userId, successMsg, setSuccessMsg, refresh, isModal, onClose };

  return (
    <>
      <style>{css}</style>
      {isModal ? (
        <div className="modal-backdrop" onClick={onClose}>
          <PaymentCard {...sharedProps} />
        </div>
      ) : (
        <div className="page-shell">
          <BookingNavbar />
          <div className="page-center">
            <PaymentCard {...sharedProps} />
          </div>
        </div>
      )}
    </>
  );
}

/* ── STYLES ── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

  /* ── Brand palette: cream · orange · white ── */
  :root {
    --font-ui:   'DM Sans', system-ui, sans-serif;
    --font-mono: 'DM Mono', monospace;

    /* Surfaces */
    --clr-bg:           #ffffff;       /* card, inputs */
    --clr-bg-secondary: #FFF8EE;       /* inset sections, rows */
    --clr-bg-tertiary:  #f2ede4;       /* page background, deeper tint */

    /* Brand orange */
    --clr-orange:       #F6AD56;       /* primary accent */
    --clr-orange-dark:  #C97B1A;       /* text on orange bg, hover */
    --clr-orange-light: #F9FAFC;       /* very light tint */

    /* Borders */
    --clr-border:       rgba(246,173,86,0.20);
    --clr-border-md:    rgba(246,173,86,0.35);

    /* Text */
    --clr-text-primary:   #3D2000;     /* dark warm brown — readable on cream */
    --clr-text-secondary: #7A4F1A;     /* medium warm brown */
    --clr-text-muted:     #B07D45;     /* muted warm */

    /* Status tints — kept warm to match palette */
    --clr-green-bg:   #F0FBF4; --clr-green-text: #1A5C35; --clr-green-mid: #27AE60;
    --clr-amber-bg:   #FFF8EE; --clr-amber-text: #7A4F1A;
    --clr-purple-bg:  #F8F4FF; --clr-purple-text: #5B21B6; --clr-purple-mid: #7C3AED;
    --clr-red-bg:     #FFF4F4; --clr-red-text:   #9B1C1C;

    /* Payment buttons */
    --clr-esewa:  #059669;
    --clr-khalti: #5C2D91;

    /* Pills — warm tones */
    --pill-green-bg:   #EAF7EF; --pill-green-text:  #1A5C35;
    --pill-blue-bg:    #EEF4FF; --pill-blue-text:   #1E40AF;
    --pill-amber-bg:   #FFF8EE; --pill-amber-text:  #7A4F1A;
    --pill-purple-bg:  #F5F0FF; --pill-purple-text: #5B21B6;
    --pill-red-bg:     #FFF1F2; --pill-red-text:    #9B1C1C;
    --pill-gray-bg:    #FFF8EE; --pill-gray-text:   #7A4F1A;

    /* Fluid sizing */
    --card-max:  clamp(360px, 90vw, 560px);
    --card-pad:  clamp(16px, 3vw, 28px);
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 20px;

    /* Fluid type */
    --text-xs:   clamp(10px, 1.1vw, 12px);
    --text-sm:   clamp(12px, 1.3vw, 14px);
    --text-base: clamp(13px, 1.5vw, 15px);
    --text-lg:   clamp(15px, 1.8vw, 18px);
    --text-xl:   clamp(20px, 2.5vw, 28px);
    --text-2xl:  clamp(28px, 4vw, 42px);
  }

  /* ── Shell ── */
  .page-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--clr-bg-tertiary);
    font-family: var(--font-ui);
  }
  .page-center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(20px, 4vw, 48px) clamp(12px, 3vw, 24px);
  }
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(12px, 3vw, 24px);
    font-family: var(--font-ui);
  }

  /* ── Card ── */
  .payment-card {
    background: var(--clr-bg);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: var(--card-max);
    border: 0.5px solid var(--clr-border-md);
    animation: fadeUp .3s cubic-bezier(0.16,1,0.3,1) both;
    overflow: hidden;
  }

  .card-header {
    padding: var(--card-pad);
    border-bottom: 0.5px solid var(--clr-border);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .card-header-left { flex: 1; min-width: 0; }
  .card-header-right {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    flex-shrink: 0;
  }
  .card-role-label {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--clr-text-muted);
  }
  .card-title {
    margin: 4px 0 0;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--clr-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card-address {
    margin: 3px 0 0;
    font-size: var(--text-sm);
    color: var(--clr-text-secondary);
  }
  .pill-stack {
    display: flex;
    flex-direction: column;
    gap: 5px;
    align-items: flex-end;
  }

  /* ── Pill ── */
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 99px;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .pill-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ── Close button ── */
  .close-btn {
    width: clamp(28px, 3vw, 34px);
    height: clamp(28px, 3vw, 34px);
    border-radius: 50%;
    background: var(--clr-bg-secondary);
    border: 0.5px solid var(--clr-border);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--clr-text-secondary);
    font-size: var(--text-lg);
    font-weight: 500;
    margin-top: 2px;
  }

  /* ── Card body ── */
  .card-body { padding: var(--card-pad); }

  /* ── Loading ── */
  .loading-state {
    text-align: center;
    padding: clamp(24px, 5vw, 48px) 0;
  }
  .loading-text {
    margin: 12px 0 0;
    color: var(--clr-text-secondary);
    font-size: var(--text-sm);
  }

  /* ── Error block ── */
  .error-block {
    border-left: 3px solid var(--clr-red-text);
    padding-left: 14px;
  }
  .error-block-title { margin: 0; font-weight: 600; color: var(--clr-red-text); font-size: var(--text-base); }
  .error-block-sub   { margin: 4px 0 0; font-size: var(--text-xs); color: var(--clr-text-muted); }

  /* ── Success banner ── */
  .success-banner {
    background: var(--clr-green-bg);
    border: 0.5px solid var(--clr-green-mid);
    border-radius: var(--radius-md);
    padding: 12px 16px;
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 16px;
  }
  .success-icon { font-size: 16px; }
  .success-text { margin: 0; font-weight: 600; color: var(--clr-green-text); font-size: var(--text-sm); }

  /* ── Panel title ── */
  .panel-title {
    margin: 0 0 clamp(12px, 2vw, 20px);
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--clr-text-primary);
  }

  /* ── Amount badge ── */
  .amount-badge {
    background: rgba(246,173,86,0.10);
    border: none;
    border-radius: var(--radius-md);
    padding: clamp(12px, 2.5vw, 22px) clamp(14px, 2.5vw, 24px);
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: clamp(14px, 2vw, 20px);
  }
  .amount-label {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: 600;
    color: rgba(61,32,0,0.65);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .amount-value {
    margin: 4px 0 0;
    font-size: var(--text-xl);
    font-weight: 600;
    color: #3D2000;
    font-family: var(--font-mono);
  }
  .amount-icon {
    width: clamp(36px, 4vw, 48px);
    height: clamp(36px, 4vw, 48px);
    border-radius: var(--radius-sm);
    background: rgba(255,255,255,0.30);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: clamp(16px, 2vw, 22px);
  }

  /* ── Info rows ── */
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: clamp(7px, 1vw, 10px) 0;
    border-bottom: 0.5px solid var(--clr-border);
  }
  .info-key {
    font-size: var(--text-xs);
    font-weight: 600;
    color: black;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .info-val {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--clr-text-primary);
    text-align: right;
    max-width: 60%;
  }

  /* ── Divider ── */
  .divider {
    height: 0.5px;
    background: var(--clr-border);
    margin: clamp(14px, 2vw, 20px) 0;
  }

  /* ── Escrow notice ── */
  .escrow-notice {
    background: rgb(231, 250, 237);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    margin-bottom: clamp(14px, 2vw, 20px);
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .notice-icon { font-size: 14px; margin-top: 1px; }
  .notice-text { margin: 0; font-size: var(--text-sm); color: var(--clr-text-green); line-height: 1.5; }

  /* ── Method label ── */
  .method-label {
    margin: 0 0 clamp(10px, 1.5vw, 14px);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--clr-text-muted);
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ── Buttons ── */
  .btn {
    width: 100%;
    padding: clamp(12px, 1.8vw, 16px) 20px;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: var(--font-ui);
    transition: opacity .15s, transform .1s;
    margin-bottom: 10px;
  }
  .btn:active:not(:disabled) { transform: scale(0.98); }
  .btn--disabled { opacity: 0.45; cursor: not-allowed; }

  .btn-esewa {
    background: var(--clr-esewa);
    color: #fff;
  }
  .btn-esewa:hover:not(:disabled) { opacity: 0.9; }

  .btn-khalti {
    background: var(--clr-khalti);
    color: #fff;
  }
  .btn-khalti:hover:not(:disabled) { opacity: 0.9; }

  .esewa-icon {
    font-size: 16px;
    font-weight: 600;
    font-family: serif;
    color: #fff;
    letter-spacing: -0.5px;
  }

  /* ── Error msg ── */
  .error-msg {
    margin: 0 0 12px;
    padding: 10px 14px;
    background: var(--clr-red-bg);
    border: 0.5px solid var(--clr-red-text);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--clr-red-text);
  }

  /* ── Spinner ── */
  .spinner {
    display: inline-block;
    width: 15px;
    height: 15px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin .7s linear infinite;
    flex-shrink: 0;
  }
  .spinner--lg {
    width: clamp(24px, 3vw, 32px);
    height: clamp(24px, 3vw, 32px);
    border: 3px solid var(--clr-border-md);
    border-top-color: var(--clr-orange);
    margin: 0 auto;
  }

  /* ── Status box ── */
  .status-box {
    display: flex;
    gap: clamp(10px, 2vw, 16px);
    align-items: flex-start;
    margin-bottom: clamp(16px, 2.5vw, 24px);
  }
  .icon-circle {
    width: clamp(36px, 5vw, 52px);
    height: clamp(36px, 5vw, 52px);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: clamp(16px, 2.5vw, 22px);
    flex-shrink: 0;
  }
  .icon-amber  { background: var(--clr-amber-bg);  color: var(--clr-amber-text); }
  .icon-purple { background: var(--clr-purple-bg); color: var(--clr-purple-text); }
  .status-title {
    margin: 0;
    font-weight: 600;
    font-size: var(--text-base);
    color: var(--clr-text-primary);
  }
  .status-sub {
    margin: 4px 0 0;
    font-size: var(--text-sm);
    color: var(--clr-text-secondary);
    line-height: 1.55;
  }

  /* ── Timeline ── */
  .timeline {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 1.2vw, 12px);
    padding-left: 8px;
    border-left: 1.5px solid var(--clr-border);
    margin-left: 8px;
    padding-top: 4px;
  }
  .timeline-step { display: flex; align-items: center; gap: 10px; }
  .timeline-dot {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1.5px solid var(--clr-border-md);
    background: var(--clr-bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
  }
  .timeline-dot--done   { background: var(--clr-green-mid); border-color: var(--clr-green-mid); color: #fff; }
  .timeline-dot--active { background: var(--clr-purple-bg); border-color: var(--clr-purple-mid); }
  .timeline-pulse {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--clr-purple-mid); display: block;
  }
  .timeline-label {
    font-size: var(--text-sm);
    font-weight: 400;
    color: var(--clr-text-muted);
  }
  .timeline-label--done   { font-weight: 600; color: var(--clr-green-text); }
  .timeline-label--active { font-weight: 600; color: var(--clr-purple-text); }

  /* ── Release badge ── */
  .release-badge {
    background: var(--clr-orange);
    border: none;
    border-radius: var(--radius-md);
    padding: clamp(14px, 2vw, 20px);
    margin-bottom: clamp(14px, 2vw, 20px);
    display: flex;
    gap: 14px;
    align-items: center;
  }
  .release-icon { font-size: clamp(22px, 3vw, 32px); }
  .release-amount {
    margin: 0;
    font-weight: 600;
    color: #3D2000;
    font-size: var(--text-lg);
    font-family: var(--font-mono);
  }
  .release-sub {
    margin: 2px 0 0;
    font-size: var(--text-sm);
    color: rgba(61,32,0,0.70);
  }

  /* ── Confirm checkbox ── */
  .confirm-label {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: clamp(14px, 2vw, 20px);
    cursor: pointer;
    padding: clamp(10px, 1.5vw, 14px) clamp(12px, 1.5vw, 16px);
    background: var(--clr-bg-secondary);
    border-radius: var(--radius-md);
    border: 0.5px solid var(--clr-border);
    transition: border-color .15s;
  }
  .confirm-label--checked { border-color: var(--clr-orange); }
  .confirm-checkbox {
    margin-top: 2px;
    width: 16px;
    height: 16px;
    accent-color: var(--clr-orange-dark);
    cursor: pointer;
    flex-shrink: 0;
  }
  .confirm-text { font-size: var(--text-sm); color: var(--clr-text-primary); line-height: 1.55; }

  /* ── Done view ── */
  .done-view { text-align: center; padding: clamp(24px, 5vw, 48px) 0; }
  .done-icon  { font-size: clamp(40px, 6vw, 64px); margin-bottom: 16px; }
  .done-title {
    margin: 0;
    font-weight: 600;
    font-size: var(--text-lg);
    color: var(--clr-text-primary);
  }
  .done-sub {
    margin: 8px 0 0;
    font-size: var(--text-sm);
    color: var(--clr-text-secondary);
  }

  /* ── Back button ── */
  .back-btn {
    margin-top: clamp(14px, 2.5vw, 24px);
    padding: clamp(10px, 1.5vw, 12px) 16px;
    width: 100%;
    border-radius: var(--radius-md);
    border: 0.5px solid var(--clr-border-md);
    background: var(--clr-bg);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--clr-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: var(--font-ui);
    transition: background .15s;
  }
  .back-btn:hover { background: var(--clr-bg-secondary); }

  /* ── TV / large screen tweaks ── */
  @media (min-width: 1600px) {
    :root {
      --card-max: clamp(520px, 35vw, 720px);
    }
  }
  @media (min-width: 2400px) {
    :root {
      --card-max: clamp(640px, 30vw, 880px);
    }
  }
`;