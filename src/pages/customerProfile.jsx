import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BookingNavbar from "../components/NavBar/NavBar";
import {
  getCustomer, getCustomerTasks, getCustomerReports, getCustomerReviews,
  updateName, updateAddress, updateDob, updateGender, updateBio,
  updatePhoto, releaseEscrow, postReport,
} from "../api/api";

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
};

/* ─── HELPERS ─────────────────────────────────────────────── */
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtMonth = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";

const REPORT_REASONS = [
  "No show", "Poor quality work", "Rude or unprofessional behavior",
  "Damaged property", "Overcharged", "Fraud or scam", "Harassment", "Other",
];

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

/* ─── SETTINGS SECTION WRAPPER ───────────────────────────── */
const SettingsSection = ({ title, subtitle, children, icon }) => (
  <div style={{ borderBottom: `1px solid ${C.border}` }}>
    <div style={{ padding: "18px 28px 12px", display: "flex", alignItems: "flex-start", gap: 12 }}>
      {icon && (
        <div style={{ width: 34, height: 34, borderRadius: 9, background: C.orangeLight, border: `1px solid ${C.orangeBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
          {icon}
        </div>
      )}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: C.textLight, marginTop: 2, lineHeight: 1.6 }}>{subtitle}</div>}
      </div>
    </div>
    <div style={{ padding: "0 28px 18px" }}>{children}</div>
  </div>
);

/* ─── SETTINGS ROW ───────────────────────────────────────── */
const SettingsRow = ({ label, sub, children, indent = false }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
    padding: "11px 0", borderBottom: `1px solid ${C.divider}`,
    marginLeft: indent ? 20 : 0,
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13.5, color: C.text, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: C.textLight, marginTop: 2, lineHeight: 1.55 }}>{sub}</div>}
    </div>
    <div style={{ flexShrink: 0 }}>{children}</div>
  </div>
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
      // Replace with your actual API call: await updatePassword(id, current, next)
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

/* ─── DEFAULT NOTIFICATION PREFS ─────────────────────────── */
const DEFAULT_NOTIF = {
  // Push notifications
  push_task_updates:    true,
  push_messages:        true,
  push_payment:         true,
  push_reminders:       true,
  push_promotions:      false,
  push_new_worker:      false,
  // Email notifications
  email_task_updates:   true,
  email_messages:       false,
  email_payment:        true,
  email_reminders:      true,
  email_promotions:     false,
  email_weekly_summary: true,
  // SMS notifications
  sms_task_updates:     false,
  sms_payment:          true,
  sms_reminders:        false,
};

/* ─── SETTINGS TAB COMPONENT ─────────────────────────────── */
function SettingsTab({ customerId, customer, showToast }) {
  // ── Notification state ──────────────────────────────────
  const [notif,         setNotif]         = useState(() => {
    try { return JSON.parse(localStorage.getItem(`notif_${customerId}`)) || DEFAULT_NOTIF; }
    catch { return DEFAULT_NOTIF; }
  });
  const [notifSaving,   setNotifSaving]   = useState(false);
  const [notifDirty,    setNotifDirty]    = useState(false);

  // ── Privacy state ────────────────────────────────────────
  const [privacy,       setPrivacy]       = useState(() => {
    try { return JSON.parse(localStorage.getItem(`privacy_${customerId}`)) || { profile_visible: true, show_reviews: true, show_activity: false }; }
    catch { return { profile_visible: true, show_reviews: true, show_activity: false }; }
  });

  // ── Security state ───────────────────────────────────────
  const [twoFactor,     setTwoFactor]     = useState(false);
  const [loginAlerts,   setLoginAlerts]   = useState(true);

  // ── Appearance state ─────────────────────────────────────
  const [language,      setLanguage]      = useState("en");
  const [timezone,      setTimezone]      = useState("Asia/Kathmandu");
  const [currency,      setCurrency]      = useState("NPR");

  // ── Modals ───────────────────────────────────────────────
  const [showPwModal,   setShowPwModal]   = useState(false);
  const [showDelModal,  setShowDelModal]  = useState(false);

  const setN = (key, val) => {
    setNotif(p => ({ ...p, [key]: val }));
    setNotifDirty(true);
  };

  const saveNotifications = async () => {
    setNotifSaving(true);
    try {
      // Persist locally (replace with API call as needed)
      await new Promise(r => setTimeout(r, 600));
      localStorage.setItem(`notif_${customerId}`, JSON.stringify(notif));
      setNotifDirty(false);
      showToast("Notification preferences saved.");
    } catch {
      showToast("Failed to save preferences.", false);
    } finally {
      setNotifSaving(false);
    }
  };

  const savePrivacy = async (updated) => {
    const next = { ...privacy, ...updated };
    setPrivacy(next);
    try {
      await new Promise(r => setTimeout(r, 300));
      localStorage.setItem(`privacy_${customerId}`, JSON.stringify(next));
      showToast("Privacy setting updated.");
    } catch {
      showToast("Failed to update.", false);
    }
  };

  // Icon helpers
  const BellIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.orangeDeep} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
  const MailIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.orangeDeep} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
  const SmsIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.orangeDeep} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
  const LockIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.orangeDeep} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
  const EyeIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.orangeDeep} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
  const GlobeIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.orangeDeep} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/>
    </svg>
  );
  const DangerIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
    </svg>
  );

  return (
    <div className="cp-panel">

      {/* ── Push Notifications ── */}
      <SettingsSection
        title="Push Notifications"
        subtitle="Control alerts delivered directly to your device."
        icon={<BellIcon />}
      >
        <SettingsRow label="Task Updates" sub="Booking confirmations, status changes, worker assigned">
          <Toggle checked={notif.push_task_updates} onChange={v => setN("push_task_updates", v)} />
        </SettingsRow>
        <SettingsRow label="Messages" sub="New messages from workers or support">
          <Toggle checked={notif.push_messages} onChange={v => setN("push_messages", v)} />
        </SettingsRow>
        <SettingsRow label="Payment Alerts" sub="Escrow holds, payment receipts, release confirmations">
          <Toggle checked={notif.push_payment} onChange={v => setN("push_payment", v)} />
        </SettingsRow>
        <SettingsRow label="Reminders" sub="Upcoming service reminders, follow-up prompts">
          <Toggle checked={notif.push_reminders} onChange={v => setN("push_reminders", v)} />
        </SettingsRow>
        <SettingsRow label="Promotions & Offers" sub="Discounts, referral bonuses, seasonal deals">
          <Toggle checked={notif.push_promotions} onChange={v => setN("push_promotions", v)} />
        </SettingsRow>
        <SettingsRow label="New Workers Nearby" sub="Alerts when new service providers join your area">
          <Toggle checked={notif.push_new_worker} onChange={v => setN("push_new_worker", v)} />
        </SettingsRow>
      </SettingsSection>

      {/* ── Email Notifications ── */}
      <SettingsSection
        title="Email Notifications"
        subtitle="Choose what gets sent to your inbox."
        icon={<MailIcon />}
      >
        <SettingsRow label="Task Updates" sub="Booking lifecycle emails — confirmed, in progress, done">
          <Toggle checked={notif.email_task_updates} onChange={v => setN("email_task_updates", v)} />
        </SettingsRow>
        <SettingsRow label="Messages" sub="Email copy of new messages from workers">
          <Toggle checked={notif.email_messages} onChange={v => setN("email_messages", v)} />
        </SettingsRow>
        <SettingsRow label="Payment Receipts" sub="Transaction confirmations and escrow notices">
          <Toggle checked={notif.email_payment} onChange={v => setN("email_payment", v)} />
        </SettingsRow>
        <SettingsRow label="Reminders" sub="Service reminders 24h before scheduled time">
          <Toggle checked={notif.email_reminders} onChange={v => setN("email_reminders", v)} />
        </SettingsRow>
        <SettingsRow label="Promotions & Offers" sub="Marketing emails, coupons, special announcements">
          <Toggle checked={notif.email_promotions} onChange={v => setN("email_promotions", v)} />
        </SettingsRow>
        <SettingsRow label="Weekly Summary" sub="A digest of your bookings and spending each week">
          <Toggle checked={notif.email_weekly_summary} onChange={v => setN("email_weekly_summary", v)} />
        </SettingsRow>
      </SettingsSection>

      {/* ── SMS Notifications ── */}
      <SettingsSection
        title="SMS Notifications"
        subtitle="Get critical updates via text message."
        icon={<SmsIcon />}
      >
        <SettingsRow label="Task Updates" sub="SMS alerts for key booking milestones">
          <Toggle checked={notif.sms_task_updates} onChange={v => setN("sms_task_updates", v)} />
        </SettingsRow>
        <SettingsRow label="Payment Alerts" sub="SMS confirmation of payments and releases">
          <Toggle checked={notif.sms_payment} onChange={v => setN("sms_payment", v)} />
        </SettingsRow>
        <SettingsRow label="Reminders" sub="SMS reminders before your scheduled service">
          <Toggle checked={notif.sms_reminders} onChange={v => setN("sms_reminders", v)} />
        </SettingsRow>
      </SettingsSection>

      {/* ── Save Notifications ── */}
      {notifDirty && (
        <div style={{ padding: "14px 28px", background: C.orangeLight, borderBottom: `1px solid ${C.orangeBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ fontSize: 13, color: C.orangeDeep, fontWeight: 500 }}>You have unsaved notification changes.</div>
          <button onClick={saveNotifications} disabled={notifSaving}
            style={{ padding: "9px 22px", borderRadius: 9, background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`, color: "white", border: "none", fontSize: 13, fontWeight: 600, cursor: notifSaving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: notifSaving ? 0.75 : 1 }}>
            {notifSaving ? "Saving…" : "Save Preferences"}
          </button>
        </div>
      )}

      {/* ── Security ── */}
      <SettingsSection
        title="Security"
        subtitle="Manage your password and account access."
        icon={<LockIcon />}
      >
        <SettingsRow label="Password" sub="Last changed: never">
          <button onClick={() => setShowPwModal(true)}
            style={{ padding: "7px 16px", borderRadius: 8, background: "none", border: `1.5px solid ${C.border}`, color: C.textMid, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Change
          </button>
        </SettingsRow>
        <SettingsRow label="Two-Factor Authentication" sub="Add an extra layer of security to your login">
          <Toggle checked={twoFactor} onChange={v => { setTwoFactor(v); showToast(v ? "2FA enabled." : "2FA disabled."); }} />
        </SettingsRow>
        <SettingsRow label="Login Alerts" sub="Get notified of new sign-ins to your account">
          <Toggle checked={loginAlerts} onChange={v => { setLoginAlerts(v); showToast(v ? "Login alerts on." : "Login alerts off."); }} />
        </SettingsRow>
        <SettingsRow label="Active Sessions" sub="View and sign out of other devices">
          <button onClick={() => showToast("Session management coming soon.")}
            style={{ padding: "7px 16px", borderRadius: 8, background: "none", border: `1.5px solid ${C.border}`, color: C.textMid, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Manage
          </button>
        </SettingsRow>
      </SettingsSection>

      {/* ── Privacy ── */}
      <SettingsSection
        title="Privacy"
        subtitle="Control what others can see about your account."
        icon={<EyeIcon />}
      >
        <SettingsRow label="Public Profile" sub="Allow workers to view your profile details">
          <Toggle checked={privacy.profile_visible} onChange={v => savePrivacy({ profile_visible: v })} />
        </SettingsRow>
        <SettingsRow label="Show My Reviews" sub="Display your written reviews on worker profiles">
          <Toggle checked={privacy.show_reviews} onChange={v => savePrivacy({ show_reviews: v })} />
        </SettingsRow>
        <SettingsRow label="Show Activity Status" sub="Let workers see when you were last active">
          <Toggle checked={privacy.show_activity} onChange={v => savePrivacy({ show_activity: v })} />
        </SettingsRow>
        <SettingsRow label="Data & Analytics" sub="Allow Kaam-ly to use anonymised data to improve the service">
          <Toggle checked={true} onChange={() => showToast("Contact support to opt out of analytics.")} />
        </SettingsRow>
      </SettingsSection>

      {/* ── Preferences ── */}
      <SettingsSection
        title="Preferences"
        subtitle="Customise your experience."
        icon={<GlobeIcon />}
      >
        <SettingsRow label="Language" sub="Interface language">
          <select value={language} onChange={e => { setLanguage(e.target.value); showToast("Language updated."); }}
            style={{ ...inputSx, width: "auto", padding: "7px 12px", fontSize: 13 }}>
            <option value="en">English</option>
            <option value="ne">नेपाली</option>
            <option value="hi">हिंदी</option>
          </select>
        </SettingsRow>
        <SettingsRow label="Time Zone" sub="Used for scheduling and reminders">
          <select value={timezone} onChange={e => { setTimezone(e.target.value); showToast("Timezone updated."); }}
            style={{ ...inputSx, width: "auto", padding: "7px 12px", fontSize: 13 }}>
            <option value="Asia/Kathmandu">Asia/Kathmandu (NPT +5:45)</option>
            <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
            <option value="UTC">UTC +0:00</option>
          </select>
        </SettingsRow>
        <SettingsRow label="Currency Display" sub="Preferred currency for price display">
          <select value={currency} onChange={e => { setCurrency(e.target.value); showToast("Currency updated."); }}
            style={{ ...inputSx, width: "auto", padding: "7px 12px", fontSize: 13 }}>
            <option value="NPR">NPR — Nepalese Rupee</option>
            <option value="USD">USD — US Dollar</option>
            <option value="INR">INR — Indian Rupee</option>
          </select>
        </SettingsRow>
      </SettingsSection>

      {/* ── Danger Zone ── */}
      <div style={{ padding: "18px 28px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: C.redLight, border: `1px solid ${C.redBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <DangerIcon />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.red }}>Danger Zone</div>
            <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>Irreversible account actions. Proceed with caution.</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => showToast("Account deactivation request sent to support.")}
            style={{ padding: "9px 20px", borderRadius: 9, border: `1.5px solid ${C.border}`, background: C.surface, color: C.textMid, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Deactivate Account
          </button>
          <button onClick={() => setShowDelModal(true)}
            style={{ padding: "9px 20px", borderRadius: 9, border: `1.5px solid ${C.redBorder}`, background: C.redLight, color: C.red, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Delete Account
          </button>
        </div>
      </div>

      {showPwModal && (
        <ChangePasswordModal
          onClose={() => setShowPwModal(false)}
          onSave={() => { setShowPwModal(false); showToast("Password updated successfully."); }}
        />
      )}
      {showDelModal && (
        <DeleteAccountModal
          onClose={() => setShowDelModal(false)}
          onConfirm={() => { setShowDelModal(false); showToast("Account deletion requested. You will receive a confirmation email.", false); }}
        />
      )}
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
    { key: "settings", label: "Settings"                        },
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
      <Toast toast={toast} />

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

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        * { box-sizing: border-box; }
        .cp-root { font-family: 'DM Sans', -apple-system, sans-serif; }
        .cp-tab:hover  { background: ${C.orangeLight} !important; color: ${C.orangeDeep} !important; }
        .cp-photo:hover .cp-overlay { opacity: 1 !important; }
        .cp-edit:hover { background: ${C.orangeLight} !important; color: ${C.orangeDeep} !important; border-color: ${C.orange} !important; }
        .cp-row:hover  { background: ${C.orangeLight}66; }
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
          <div style={{ width: 272, flexShrink: 0 }}>
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

              {/* Quick Settings shortcut in sidebar */}
              <div style={{ height: 1, background: C.divider }} />
              <button onClick={() => setTab("settings")}
                style={{ width: "100%", padding: "13px 20px", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", borderRadius: "0 0 16px 16px" }}
                className="cp-tab">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textMid} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.textMid }}>Settings & Notifications</span>
              </button>
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
                    {t.key === "settings" && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${C.border}` }}>
                    {[
                      { label: "Total Paid",       value: `NPR ${totalPaid.toLocaleString()}`,    color: C.green,      bg: "#f8fffe" },
                      { label: "Awaiting Payment", value: `NPR ${totalPending.toLocaleString()}`, color: C.orangeDeep, bg: "#fffdf8" },
                      { label: "In Escrow",        value: `NPR ${totalEscrow.toLocaleString()}`,  color: C.blue,       bg: "#f8fbff" },
                    ].map((s, i) => (
                      <div key={s.label} style={{ padding: "20px 24px", background: s.bg, borderRight: i < 2 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{s.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {escrowTasks.length > 0 && (
                    <div style={{ borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ padding: "14px 24px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.09em" }}>Held in Escrow</div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.blue, background: C.blueLight, border: `1px solid ${C.blueBorder}`, padding: "3px 10px", borderRadius: 20 }}>NPR {totalEscrow.toLocaleString()} held</span>
                      </div>
                      <div style={{ maxHeight: 220, overflowY: "auto" }}>
                        {escrowTasks.map((task, i) => {
                          const tid = task._id || task.id || i;
                          const isReleasing = releasingId === tid;
                          return (
                            <div key={tid} style={{ padding: "14px 24px", borderTop: i > 0 ? `1px solid ${C.divider}` : "none" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3 }}>{task.selectedService || task.taskType || "Service"}</div>
                                  <div style={{ fontSize: 12, color: C.textLight }}>Worker marked as done — awaiting your confirmation</div>
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, flexShrink: 0 }}>NPR {(task.final_price || task.totalCost || 0).toLocaleString()}</div>
                                <button onClick={() => handleRelease(task)} disabled={isReleasing}
                                  style={{ padding: "9px 18px", borderRadius: 9, border: "none", flexShrink: 0, background: isReleasing ? C.border : C.green, color: isReleasing ? C.textLight : "white", fontSize: 13, fontWeight: 600, cursor: isReleasing ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                                  {isReleasing ? "Releasing…" : "Release to Worker"}
                                </button>
                              </div>
                              <div style={{ padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#92400e" }}>Only release if you are satisfied. This action cannot be undone.</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

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
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 40, fontWeight: 800, color: C.orange, lineHeight: 1 }}>{avgRating}</div>
                        <div style={{ fontSize: 10.5, color: C.textLight, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>avg rating</div>
                      </div>
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
                      <div style={{ fontSize: 12.5, color: C.textLight }}>We review all submitted reports promptly.</div>
                    </div>
                    <button onClick={() => setComplaintTask("")}
                      style={{ padding: "9px 20px", borderRadius: 9, background: C.redLight, color: C.red, border: `1.5px solid ${C.redBorder}`, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      + New Report
                    </button>
                  </div>
                  {reports.length === 0 ? (
                    <EmptyState title="No reports filed" sub="We hope everything is going smoothly with your bookings." />
                  ) : reports.map((r, i) => {
                    const rid    = r._id || r.id || i;
                    const sColor = r.status === "resolved" ? C.green  : r.status === "declined" ? C.red    : C.orangeDeep;
                    const sBg    = r.status === "resolved" ? C.greenLight : r.status === "declined" ? C.redLight  : C.orangeLight;
                    const sBd    = r.status === "resolved" ? C.greenBorder : r.status === "declined" ? C.redBorder : C.orangeBorder;
                    return (
                      <div key={rid}>
                        {i > 0 && <div style={{ height: 1, background: C.divider, margin: "0 28px" }} />}
                        <div className="cp-row" style={{ padding: "18px 28px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.reason || "Report"}</div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: sColor, background: sBg, border: `1px solid ${sBd}`, padding: "3px 10px", borderRadius: 20 }}>
                              {r.status === "resolved" ? "Resolved" : r.status === "declined" ? "Declined" : "Under Review"}
                            </span>
                          </div>
                          {r.description && <p style={{ margin: "0 0 10px", fontSize: 13.5, color: C.textMid, lineHeight: 1.7 }}>{r.description}</p>}
                          <div style={{ fontSize: 12, color: C.textLight }}>Filed {fmtDate(r.createdAt)}</div>
                          {r.adminNote && (
                            <div style={{ marginTop: 12, padding: "12px 16px", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Response from Kaam-ly</div>
                              <div style={{ fontSize: 13.5, color: C.textMid, lineHeight: 1.65 }}>{r.adminNote}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ height: 12 }} />
                </div>
              )}

              {/* ─── SETTINGS ─── */}
              {tab === "settings" && (
                <SettingsTab
                  customerId={id}
                  customer={customer}
                  showToast={showToast}
                />
              )}

            </div>
          </div>

        </div>
      </div>
    </>
  );
}