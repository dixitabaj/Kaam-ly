import { useState } from "react";

// ── Brand tokens ──────────────────────────────────────────────────────────────
const C = {
  brand:       "#E8843A",
  brandLight:  "#E8843A18",
  brandHover:  "#D4712A",
  bg:          "#F7F5EF",
  surface:     "#FFFFFF",
  border:      "#EDE8DF",
  divider:     "#FAF7F2",
  textPrimary: "#1C1410",
  textSecond:  "#7A6E65",
  textMuted:   "#B0A89E",
  green:       "#3D9E6E",
  greenLight:  "#3D9E6E18",
  red:         "#D94F3D",
  redLight:    "#D94F3D15",
  blue:        "#3D7EC9",
  blueLight:   "#3D7EC918",
  purple:      "#7C5CBF",
  purpleLight: "#7C5CBF18",
};

// ── Seed ─────────────────────────────────────────────────────────────────────
const WORKER = {
  firstName:    "Rohan",
  lastName:     "Tamang",
  email:        "rohan.tamang@gmail.com",
  phone:        "+977 98-5567-3421",
  address:      "Bhaktapur, Madhyapur",
  description:  "Professional electrician with 6+ years of experience in residential and commercial wiring, AC installation, and fault diagnosis.",
  taskType:     ["Wiring Fix", "AC Repair", "Electrical Installation"],
  basePrice:    350,
  face_verified: true,
  skill_verified: true,
  ratings:      4.7,
  reviewCount:  38,
  completedTasks: 54,
  isAvailable:  true,
  avatarColor:  "#E8843A",
  joinedAt:     "2025-06-03T07:00:00.000Z",
  esewa_id:     "rohan.tamang@esewa.com",
  bank_name:    "Nabil Bank",
  bank_account: "••••••7821",
  notif: {
    newTask:      true,
    taskReminder: true,
    payoutAlert:  true,
    reportAlert:  false,
    smsAlerts:    false,
  },
};

const ALL_SERVICES = [
  "Wiring Fix", "AC Repair", "Electrical Installation",
  "Plumbing", "Deep Clean", "Carpentry", "Painting", "Appliance Repair",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";
const initials = (f, l) => `${f?.[0] || ""}${l?.[0] || ""}`.toUpperCase();

// ── Small components ──────────────────────────────────────────────────────────
const SectionTitle = ({ children, accent = C.brand }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
    <span style={{ width: 3, height: 15, background: accent, borderRadius: 2, flexShrink: 0 }} />
    <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{children}</span>
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{children}</div>
);

const Input = ({ value, onChange, placeholder, type = "text", disabled = false }) => {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%", padding: "10px 13px", borderRadius: 10, fontSize: 13,
        border: `1px solid ${focused ? C.brand : C.border}`,
        background: disabled ? C.bg : C.surface,
        color: disabled ? C.textMuted : C.textPrimary,
        outline: "none", boxSizing: "border-box", fontFamily: "inherit",
        transition: "border-color 0.15s",
      }}
    />
  );
};

const Textarea = ({ value, onChange, placeholder, rows = 3 }) => {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%", padding: "10px 13px", borderRadius: 10, fontSize: 13,
        border: `1px solid ${focused ? C.brand : C.border}`,
        background: C.surface, color: C.textPrimary,
        outline: "none", resize: "vertical", boxSizing: "border-box",
        fontFamily: "inherit", lineHeight: 1.6, transition: "border-color 0.15s",
      }}
    />
  );
};

const Toggle = ({ checked, onChange, label, sub }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${C.divider}` }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 42, height: 24, borderRadius: 12, cursor: "pointer", flexShrink: 0,
        background: checked ? C.brand : C.border,
        position: "relative", transition: "background 0.2s",
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: checked ? 21 : 3,
        width: 18, height: 18, borderRadius: "50%", background: "white",
        boxShadow: "0 1px 4px rgba(0,0,0,0.18)", transition: "left 0.2s",
      }} />
    </div>
  </div>
);

function SaveButton({ onClick, saved }) {
  return (
    <button onClick={onClick}
      style={{
        padding: "10px 24px", borderRadius: 10, border: "none",
        background: saved ? C.green : C.brand, color: "white",
        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        transition: "background 0.2s", display: "flex", alignItems: "center", gap: 7,
      }}
      onMouseEnter={e => { if (!saved) e.currentTarget.style.background = C.brandHover; }}
      onMouseLeave={e => { if (!saved) e.currentTarget.style.background = C.brand; }}
    >
      {saved ? "✓ Saved" : "Save Changes"}
    </button>
  );
}

const TABS = [
  { key: "profile",       label: "Profile"        },
  { key: "services",      label: "Services"       },
  { key: "password",      label: "Password"       },
  { key: "payouts",       label: "Payouts"        },
  { key: "notifications", label: "Notifications"  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function WorkerSettings() {
  const [tab, setTab] = useState("profile");

  // Profile state
  const [firstName,   setFirstName]   = useState(WORKER.firstName);
  const [lastName,    setLastName]     = useState(WORKER.lastName);
  const [phone,       setPhone]       = useState(WORKER.phone);
  const [address,     setAddress]     = useState(WORKER.address);
  const [description, setDescription] = useState(WORKER.description);
  const [isAvailable, setIsAvailable] = useState(WORKER.isAvailable);

  // Services state
  const [services,  setServices]  = useState(WORKER.taskType);
  const [basePrice, setBasePrice] = useState(String(WORKER.basePrice));

  // Password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw,     setNewPw]     = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError,   setPwError]   = useState("");

  // Payout state
  const [esewaId,      setEsewaId]    = useState(WORKER.esewa_id);
  const [bankName,     setBankName]   = useState(WORKER.bank_name);
  const [bankAccount,  setBankAccount]= useState("");

  // Notifications state
  const [notif, setNotif] = useState(WORKER.notif);
  const setN = (key) => (val) => setNotif(p => ({ ...p, [key]: val }));

  // Save feedback
  const [saved, setSaved] = useState({});
  const triggerSave = (key) => {
    setSaved(p => ({ ...p, [key]: true }));
    setTimeout(() => setSaved(p => ({ ...p, [key]: false })), 2000);
  };

  const handlePasswordSave = () => {
    if (!currentPw) { setPwError("Enter your current password."); return; }
    if (newPw.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match."); return; }
    setPwError("");
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    triggerSave("password");
  };

  const toggleService = (s) => {
    setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const VerBadge = ({ ok, label }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: ok ? C.greenLight : C.redLight, color: ok ? C.green : C.red, border: `1px solid ${ok ? C.green : C.red}25`, borderRadius: 100, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
      {ok ? "✓" : "✕"} {label}
    </span>
  );

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: C.bg, minHeight: "100vh", padding: 24 }}>

      {/* Page header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.01em" }}>Account Settings</h1>
        <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>Manage your profile, services, and preferences</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

          {/* Worker card */}
          <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20, textAlign: "center", marginBottom: 4 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: WORKER.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "white", margin: "0 auto 12px", boxShadow: "0 4px 12px rgba(232,132,58,0.3)" }}>
              {initials(firstName, lastName)}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>{firstName} {lastName}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>{WORKER.email}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 5, flexWrap: "wrap" }}>
              <VerBadge ok={WORKER.face_verified}  label="Face" />
              <VerBadge ok={WORKER.skill_verified} label="Skill" />
            </div>
            {/* Availability toggle */}
            <div
              onClick={() => setIsAvailable(v => !v)}
              style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "7px 14px", borderRadius: 100, cursor: "pointer", background: isAvailable ? C.greenLight : C.redLight, border: `1px solid ${isAvailable ? C.green : C.red}30`, transition: "all 0.2s" }}
            >
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: isAvailable ? C.green : C.red, boxShadow: isAvailable ? `0 0 5px ${C.green}` : "none" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: isAvailable ? C.green : C.red }}>
                {isAvailable ? "Available" : "Unavailable"}
              </span>
            </div>
          </div>

          {/* Nav */}
          <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            {TABS.map((t, i) => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                width: "100%", padding: "12px 16px", border: "none", cursor: "pointer",
                background: tab === t.key ? C.brandLight : "transparent",
                color: tab === t.key ? C.brand : C.textSecond,
                fontSize: 13, fontWeight: tab === t.key ? 600 : 500, textAlign: "left",
                borderBottom: i < TABS.length - 1 ? `1px solid ${C.divider}` : "none",
                borderLeft: `3px solid ${tab === t.key ? C.brand : "transparent"}`,
                transition: "all 0.12s", fontFamily: "inherit",
              }}>{t.label}</button>
            ))}
          </div>

          {/* Quick stats */}
          <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, marginTop: 4 }}>
            {[
              { label: "Tasks Done",  value: WORKER.completedTasks, color: C.blue },
              { label: "Rating",      value: `${WORKER.ratings} ★`, color: C.brand },
              { label: "Reviews",     value: WORKER.reviewCount,    color: C.purple },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.divider}` }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>{s.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 10, textAlign: "center" }}>
              Member since {fmt(WORKER.joinedAt)}
            </div>
          </div>
        </div>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div>

          {/* ── Profile tab ── */}
          {tab === "profile" && (
            <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28 }}>
              <SectionTitle>Personal Information</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div><Label>First Name</Label><Input value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                <div><Label>Last Name</Label><Input value={lastName}  onChange={e => setLastName(e.target.value)} /></div>
                <div><Label>Email Address</Label><Input value={WORKER.email} disabled /></div>
                <div><Label>Phone Number</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <Label>Address</Label>
                <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Your city / area" />
              </div>

              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 22, marginTop: 6, marginBottom: 22 }}>
                <SectionTitle>Bio</SectionTitle>
                <Label>About You</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
                  placeholder="Describe your experience, skills, and what sets you apart…" />
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
                  {description.length}/500 characters · This is shown to customers before they book you
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <SaveButton onClick={() => triggerSave("profile")} saved={!!saved.profile} />
              </div>
            </div>
          )}

          {/* ── Services tab ── */}
          {tab === "services" && (
            <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28 }}>
              <SectionTitle>Services You Offer</SectionTitle>
              <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 18px", lineHeight: 1.6 }}>
                Select all services you can provide. Customers will be matched with you based on these.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
                {ALL_SERVICES.map(s => {
                  const active = services.includes(s);
                  return (
                    <button key={s} onClick={() => toggleService(s)} style={{
                      padding: "8px 16px", borderRadius: 100, cursor: "pointer",
                      border: `1px solid ${active ? C.brand : C.border}`,
                      background: active ? C.brandLight : C.surface,
                      color: active ? C.brand : C.textSecond,
                      fontSize: 13, fontWeight: active ? 600 : 500,
                      fontFamily: "inherit", transition: "all 0.15s",
                    }}>
                      {active && <span style={{ marginRight: 5 }}>✓</span>}
                      {s}
                    </button>
                  );
                })}
              </div>

              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 22, marginBottom: 22 }}>
                <SectionTitle>Pricing</SectionTitle>
                <div style={{ maxWidth: 240 }}>
                  <Label>Base Price (NPR / hr)</Label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.textMuted, fontWeight: 500 }}>NPR</span>
                    <input
                      type="number"
                      value={basePrice}
                      onChange={e => setBasePrice(e.target.value)}
                      style={{ width: "100%", padding: "10px 13px 10px 46px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", color: C.textPrimary, background: C.surface }}
                      onFocus={e => e.target.style.borderColor = C.brand}
                      onBlur={e => e.target.style.borderColor = C.border}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>This is your starting rate — you can adjust per task when reviewing offers.</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <SaveButton onClick={() => triggerSave("services")} saved={!!saved.services} />
              </div>
            </div>
          )}

          {/* ── Password tab ── */}
          {tab === "password" && (
            <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28 }}>
              <SectionTitle>Change Password</SectionTitle>
              <div style={{ maxWidth: 400, display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <Label>Current Password</Label>
                  <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password" />
                </div>
                <div>
                  <Label>New Password</Label>
                  <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters" />
                </div>
                <div>
                  <Label>Confirm New Password</Label>
                  <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" />
                </div>

                {pwError && (
                  <div style={{ background: C.redLight, color: C.red, border: `1px solid ${C.red}25`, borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 500 }}>
                    {pwError}
                  </div>
                )}
                {saved.password && (
                  <div style={{ background: C.greenLight, color: C.green, border: `1px solid ${C.green}25`, borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 500 }}>
                    ✓ Password updated successfully.
                  </div>
                )}

                {/* Password strength hint */}
                {newPw && (
                  <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Password Strength</div>
                    {[
                      { label: "At least 8 characters",    ok: newPw.length >= 8 },
                      { label: "Contains a number",         ok: /\d/.test(newPw) },
                      { label: "Contains a special character", ok: /[^a-zA-Z0-9]/.test(newPw) },
                    ].map(r => (
                      <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: r.ok ? C.green : C.textMuted }}>{r.ok ? "✓" : "○"}</span>
                        <span style={{ fontSize: 12, color: r.ok ? C.green : C.textMuted }}>{r.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <SaveButton onClick={handlePasswordSave} saved={!!saved.password} />
                </div>
              </div>
            </div>
          )}

          {/* ── Payouts tab ── */}
          {tab === "payouts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* eSewa */}
              <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28 }}>
                <SectionTitle>eSewa Account</SectionTitle>
                <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.greenLight, border: `1px solid ${C.green}25`, borderRadius: 12, padding: "12px 16px", marginBottom: 18 }}>
                  <span style={{ fontSize: 20 }}>💚</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.green }}>eSewa Connected</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{WORKER.esewa_id}</div>
                  </div>
                </div>
                <div style={{ maxWidth: 360 }}>
                  <Label>eSewa ID / Phone</Label>
                  <Input value={esewaId} onChange={e => setEsewaId(e.target.value)} placeholder="esewa@email.com or phone" />
                </div>
              </div>

              {/* Bank */}
              <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28 }}>
                <SectionTitle>Bank Account</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 520 }}>
                  <div>
                    <Label>Bank Name</Label>
                    <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Nabil Bank" />
                  </div>
                  <div>
                    <Label>Account Number</Label>
                    <Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="Enter account number" />
                  </div>
                </div>
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: C.textMuted }}>
                  <span>🔒</span> Account details are encrypted and only used for payouts
                </div>
              </div>

              {/* Payout summary */}
              <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28 }}>
                <SectionTitle accent={C.green}>Earnings Overview</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { label: "Total Earned",    value: "NPR 47,800", color: C.green,  bg: C.greenLight  },
                    { label: "Pending Payout",  value: "NPR 3,200",  color: C.brand,  bg: C.brandLight  },
                    { label: "Platform Fee",    value: "NPR 4,780",  color: C.purple, bg: C.purpleLight },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "14px 16px", border: `1px solid ${s.color}25` }}>
                      <div style={{ fontSize: 11, color: s.color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <SaveButton onClick={() => triggerSave("payouts")} saved={!!saved.payouts} />
              </div>
            </div>
          )}

          {/* ── Notifications tab ── */}
          {tab === "notifications" && (
            <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28 }}>
              <SectionTitle>Notification Preferences</SectionTitle>
              <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 20px", lineHeight: 1.6 }}>
                Control which alerts you receive by email and SMS.
              </p>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Email Notifications</div>
                <Toggle checked={notif.newTask}      onChange={setN("newTask")}      label="New task available"   sub="Get notified when a task matching your services is posted nearby" />
                <Toggle checked={notif.taskReminder} onChange={setN("taskReminder")} label="Task reminders"        sub="Reminder 24 hrs and 1 hr before your scheduled task" />
                <Toggle checked={notif.payoutAlert}  onChange={setN("payoutAlert")}  label="Payout alerts"         sub="Notify me when a payout is released to my account" />
                <Toggle checked={notif.reportAlert}  onChange={setN("reportAlert")}  label="Report notifications"  sub="Alert me when a report is filed or a decision is made" />
              </div>

              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>SMS Notifications</div>
                <Toggle checked={notif.smsAlerts} onChange={setN("smsAlerts")} label="SMS alerts" sub="Receive critical updates by text message (carrier rates may apply)" />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <SaveButton onClick={() => triggerSave("notifications")} saved={!!saved.notifications} />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}