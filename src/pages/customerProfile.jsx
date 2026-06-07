import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BookingNavbar from "../components/NavBar/NavBar";
import {
  getCustomer, getCustomerTasks, getCustomerReports, getCustomerReviews,
  updateName, updateAddress, updateDob, updateGender, updateBio,
  updatePhoto, releaseEscrow, postReport,
} from "../api/api";
import ChatWidget from "../components/HelpSection/HelpSection";

/* ─── TOKENS ─────────────────────────────────────────────── */
const C = {
  orange:       "#f6ad56",
  orangeDark:   "#e59a3d",
  orangeDeep:   "#c97c20",
  orangeLight:  "#fff7ed",
  orangeBorder: "#fde8c8",
  bg:           "#f8f5f0",
  surface:      "#ffffff",
  border:       "#e2e8f0",
  divider:      "#f1f5f9",
  text:         "#0f172a",
  textMid:      "#475569",
  textLight:    "#94a3b8",
  green:        "#10b981",
  greenLight:   "#ecfdf5",
  greenBorder:  "#a7f3d0",
  red:          "#ef4444",
  redLight:     "#fef2f2",
  redBorder:    "#fecaca",
  blue:         "#3b82f6",
  blueLight:    "#eff6ff",
  blueBorder:   "#bfdbfe",
  purple:       "#8b5cf6",
  purpleLight:  "#f5f3ff",
  purpleBorder: "#ddd6fe",
};

/* ─── HELPERS ─────────────────────────────────────────────── */
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

const fmtMonth = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";

const REPORT_REASONS = [
  "No show", "Poor quality work", "Rude or unprofessional behavior",
  "Damaged property", "Overcharged", "Fraud or scam", "Harassment", "Other",
];

const REFUND_LABELS = {
  refund_in_progress: "Refund in progress",
  refunded:           "Refunded",
  no_refund:          "No refund issued",
};

/* ─── SHARED ──────────────────────────────────────────────── */
const inputSx = {
  width: "100%", padding: "9px 13px", borderRadius: 8, fontSize: 13.5,
  border: `1.5px solid ${C.border}`, outline: "none", background: "#fafbfc",
  color: C.text, fontFamily: "inherit", boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const EmptyState = ({ title, sub }) => (
  <div style={{ padding: "56px 24px", textAlign: "center" }}>
    <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.orangeLight, border: `1.5px solid ${C.orangeBorder}`, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.orange }} />
    </div>
    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, color: C.textLight, lineHeight: 1.75, maxWidth: 300, margin: "0 auto" }}>{sub}</div>
  </div>
);

const Toast = ({ toast }) => toast ? (
  <div style={{
    position: "fixed", top: 20, right: 20, zIndex: 9999,
    background: toast.ok ? "#065f46" : "#7f1d1d",
    color: "white", padding: "13px 20px", borderRadius: 12,
    fontSize: 13.5, fontWeight: 500,
    boxShadow: "0 10px 32px rgba(0,0,0,0.2)",
    display: "flex", alignItems: "center", gap: 10,
    animation: "slideIn 0.22s ease",
  }}>
    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.5)", flexShrink: 0 }} />
    {toast.msg}
  </div>
) : null;

/* ─── TOGGLE SWITCH ──────────────────────────────────────── */
const Toggle = ({ checked, onChange, disabled = false }) => (
  <div
    onClick={() => !disabled && onChange(!checked)}
    style={{
      width: 44, height: 24, borderRadius: 12, flexShrink: 0,
      background: checked ? C.orange : C.border,
      position: "relative", cursor: disabled ? "not-allowed" : "pointer",
      transition: "background 0.2s",
      opacity: disabled ? 0.5 : 1,
    }}
  >
    <div style={{
      position: "absolute", top: 3, left: checked ? 23 : 3,
      width: 18, height: 18, borderRadius: "50%", background: "white",
      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      transition: "left 0.2s",
    }} />
  </div>
);

/* ─── REPORT STATUS HELPERS ───────────────────────────────── */
function reportStatusStyle(status) {
  if (status === "resolved") return { color: C.green,     bg: C.greenLight,  border: C.greenBorder,  label: "Resolved"     };
  if (status === "declined") return { color: C.red,       bg: C.redLight,    border: C.redBorder,    label: "Declined"     };
  return                            { color: C.orangeDeep, bg: C.orangeLight, border: C.orangeBorder, label: "Under Review" };
}

/* ─── REPORT DETAIL MODAL ─────────────────────────────────── */
function ReportDetailModal({ report: r, onClose }) {
  const s = reportStatusStyle(r.status);
  const refundLabel = REFUND_LABELS[r.refundStatus] || (r.refundStatus ? r.refundStatus.replace(/_/g, " ") : null);

  const refundColor =
    r.refundStatus === "refunded"          ? { color: C.green,  bg: C.greenLight,  border: C.greenBorder  } :
    r.refundStatus === "refund_in_progress"? { color: C.blue,   bg: C.blueLight,   border: C.blueBorder   } :
    r.refundStatus === "no_refund"         ? { color: C.red,    bg: C.redLight,    border: C.redBorder    } :
                                             { color: C.textMid, bg: C.divider,    border: C.border       };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(6px)",
        zIndex: 1000, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div style={{
        background: C.surface, borderRadius: 18, width: "100%", maxWidth: 520,
        boxShadow: "0 30px 80px rgba(0,0,0,0.22)", overflow: "hidden",
        maxHeight: "90vh", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          padding: "22px 26px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
              Report Details
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 10 }}>{r.reason}</div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
              background: s.bg, color: s.color, border: `1px solid ${s.border}`,
            }}>
              {s.label}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)",
              fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", fontFamily: "inherit", flexShrink: 0,
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 0 }}>

            {/* Description */}
            <Section label="Description">
              <p style={{ fontSize: 13.5, color: C.textMid, lineHeight: 1.75, margin: 0 }}>{r.description}</p>
            </Section>

            <Divider />

            {/* Evidence */}
            {r.evidenceUrl && (
              <>
                <Section label="Evidence Photo">
                  <div style={{ marginTop: 8, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
                    <img
                      src={r.evidenceUrl}
                      alt="Evidence"
                      style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }}
                      onError={e => { e.target.parentElement.style.display = "none"; }}
                    />
                  </div>
                </Section>
                <Divider />
              </>
            )}

            {/* Two-col: worker + task */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, padding: "18px 0" }}>
              <Section label="Reported Worker">
                <span style={{ fontSize: 13.5, color: C.text, wordBreak: "break-all" }}>{r.reportedId}</span>
              </Section>
              <Section label="Task ID">
                <span style={{
                  fontFamily: "monospace", fontSize: 11.5, color: C.textMid,
                  background: C.divider, padding: "3px 8px", borderRadius: 6,
                  border: `1px solid ${C.border}`, display: "inline-block",
                }}>
                  {r.taskId ? `…${r.taskId.slice(-8).toUpperCase()}` : "—"}
                </span>
              </Section>
            </div>

            <Divider />

            {/* Dates */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, padding: "18px 0" }}>
              <Section label="Filed On">
                <span style={{ fontSize: 13.5, color: C.text }}>{fmtDateTime(r.createdAt)}</span>
              </Section>
              {r.resolvedAt && (
                <Section label="Resolved On">
                  <span style={{ fontSize: 13.5, color: C.text }}>{fmtDateTime(r.resolvedAt)}</span>
                </Section>
              )}
            </div>

            {/* Refund status */}
            {r.refundStatus && (
              <>
                <Divider />
                <Section label="Refund Status" style={{ padding: "18px 0" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "6px 14px", borderRadius: 20, fontSize: 12.5, fontWeight: 600,
                      background: refundColor.bg, color: refundColor.color,
                      border: `1px solid ${refundColor.border}`,
                      alignSelf: "flex-start",
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: refundColor.color, display: "inline-block" }} />
                      {refundLabel}
                    </span>
                    {r.refund_id && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.textLight }}>Refund ID</span>
                        <span style={{
                          fontFamily: "monospace", fontSize: 11, color: C.textMid,
                          background: C.divider, padding: "2px 8px", borderRadius: 6,
                          border: `1px solid ${C.border}`,
                        }}>
                          {r.refund_id}
                        </span>
                      </div>
                    )}
                  </div>
                </Section>
              </>
            )}

            {/* Admin note */}
            {r.adminNote && (
              <>
                <Divider />
                <Section label="Response from Kaam-ly" style={{ padding: "18px 0" }}>
                  <div style={{
                    marginTop: 8, padding: "12px 16px", background: C.bg,
                    borderRadius: 10, border: `1px solid ${C.border}`,
                  }}>
                    <p style={{ fontSize: 13.5, color: C.textMid, lineHeight: 1.7, margin: 0 }}>{r.adminNote}</p>
                  </div>
                </Section>
              </>
            )}

            <Divider />

            {/* Report ID */}
            <div style={{ padding: "16px 0 4px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 6 }}>
                Report ID
              </div>
              <span style={{
                fontFamily: "monospace", fontSize: 11.5, color: C.textMid,
                background: C.divider, padding: "4px 10px", borderRadius: 6,
                border: `1px solid ${C.border}`, display: "inline-block", wordBreak: "break-all",
              }}>
                {r._id}
              </span>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 26px", borderTop: `1px solid ${C.divider}`, flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "12px", borderRadius: 10,
              background: "none", color: C.textMid,
              border: `1.5px solid ${C.border}`, fontSize: 13.5,
              cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── TINY LAYOUT HELPERS ─────────────────────────────────── */
const Section = ({ label, children, style = {} }) => (
  <div style={{ padding: "18px 0", ...style }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 6 }}>
      {label}
    </div>
    {children}
  </div>
);

const Divider = () => (
  <div style={{ height: 1, background: C.divider, margin: "0" }} />
);

/* ─── COMPLAINT MODAL ─────────────────────────────────────── */
function ComplaintModal({ task, customerId, onClose, onDone }) {
  const [reason,      setReason]      = useState("");
  const [description, setDescription] = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const submit = async () => {
    if (!reason) { setError("Please select a reason."); return; }
    setSaving(true);
    try {
      const res = await postReport({
        reporterId: customerId, reporterType: "customer",
        reportedId: task?.assignedWorkerId || "", reportedType: "worker",
        reason, description, taskId: task?._id || task?.id || null,
      });
      if (!res.ok) throw new Error();
      onDone();
    } catch { setError("Submission failed. Please try again."); }
    finally  { setSaving(false); }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.surface, borderRadius: 18, width: "100%", maxWidth: 460, boxShadow: "0 30px 80px rgba(0,0,0,0.22)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)", padding: "24px 28px" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>File a Complaint</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{task ? (task.selectedService || task.taskType) : "General Report"}</div>
        </div>
        <div style={{ padding: "26px 28px" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>Select Reason</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {REPORT_REASONS.map(r => (
                <button key={r} onClick={() => setReason(r)}
                  style={{ padding: "6px 13px", borderRadius: 20, cursor: "pointer", fontSize: 12.5, fontWeight: reason === r ? 600 : 400,
                    border: `1.5px solid ${reason === r ? C.red : C.border}`,
                    background: reason === r ? C.redLight : C.surface,
                    color: reason === r ? C.red : C.textMid, fontFamily: "inherit" }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 8 }}>Description</div>
            <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 500))} rows={4}
              placeholder="What happened? Please provide details…"
              style={{ ...inputSx, resize: "none", lineHeight: 1.75 }} />
            <div style={{ fontSize: 11, color: C.textLight, marginTop: 4, textAlign: "right" }}>{description.length}/500</div>
          </div>
          {error && <div style={{ fontSize: 12.5, color: C.red, marginBottom: 14, padding: "9px 13px", background: C.redLight, borderRadius: 8, border: `1px solid ${C.redBorder}` }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={submit} disabled={saving}
              style={{ flex: 1, padding: "12px", borderRadius: 10, background: C.red, color: "white", border: "none", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.75 : 1, fontFamily: "inherit" }}>
              {saving ? "Submitting…" : "Submit Report"}
            </button>
            <button onClick={onClose}
              style={{ padding: "12px 20px", borderRadius: 10, background: "none", color: C.textMid, border: `1.5px solid ${C.border}`, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── DELETE ACCOUNT MODAL ───────────────────────────────── */
function DeleteAccountModal({ onClose, onConfirm }) {
  const [input, setInput] = useState("");
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.surface, borderRadius: 18, width: "100%", maxWidth: 420, boxShadow: "0 30px 80px rgba(0,0,0,0.22)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)", padding: "24px 28px" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Delete Account</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>This action is permanent and cannot be undone.</div>
        </div>
        <div style={{ padding: "26px 28px" }}>
          <div style={{ padding: "14px", background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 10, marginBottom: 20, fontSize: 13, color: "#7f1d1d", lineHeight: 1.65 }}>
            All your bookings, payment history, and reviews will be permanently removed. Active escrow payments may be forfeited.
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12.5, color: C.textMid, marginBottom: 8 }}>Type <strong>DELETE</strong> to confirm:</div>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="DELETE" style={{ ...inputSx }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => input === "DELETE" && onConfirm()} disabled={input !== "DELETE"}
              style={{ flex: 1, padding: "12px", borderRadius: 10, background: input === "DELETE" ? C.red : C.border, color: input === "DELETE" ? "white" : C.textLight, border: "none", fontSize: 14, fontWeight: 600, cursor: input === "DELETE" ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "all 0.15s" }}>
              Delete My Account
            </button>
            <button onClick={onClose}
              style={{ padding: "12px 20px", borderRadius: 10, background: "none", color: C.textMid, border: `1.5px solid ${C.border}`, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CHANGE PASSWORD MODAL ──────────────────────────────── */
function ChangePasswordModal({ onClose, onSave }) {
  const [current,  setCurrent]  = useState("");
  const [next,     setNext]     = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  const submit = async () => {
    if (!current || !next || !confirm) { setError("All fields are required."); return; }
    if (next.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (next !== confirm) { setError("Passwords do not match."); return; }
    setSaving(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      onSave();
    } catch { setError("Failed to update password. Please try again."); }
    finally  { setSaving(false); }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.surface, borderRadius: 18, width: "100%", maxWidth: 420, boxShadow: "0 30px 80px rgba(0,0,0,0.22)", overflow: "hidden" }}>
        <div style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, padding: "24px 28px" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Change Password</div>
        </div>
        <div style={{ padding: "26px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { label: "Current Password", val: current, set: setCurrent },
            { label: "New Password",     val: next,    set: setNext    },
            { label: "Confirm Password", val: confirm,  set: setConfirm },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textLight, marginBottom: 7 }}>{f.label}</div>
              <input type="password" value={f.val} onChange={e => f.set(e.target.value)} style={{ ...inputSx }} />
            </div>
          ))}
          {error && <div style={{ fontSize: 12.5, color: C.red, padding: "9px 13px", background: C.redLight, borderRadius: 8, border: `1px solid ${C.redBorder}` }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={submit} disabled={saving}
              style={{ flex: 1, padding: "12px", borderRadius: 10, background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`, color: "white", border: "none", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.75 : 1, fontFamily: "inherit" }}>
              {saving ? "Saving…" : "Update Password"}
            </button>
            <button onClick={onClose}
              style={{ padding: "12px 20px", borderRadius: 10, background: "none", color: C.textMid, border: `1.5px solid ${C.border}`, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN ───────────────────────────────────────────────── */
export default function CustomerProfile() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const fileRef  = useRef();

  const [customer,        setCustomer]        = useState(null);
  const [tasks,           setTasks]           = useState([]);
  const [reports,         setReports]         = useState([]);
  const [reviews,         setReviews]         = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [tab,             setTab]             = useState("info");
  const [toast,           setToast]           = useState(null);
  const [complaintTask,   setComplaintTask]   = useState(undefined);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatar,          setAvatar]          = useState(null);
  const [releasingId,     setReleasingId]     = useState(null);
  const [editField,       setEditField]       = useState(null);
  const [fieldVal,        setFieldVal]        = useState("");
  const [fieldSaving,     setFieldSaving]     = useState(false);

  // ── NEW: selected report for detail modal ──
  const [selectedReport,  setSelectedReport]  = useState(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const [cRes, tRes, rRes, revRes] = await Promise.all([
          getCustomer(id), getCustomerTasks(id),
          getCustomerReports(id), getCustomerReviews(id),
        ]);
        if (!cRes.ok) throw new Error(`Could not load profile (${cRes.status})`);
        const c = await cRes.json();
        setCustomer(c);
        const photo = c.profilePhoto || c.avatar || c.profile_photo || c.profilePicture || c.profile_picture;
        if (photo) setAvatar(photo);
        if (tRes.ok)   { const t  = await tRes.json();   setTasks(Array.isArray(t) ? t : t.tasks ?? []); }
        if (rRes.ok)   { const r  = await rRes.json();   setReports(Array.isArray(r) ? r : r.reports ?? []); }
        if (revRes.ok) { const rv = await revRes.json(); setReviews(Array.isArray(rv) ? rv : rv.reviews ?? []); }
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const startEdit = (field, val) => {
    setEditField(field);
    setFieldVal(val || "");
  };

  const saveField = async () => {
    setFieldSaving(true);
    try {
      let res;
      if (editField === "name") {
        const parts     = fieldVal.trim().split(" ");
        const firstName = parts[0] || "";
        const lastName  = parts.slice(1).join(" ") || "";
        res = await updateName(id, firstName, lastName);
        if (res.ok) setCustomer(p => ({ ...p, first_name: firstName, firstName, last_name: lastName, lastName }));
      } else if (editField === "address") {
        res = await updateAddress(id, fieldVal);
        if (res.ok) setCustomer(p => ({ ...p, address: fieldVal }));
      } else if (editField === "dob") {
        res = await updateDob(id, fieldVal);
        if (res.ok) setCustomer(p => ({ ...p, dob: fieldVal, dateOfBirth: fieldVal }));
      } else if (editField === "gender") {
        res = await updateGender(id, fieldVal);
        if (res.ok) setCustomer(p => ({ ...p, gender: fieldVal }));
      } else if (editField === "bio") {
        res = await updateBio(id, fieldVal);
        if (res.ok) setCustomer(p => ({ ...p, bio: fieldVal, description: fieldVal }));
      }
      if (!res || !res.ok) throw new Error();
      setEditField(null);
      showToast("Changes saved.");
    } catch {
      showToast("Failed to save. Try again.", false);
    } finally {
      setFieldSaving(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => setAvatar(ev.target.result);
    r.readAsDataURL(file);
    setAvatarUploading(true);
    try {
      const res = await updatePhoto(id, file);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.photo_url) setAvatar(data.photo_url);
      showToast("Photo updated.");
    } catch {
      showToast("Upload failed.", false);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRelease = async (task) => {
    const tid = task._id || task.id;
    const confirmed = window.confirm(
      `Release NPR ${(task.final_price || task.totalCost || 0).toLocaleString()} to the worker?\n\nOnly do this if you are satisfied with the work.`
    );
    if (!confirmed) return;
    setReleasingId(tid);
    try {
      const res = await releaseEscrow(tid);
      if (!res.ok) throw new Error();
      setTasks(prev => prev.map(t =>
        (t._id || t.id) === tid
          ? { ...t, escrow_status: "released", payment_status: "paid", status: "paid" }
          : t
      ));
      showToast("Payment released to worker.");
    } catch {
      showToast("Failed to release payment.", false);
    } finally {
      setReleasingId(null);
    }
  };

  /* ── Derived ── */
  const firstName = customer?.firstName  || customer?.first_name  || "";
  const lastName  = customer?.lastName   || customer?.last_name   || "";
  const fullName  = `${firstName} ${lastName}`.trim() || "—";
  const email     = customer?.email      || "";
  const phone     = customer?.phoneNo    || customer?.phone       || "";
  const bio       = customer?.bio        || customer?.description || "";
  const address   = customer?.address   || "";
  const dob       = customer?.dob        || customer?.dateOfBirth || "";
  const gender    = customer?.gender     || "";
  const joinedAt  = customer?.joinedAt   || customer?.createdAt   || "";
  const initials  = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase() || "?";

  const completedTasks  = tasks.filter(t => ["completed", "paid"].includes(t.status));
  const paidTasks       = tasks.filter(t => t.payment_status === "paid" || t.status === "paid");
  const pendingPayTasks = tasks.filter(t => ["assigned", "worker_done"].includes(t.status) && t.payment_status !== "paid");
  const escrowTasks     = tasks.filter(t => t.status === "worker_done" && t.escrow_status === "held");
  const totalPaid       = paidTasks.reduce((s, t) => s + (t.final_price || t.totalCost || 0), 0);
  const totalPending    = pendingPayTasks.reduce((s, t) => s + (t.final_price || t.totalCost || 0), 0);
  const totalEscrow     = escrowTasks.reduce((s, t) => s + (t.final_price || t.totalCost || 0), 0);
  const avgRating       = reviews.length
    ? (reviews.reduce((s, r) => s + (r.rating || r.stars || 0), 0) / reviews.length).toFixed(1)
    : null;

  const TABS = [
    { key: "info",     label: "Account Info"                   },
    { key: "payments", label: "Payments"                       },
    { key: "reviews",  label: "Reviews",  count: reviews.length },
    { key: "reports",  label: "Reports",  count: reports.length },
  ];

  const infoRows = [
    { key: "name",    label: "Full Name",     value: fullName,                          rawVal: fullName, editable: true  },
    { key: "email",   label: "Email Address", value: email || "—",                      rawVal: email,    editable: false },
    { key: "phone",   label: "Phone Number",  value: phone || "Not added",              rawVal: phone,    editable: false },
    { key: "address", label: "Address",       value: address || "Not added",            rawVal: address,  editable: true  },
    { key: "dob",     label: "Date of Birth", value: dob ? fmtDate(dob) : "Not added", rawVal: dob,      editable: true  },
    { key: "gender",  label: "Gender",        value: gender  || "Not added",            rawVal: gender,   editable: true  },
    { key: "bio",     label: "Bio",           value: bio     || "Not added",            rawVal: bio,      editable: true  },
  ];

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "70vh", gap: 12, flexDirection: "column" }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.orangeBorder}`, borderTopColor: C.orange, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <div style={{ color: C.textLight, fontSize: 13 }}>Loading profile…</div>
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", gap: 12 }}>
      <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
      <button onClick={() => window.location.reload()} style={{ color: C.orangeDeep, background: C.orangeLight, border: `1.5px solid ${C.orangeBorder}`, borderRadius: 9, padding: "9px 20px", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Retry</button>
    </div>
  );

  return (
    <>
      <BookingNavbar />
      <ChatWidget/>
      <Toast toast={toast} />

      {/* ── Complaint / new report modal ── */}
      {complaintTask !== undefined && (
        <ComplaintModal
          task={complaintTask || null}
          customerId={id}
          onClose={() => setComplaintTask(undefined)}
          onDone={() => {
            setComplaintTask(undefined);
            showToast("Report submitted. We will review it shortly.");
            getCustomerReports(id)
              .then(r => r.ok && r.json())
              .then(r => r && setReports(Array.isArray(r) ? r : r.reports ?? []));
          }}
        />
      )}

      {/* ── Report detail modal ── */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        * { box-sizing: border-box; }
        .cp-root { font-family: 'DM Sans', -apple-system, sans-serif; }
        .cp-tab:hover  { background: ${C.orangeLight} !important; color: ${C.orangeDeep} !important; }
        .cp-photo:hover .cp-overlay { opacity: 1 !important; }
        .cp-edit:hover { background: ${C.orangeLight} !important; color: ${C.orangeDeep} !important; border-color: ${C.orange} !important; }
        .cp-row:hover  { background: ${C.orangeLight}66; }
        .cp-report-card { transition: background 0.12s, box-shadow 0.12s; }
        .cp-report-card:hover { background: ${C.orangeLight}88 !important; }
        input:focus, textarea:focus, select:focus { border-color: ${C.orange} !important; box-shadow: 0 0 0 3px ${C.orange}22 !important; outline: none; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
        .cp-panel { animation: fadeIn 0.18s ease; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
      `}</style>

      <div className="cp-root" style={{ background: C.bg, minHeight: "100vh", padding: "28px 32px 60px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", gap: 22, alignItems: "flex-start" }}>

          {/* ════════════ LEFT SIDEBAR ════════════ */}
          <div style={{ width: 272, flexShrink: 0, position: "sticky", top: 108 }}>
            <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>

              <div style={{ height: 76, background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px 22px" }}>
                <div className="cp-photo" style={{ position: "relative", cursor: "pointer", marginTop: -48 }} onClick={() => fileRef.current.click()}>
                  <div style={{ width: 96, height: 96, borderRadius: "50%", background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800, color: "white", overflow: "hidden", border: "3px solid white", boxShadow: `0 4px 20px ${C.orange}55` }}>
                    {avatar
                      ? <img src={avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : initials}
                  </div>
                  <div className="cp-overlay" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.42)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.18s", border: "3px solid white" }}>
                    {avatarUploading
                      ? <div style={{ width: 18, height: 18, border: "2.5px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                      : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 17, fontWeight: 700, color: C.text, textAlign: "center", lineHeight: 1.3 }}>{fullName}</div>
                {email && <div style={{ fontSize: 12.5, color: C.textLight, marginTop: 4, textAlign: "center" }}>{email}</div>}
                {joinedAt && <div style={{ fontSize: 11.5, color: C.textLight, marginTop: 2 }}>Member since {fmtMonth(joinedAt)}</div>}

                <button onClick={() => fileRef.current.click()} disabled={avatarUploading}
                  style={{ marginTop: 14, padding: "7px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.orangeDeep, background: C.orangeLight, border: `1.5px solid ${C.orangeBorder}`, cursor: avatarUploading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  {avatarUploading ? "Uploading…" : "Change Photo"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
              </div>

              <div style={{ height: 1, background: C.divider }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                {[
                  { label: "Bookings", value: tasks.length,          color: C.orange     },
                  { label: "Done",     value: completedTasks.length, color: C.green      },
                  { label: "Reviews",  value: reviews.length,        color: C.orangeDark },
                ].map((s, i) => (
                  <div key={s.label} style={{ textAlign: "center", padding: "16px 0", borderRight: i < 2 ? `1px solid ${C.divider}` : "none" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: C.textLight, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ height: 1, background: C.divider }} />
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { label: "Email",   value: email   || "—",        verified: true },
                  { label: "Phone",   value: phone   || "Not added"                },
                  { label: "Address", value: address || "Not added"                },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.orange, marginTop: 7, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{row.label}</div>
                      <div style={{ fontSize: 13, color: row.value === "Not added" || row.value === "—" ? C.textLight : C.text, fontStyle: row.value === "Not added" ? "italic" : "normal", wordBreak: "break-word", lineHeight: 1.5, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {row.value}
                        {row.verified && email && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: 10, padding: "1px 6px" }}>Verified</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {bio && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.orange, marginTop: 7, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Bio</div>
                      <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.65 }}>{bio}</div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ════════════ RIGHT PANEL ════════════ */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", overflow: "hidden" }}>

              {/* Tab bar */}
              <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, padding: "0 6px", background: "#fafaf9", gap: 2, overflowX: "auto" }}>
                {TABS.map(t => (
                  <button key={t.key} className="cp-tab" onClick={() => setTab(t.key)} style={{
                    padding: "14px 18px", background: "none", border: "none",
                    borderBottom: `2.5px solid ${tab === t.key ? C.orange : "transparent"}`,
                    cursor: "pointer", fontSize: 13.5, fontWeight: tab === t.key ? 700 : 500,
                    color: tab === t.key ? C.orangeDeep : C.textMid, fontFamily: "inherit",
                    whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 7,
                    marginBottom: -1, borderRadius: "6px 6px 0 0", transition: "color 0.15s, background 0.15s",
                  }}>
                    {t.label}
                    {t.count > 0 && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: tab === t.key ? C.orange : C.border, color: tab === t.key ? "white" : C.textMid, padding: "0 5px" }}>{t.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* ─── ACCOUNT INFO ─── */}
              {tab === "info" && (
                <div className="cp-panel">
                  <div style={{ padding: "20px 28px 12px", fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em" }}>
                    Personal Information
                  </div>
                  {infoRows.map((row, i, arr) => (
                    <div key={row.key}>
                      <div className="cp-row" style={{ padding: "15px 28px", display: "flex", alignItems: "center", gap: 16, transition: "background 0.12s" }}>
                        <div style={{ width: 136, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: C.textLight }}>{row.label}</div>
                        <div style={{ flex: 1 }}>
                          {editField === row.key ? (
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              {row.key === "bio" ? (
                                <textarea value={fieldVal} onChange={e => setFieldVal(e.target.value)} rows={3} autoFocus style={{ ...inputSx, flex: 1, resize: "vertical" }} />
                              ) : row.key === "dob" ? (
                                <input type="date" value={fieldVal} onChange={e => setFieldVal(e.target.value)} autoFocus style={{ ...inputSx, flex: 1 }} />
                              ) : row.key === "gender" ? (
                                <select value={fieldVal} onChange={e => setFieldVal(e.target.value)} autoFocus style={{ ...inputSx, flex: 1 }}>
                                  <option value="">Select gender</option>
                                  <option value="Male">Male</option>
                                  <option value="Female">Female</option>
                                  <option value="Non-binary">Non-binary</option>
                                  <option value="Prefer not to say">Prefer not to say</option>
                                </select>
                              ) : (
                                <input value={fieldVal} onChange={e => setFieldVal(e.target.value)} autoFocus style={{ ...inputSx, flex: 1 }} />
                              )}
                              <button onClick={saveField} disabled={fieldSaving}
                                style={{ padding: "9px 16px", borderRadius: 8, background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`, color: "white", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
                                {fieldSaving ? "…" : "Save"}
                              </button>
                              <button onClick={() => setEditField(null)}
                                style={{ width: 34, height: 34, borderRadius: 8, background: "none", border: `1.5px solid ${C.border}`, cursor: "pointer", color: C.textMid, fontSize: 16, fontFamily: "inherit" }}>✕</button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 13.5, color: (row.value === "Not added" || row.value === "—") ? C.textLight : C.text, fontStyle: row.value === "Not added" ? "italic" : "normal", display: "inline-flex", alignItems: "center", gap: 8 }}>
                              {row.value}
                              {row.key === "email" && email && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: 10, padding: "1px 7px" }}>Verified</span>
                              )}
                              {!row.editable && (
                                <span style={{ fontSize: 10, color: C.textLight, background: C.divider, border: `1px solid ${C.border}`, borderRadius: 10, padding: "1px 7px", fontWeight: 500 }}>
                                  Cannot be changed
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        {row.editable && editField !== row.key && (
                          <button className="cp-edit" onClick={() => startEdit(row.key, row.rawVal)}
                            style={{ fontSize: 12, color: C.textMid, background: "none", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "5px 14px", cursor: "pointer", fontFamily: "inherit", fontWeight: 500, transition: "all 0.15s", whiteSpace: "nowrap" }}>
                            {row.value === "Not added" ? "+ Add" : "Edit"}
                          </button>
                        )}
                      </div>
                      {i < arr.length - 1 && <div style={{ height: 1, background: C.divider, margin: "0 28px" }} />}
                    </div>
                  ))}
                  <div style={{ height: 14 }} />
                </div>
              )}

              {/* ─── PAYMENTS ─── */}
              {tab === "payments" && (
                <div className="cp-panel">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${C.border}` }}>
                    {[
                      { label: "Awaiting Payment", value: `NPR ${totalPending.toLocaleString()}`, color: C.orangeDeep, bg: "#fffdf8" },
                      { label: "In Escrow",        value: `NPR ${totalEscrow.toLocaleString()}`,  color: C.blue,       bg: "#f8fbff" },
                    ].map((s, i) => (
                      <div key={s.label} style={{ padding: "20px 24px", background: s.bg, borderRight: i < 1 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{s.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                 

                  {pendingPayTasks.length > 0 && (
                    <div style={{ borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ padding: "14px 24px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em" }}>Awaiting Payment</div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.orangeDeep, background: C.orangeLight, border: `1px solid ${C.orangeBorder}`, padding: "3px 10px", borderRadius: 20 }}>NPR {totalPending.toLocaleString()} due</span>
                      </div>
                      <div style={{ maxHeight: 220, overflowY: "auto" }}>
                        {pendingPayTasks.map((task, i) => {
                          const tid = task._id || task.id || i;
                          return (
                            <div key={tid} style={{ padding: "14px 24px", borderTop: i > 0 ? `1px solid ${C.divider}` : "none", display: "flex", alignItems: "center", gap: 14 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3 }}>{task.selectedService || task.taskType || "Service"}</div>
                                <div style={{ fontSize: 12, color: C.textLight }}>{fmtDate(task.serviceDate)}</div>
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: C.orangeDeep, flexShrink: 0 }}>NPR {(task.final_price || task.totalCost || 0).toLocaleString()}</div>
                              <button onClick={() => navigate(`/customer/pay/${tid}/${task.assignedWorkerId}/${id}/customer`)}
                                style={{ padding: "9px 18px", borderRadius: 9, border: "none", flexShrink: 0, background: C.orange, color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                Pay Now
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ padding: "14px 24px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em" }}>Payment History</div>
                    {paidTasks.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.green, background: C.greenLight, border: `1px solid ${C.greenBorder}`, padding: "3px 10px", borderRadius: 20 }}>{paidTasks.length} transaction{paidTasks.length > 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <div style={{ maxHeight: 340, overflowY: "auto", borderTop: `1px solid ${C.divider}` }}>
                    {paidTasks.length === 0 ? (
                      <EmptyState title="No payments yet" sub="Completed payments will show up here." />
                    ) : paidTasks.map((task, i) => {
                      const tid = task._id || task.id || i;
                      return (
                        <div key={tid} style={{ padding: "14px 24px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{task.selectedService || task.taskType || "Service"}</div>
                            <div style={{ fontSize: 12, color: C.textLight, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                              <span>{fmtDate(task.paid_at || task.updatedAt)}</span>
                              {task.payment_method && <span style={{ textTransform: "capitalize", background: C.divider, padding: "1px 8px", borderRadius: 10, fontWeight: 500 }}>{task.payment_method}</span>}
                              <span style={{ fontFamily: "monospace" }}>#{typeof tid === "string" ? tid.slice(-6).toUpperCase() : tid}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>NPR {(task.final_price || task.totalCost || 0).toLocaleString()}</div>
                            {task.additionalCost > 0 && <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>+NPR {task.additionalCost} extra</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ height: 16 }} />
                </div>
              )}

              {/* ─── REVIEWS ─── */}
              {tab === "reviews" && (
                <div className="cp-panel">
                  {reviews.length > 0 && avgRating && (
                    <div style={{ padding: "20px 28px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 20, background: C.orangeLight }}>
                      <div style={{ width: 1, height: 44, background: C.orangeBorder }} />
                      <div style={{ fontSize: 13.5, color: C.textMid, lineHeight: 1.8 }}>
                        You have reviewed <strong style={{ color: C.text }}>{reviews.length} worker{reviews.length > 1 ? "s" : ""}</strong>. Your feedback helps the community find great workers.
                      </div>
                    </div>
                  )}
                  {reviews.length === 0 ? (
                    <EmptyState title="No reviews yet" sub="After completing a booking, you can rate and review the worker." />
                  ) : reviews.map((rev, i) => {
                    const rid    = rev._id || rev.id || i;
                    const rating = rev.rating || rev.stars || 0;
                    return (
                      <div key={rid}>
                        {i > 0 && <div style={{ height: 1, background: C.divider, margin: "0 28px" }} />}
                        <div className="cp-row" style={{ padding: "18px 28px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>{rev.workerName || rev.selectedService || rev.taskType || "Service"}</div>
                              <div style={{ fontSize: 12, color: C.textLight }}>{fmtDate(rev.createdAt)}</div>
                            </div>
                            <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                              {[1,2,3,4,5].map(n => (
                                <span key={n} style={{ fontSize: 17, color: n <= rating ? C.orange : C.border, lineHeight: 1 }}>&#9733;</span>
                              ))}
                              <span style={{ marginLeft: 6, fontSize: 12.5, fontWeight: 700, color: C.orangeDeep }}>{rating}/5</span>
                            </div>
                          </div>
                          {rev.comment && <p style={{ margin: 0, fontSize: 13.5, color: C.textMid, lineHeight: 1.75 }}>{rev.comment}</p>}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ height: 12 }} />
                </div>
              )}

              {/* ─── REPORTS ─── */}
              {tab === "reports" && (
                <div className="cp-panel">
                  <div style={{ padding: "18px 28px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>Your Reports</div>
                      <div style={{ fontSize: 12.5, color: C.textLight }}>Click a report to view details. We review all reports promptly.</div>
                    </div>
                    <button onClick={() => setComplaintTask("")}
                      style={{ padding: "9px 20px", borderRadius: 9, background: C.redLight, color: C.red, border: `1.5px solid ${C.redBorder}`, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      + New Report
                    </button>
                  </div>

                  {reports.length === 0 ? (
                    <EmptyState title="No reports filed" sub="We hope everything is going smoothly with your bookings." />
                  ) : reports.map((r, i) => {
                    const rid = r._id || r.id || i;
                    const s   = reportStatusStyle(r.status);
                    const refundLabel = REFUND_LABELS[r.refundStatus];

                    return (
                      <div key={rid}>
                        {i > 0 && <div style={{ height: 1, background: C.divider, margin: "0 28px" }} />}

                        {/* ── Clickable report card ── */}
                        <div
                          className="cp-report-card"
                          onClick={() => setSelectedReport(r)}
                          style={{ padding: "18px 28px", cursor: "pointer" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.reason || "Report"}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, color: s.color,
                                background: s.bg, border: `1px solid ${s.border}`,
                                padding: "3px 10px", borderRadius: 20,
                              }}>
                                {s.label}
                              </span>
                              {/* chevron */}
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 18l6-6-6-6" />
                              </svg>
                            </div>
                          </div>

                          {r.description && (
                            <p style={{
                              margin: "0 0 10px", fontSize: 13.5, color: C.textMid, lineHeight: 1.7,
                              display: "-webkit-box", WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical", overflow: "hidden",
                            }}>
                              {r.description}
                            </p>
                          )}

                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 12, color: C.textLight }}>Filed {fmtDate(r.createdAt)}</div>
                            {refundLabel && (
                              <>
                                <div style={{ width: 3, height: 3, borderRadius: "50%", background: C.textLight }} />
                                <span style={{
                                  fontSize: 11.5, fontWeight: 600,
                                  color: r.refundStatus === "refunded" ? C.green : r.refundStatus === "no_refund" ? C.red : C.blue,
                                }}>
                                  {refundLabel}
                                </span>
                              </>
                            )}
                            {r.evidenceUrl && (
                              <>
                                <div style={{ width: 3, height: 3, borderRadius: "50%", background: C.textLight }} />
                                <span style={{ fontSize: 11.5, color: C.textLight, display: "flex", alignItems: "center", gap: 4 }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                  </svg>
                                  Evidence attached
                                </span>
                              </>
                            )}
                          </div>

                          {r.adminNote && (
                            <div style={{ marginTop: 12, padding: "10px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12.5, color: C.textMid, lineHeight: 1.6 }}>
                              <span style={{ fontWeight: 700, color: C.textLight, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>Response from Kaam-ly</span>
                              {r.adminNote}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ height: 12 }} />
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </>
  );
}