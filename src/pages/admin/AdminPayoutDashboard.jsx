import { useEffect, useState, useCallback } from "react";
import BookingNavbar from "../../components/Navbar/Navbar";

const API_BASE = "http://127.0.0.1:8000/api";

const getToken = () => {
  const u = localStorage.getItem("user");
  return u ? JSON.parse(u)?.token : null;
};

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ── Design tokens (warm brand palette) ────────────────────────────────────────
const C = {
  bg:         "#F7F5EF",
  surface:    "#FFFFFF",
  border:     "#EDE8DF",
  borderHov:  "#D77D43",
  text:       "#1C1008",
  muted:      "#9C8E82",
  amber:      "#D77D43",
  amberLight: "#FDF3E8",
  amberBorder:"#F5D9BB",
  green:      "#16a34a",
  greenLight: "#f0fdf4",
  greenBorder:"#bbf7d0",
  red:        "#dc2626",
  redLight:   "#fef2f2",
  redBorder:  "#fecaca",
  yellow:     "#d97706",
  yellowLight:"#fffbeb",
  yellowBorder:"#fde68a",
  dark:       "#111827",
  gray:       "#6b7280",
  grayLight:  "#f9fafb",
};

// ── Status pill ───────────────────────────────────────────────────────────────
const Pill = ({ status }) => {
  const map = {
    success:          { color: C.green,  bg: C.greenLight,  border: C.greenBorder,  label: "Paid"      },
    paid:             { color: C.green,  bg: C.greenLight,  border: C.greenBorder,  label: "Paid"      },
    refunded:         { color: C.green,  bg: C.greenLight,  border: C.greenBorder,  label: "Refunded"  },
    partial_refund:   { color: C.amber,  bg: C.amberLight,  border: C.amberBorder,  label: "Partial"   },
    pending:          { color: C.yellow, bg: C.yellowLight, border: C.yellowBorder, label: "Pending"   },
    pending_refund:   { color: C.yellow, bg: C.yellowLight, border: C.yellowBorder, label: "Pending"   },
    failed:           { color: C.red,    bg: C.redLight,    border: C.redBorder,    label: "Failed"    },
    skipped:          { color: C.gray,   bg: C.grayLight,   border: C.border,       label: "Skipped"   },
    error:            { color: C.red,    bg: C.redLight,    border: C.redBorder,    label: "Error"     },
    cancelled:        { color: C.red,    bg: C.redLight,    border: C.redBorder,    label: "Cancelled" },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      padding: "3px 11px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      letterSpacing: "0.02em", whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, accent }) => (
  <div style={{
    background: C.surface, borderRadius: 16, padding: "20px 24px",
    border: `1px solid ${C.border}`, flex: 1, minWidth: 150,
    borderLeft: accent ? `4px solid ${accent}` : `1px solid ${C.border}`,
    transition: "box-shadow 0.2s",
  }}>
    <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>
      {label}
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 6, fontWeight: 500 }}>{sub}</div>}
  </div>
);

// ── Alert banner ──────────────────────────────────────────────────────────────
const Banner = ({ type, children }) => {
  const styles = {
    warn:    { bg: C.yellowLight, border: C.yellowBorder, color: "#92400e" },
    success: { bg: C.greenLight,  border: C.greenBorder,  color: "#15803d" },
    error:   { bg: C.redLight,    border: C.redBorder,    color: C.red     },
    info:    { bg: C.amberLight,  border: C.amberBorder,  color: "#92400e" },
  };
  const s = styles[type] || styles.info;
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12,
      padding: "13px 18px", marginBottom: 16, fontSize: 13, color: s.color,
      display: "flex", alignItems: "flex-start", gap: 10, lineHeight: 1.55,
    }}>
      {children}
    </div>
  );
};

// ── Table styles ──────────────────────────────────────────────────────────────
const th = {
  padding: "11px 16px", textAlign: "left", fontWeight: 700,
  color: C.muted, fontSize: 10, textTransform: "uppercase",
  letterSpacing: "0.7px", background: C.grayLight,
  borderBottom: `1px solid ${C.border}`,
};
const td = { padding: "14px 16px", color: "#374151", fontSize: 13 };

// ── Spinner ───────────────────────────────────────────────────────────────────
const Spinner = ({ size = 28, color = C.amber }) => (
  <div style={{
    width: size, height: size,
    border: `3px solid ${C.border}`,
    borderTop: `3px solid ${color}`,
    borderRadius: "50%",
    animation: "spin 0.75s linear infinite",
    flexShrink: 0,
  }} />
);

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function AdminPayoutDashboard() {
  const [pending,    setPending]    = useState([]);
  const [history,    setHistory]    = useState([]);
  const [refunds,    setRefunds]    = useState([]);
  const [tab,        setTab]        = useState("pending");
  const [loading,    setLoading]    = useState(true);
  const [processing, setProcessing] = useState(false);
  const [refunding,  setRefunding]  = useState(null);   // task_id being refunded
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // ── Fetch all data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, h, r] = await Promise.all([
        fetch(`${API_BASE}/payouts/pending`,        { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_BASE}/payouts/history`,        { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_BASE}/refunds/pending`,        { headers: authHeaders() }).then(r => r.json()),
      ]);
      setPending(p.payouts  || []);
      setHistory(h.payouts  || []);
      setRefunds(r.refunds  || []);
    } catch (e) {
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Bulk payout ─────────────────────────────────────────────────────────────
  const runBulkPayout = async () => {
    if (!window.confirm(`Pay out NPR ${totalPending.toFixed(2)} to ${pending.length} workers?\n\nThis cannot be undone.`)) return;
    setProcessing(true);
    setResult(null);
    try {
      const res  = await fetch(`${API_BASE}/payouts/bulk`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      setResult(data);
      await fetchData();
    } catch (e) {
      setError("Bulk payout failed: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  // ── Mark single refund as processed ────────────────────────────────────────
  const markRefundProcessed = async (taskId) => {
    setRefunding(taskId);
    try {
      const res  = await fetch(`${API_BASE}/refunds/${taskId}/mark-refunded`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      setSuccessMsg(`Refund marked as processed. Customer notified.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchData();
    } catch (e) {
      setError("Refund failed: " + e.message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setRefunding(null);
    }
  };

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalPending        = pending.reduce((s, p) => s + (p.worker_payout || 0), 0);
  const totalPaid           = history.reduce((s, h) => s + (h.worker_payout || 0), 0);
  const missingEsewa        = pending.filter(p => !p.worker_esewa).length;
  const pendingRefundTotal  = refunds.filter(r => r.refund_status === "pending_refund").reduce((s, r) => s + (r.refund_amount || 0), 0);
  const pendingRefundCount  = refunds.filter(r => r.refund_status === "pending_refund").length;

  const TABS = [
    { id: "pending",  label: "Pending Payouts", count: pending.length         },
    { id: "history",  label: "Payout History",  count: history.length         },
    { id: "refunds",  label: "Refunds",          count: pendingRefundCount, dot: pendingRefundCount > 0 },
  ];

  return (
    <>
      <BookingNavbar />
      <div style={{ minHeight: "89vh", background: C.bg, fontFamily: '"DM Sans", -apple-system, sans-serif', padding: "2rem" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>

          {/* ── Header ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, background: C.amberLight, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💰</div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: C.amber, margin: 0, letterSpacing: "-0.02em" }}>Finance Dashboard</h1>
              </div>
              <p style={{ color: C.muted, margin: 0, fontSize: 13, paddingLeft: 46 }}>Manage worker payouts & customer refunds</p>
            </div>

            {tab === "pending" && (
              <button
                onClick={runBulkPayout}
                disabled={processing || pending.length === 0}
                style={{
                  background: processing || pending.length === 0 ? C.grayLight : C.text,
                  color:      processing || pending.length === 0 ? C.muted      : "#fff",
                  border: "none", borderRadius: 12, padding: "11px 22px",
                  fontWeight: 700, fontSize: 13, cursor: processing || pending.length === 0 ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
                }}
              >
                {processing ? <><Spinner size={14} color="#fff" /> Processing…</> : `Pay All — NPR ${totalPending.toFixed(2)}`}
              </button>
            )}
          </div>

          {/* ── Stats row ── */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <StatCard label="Pending Payouts"    value={pending.length}               sub={`NPR ${totalPending.toFixed(2)} total`}       accent={C.amber}  />
            <StatCard label="Total Paid Out"      value={history.length}               sub={`NPR ${totalPaid.toFixed(2)} disbursed`}       accent={C.green}  />
            <StatCard label="Pending Refunds"     value={pendingRefundCount}           sub={`NPR ${pendingRefundTotal.toFixed(2)} owed`}   accent={C.red}    />
            <StatCard label="Missing eSewa ID"    value={missingEsewa}                 sub="workers — will be skipped"                     accent={C.yellow} />
          </div>

          {/* ── Banners ── */}
          {missingEsewa > 0 && (
            <Banner type="warn">
              ⚠️ <span><strong>{missingEsewa} worker{missingEsewa > 1 ? "s" : ""}</strong> have no eSewa ID and will be skipped during bulk payout.</span>
            </Banner>
          )}
          {pendingRefundCount > 0 && tab !== "refunds" && (
            <Banner type="info">
              🔔 <span><strong>{pendingRefundCount} customer refund{pendingRefundCount > 1 ? "s" : ""}</strong> require your attention — <button onClick={() => setTab("refunds")} style={{ background: "none", border: "none", color: C.amber, fontWeight: 700, cursor: "pointer", fontSize: 13, padding: 0, textDecoration: "underline" }}>view refunds →</button></span>
            </Banner>
          )}
          {result && (
            <Banner type="success">
              <div>
                <strong>{result.message}</strong>
                {result.results?.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {result.results.map((r, i) => (
                      <span key={i} style={{ color: "#374151", display: "flex", alignItems: "center", gap: 5 }}>
                        {r.worker_email}: <Pill status={r.status} />
                        {r.reason && <span style={{ color: C.muted, fontSize: 12 }}>({r.reason})</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Banner>
          )}
          {successMsg && <Banner type="success">✅ {successMsg}</Banner>}
          {error      && <Banner type="error">❌ {error}</Banner>}

          {/* ── Tabs ── */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: `2px solid ${C.border}`, paddingBottom: 0 }}>
            {TABS.map(({ id, label, count, dot }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  style={{
                    padding: "10px 18px", borderRadius: "10px 10px 0 0", fontSize: 13, fontWeight: 700,
                    border: `1px solid ${active ? C.border : "transparent"}`,
                    borderBottom: active ? `2px solid ${C.surface}` : "none",
                    background: active ? C.surface : "transparent",
                    color:      active ? C.text    : C.muted,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                    marginBottom: active ? "-2px" : 0,
                    transition: "all 0.15s",
                  }}
                >
                  {label}
                  {count > 0 && (
                    <span style={{
                      background: active ? (dot ? C.red : C.amberLight) : C.border,
                      color:      active ? (dot ? "#fff" : C.amber)     : C.muted,
                      borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 800,
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Table ── */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 80, background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <Spinner size={36} />
              <p style={{ color: C.muted, margin: 0, fontWeight: 600 }}>Loading…</p>
            </div>
          ) : (
            <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>

              {/* ══ PENDING PAYOUTS ══ */}
              {tab === "pending" && (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Task", "Worker", "eSewa ID", "Payout (NPR)", "Platform Fee", "Released At", "Status"].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pending.length === 0 ? (
                      <EmptyRow cols={7} msg="No pending payouts 🎉" />
                    ) : pending.map(p => (
                      <tr key={p.task_id} style={{ borderBottom: `1px solid ${C.border}` }}
                        onMouseEnter={e => e.currentTarget.style.background = C.grayLight}
                        onMouseLeave={e => e.currentTarget.style.background = C.surface}
                      >
                        <td style={{ ...td, fontWeight: 700, color: C.text }}>{p.task_name}</td>
                        <td style={td}>
                          <div style={{ fontWeight: 700, color: C.text }}>{p.worker_name}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{p.worker_email}</div>
                        </td>
                        <td style={td}>
                          {p.worker_esewa
                            ? <span style={{ fontFamily: "monospace", fontSize: 12 }}>{p.worker_esewa}</span>
                            : <span style={{ color: C.red, fontSize: 11, fontWeight: 700 }}>Not set</span>}
                        </td>
                        <td style={{ ...td, fontWeight: 800, color: C.text, fontSize: 15 }}>
                          NPR {Number(p.worker_payout).toFixed(2)}
                        </td>
                        <td style={{ ...td, color: C.muted }}>NPR {Number(p.platform_fee).toFixed(2)}</td>
                        <td style={{ ...td, color: C.muted, fontSize: 12 }}>
                          {p.released_at ? new Date(p.released_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>
                        <td style={td}><Pill status={p.worker_esewa ? "pending" : "skipped"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ══ PAYOUT HISTORY ══ */}
              {tab === "history" && (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Task", "Worker", "Payout (NPR)", "Platform Fee", "Ref ID", "Paid At", "Status"].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <EmptyRow cols={7} msg="No payout history yet" />
                    ) : history.map(h => (
                      <tr key={h.task_id} style={{ borderBottom: `1px solid ${C.border}` }}
                        onMouseEnter={e => e.currentTarget.style.background = C.grayLight}
                        onMouseLeave={e => e.currentTarget.style.background = C.surface}
                      >
                        <td style={{ ...td, fontWeight: 700, color: C.text }}>{h.task_name}</td>
                        <td style={td}>
                          <div style={{ fontWeight: 700, color: C.text }}>{h.worker_name}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{h.worker_email}</div>
                        </td>
                        <td style={{ ...td, fontWeight: 800, color: C.text, fontSize: 15 }}>
                          NPR {Number(h.worker_payout).toFixed(2)}
                        </td>
                        <td style={{ ...td, color: C.muted }}>NPR {Number(h.platform_fee).toFixed(2)}</td>
                        <td style={{ ...td, fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{h.esewa_ref_id || "—"}</td>
                        <td style={{ ...td, color: C.muted, fontSize: 12 }}>
                          {h.payout_at ? new Date(h.payout_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>
                        <td style={td}><Pill status={h.payout_status || "paid"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* ══ REFUNDS ══ */}
              {tab === "refunds" && (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Task", "Customer", "Total Paid", "Refund Amount", "Penalty (Worker)", "Cancelled At", "Status", "Action"].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {refunds.length === 0 ? (
                      <EmptyRow cols={8} msg="No refunds to process 🎉" />
                    ) : refunds.map(r => {
                      const isPending = r.refund_status === "pending_refund";
                      const isLoading = refunding === r.task_id;
                      return (
                        <tr key={r.task_id} style={{ borderBottom: `1px solid ${C.border}`, background: isPending ? "#fffdf9" : C.surface }}
                          onMouseEnter={e => e.currentTarget.style.background = C.grayLight}
                          onMouseLeave={e => e.currentTarget.style.background = isPending ? "#fffdf9" : C.surface}
                        >
                          <td style={td}>
                            <div style={{ fontWeight: 700, color: C.text }}>{r.task_name}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontFamily: "monospace" }}>{r.task_id.slice(-8)}</div>
                          </td>
                          <td style={td}>
                            <div style={{ fontWeight: 700, color: C.text }}>{r.customer_name || "—"}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{r.customer_email || r.customer_id}</div>
                          </td>
                          <td style={{ ...td, color: C.muted }}>NPR {Number(r.total_cost || 0).toFixed(2)}</td>
                          <td style={{ ...td, fontWeight: 800, color: C.green, fontSize: 15 }}>
                            NPR {Number(r.refund_amount || 0).toFixed(2)}
                            {r.refund_amount < r.total_cost && (
                              <div style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>75% of total</div>
                            )}
                          </td>
                          <td style={td}>
                            {r.penalty_amount > 0
                              ? <span style={{ color: C.amber, fontWeight: 700 }}>NPR {Number(r.penalty_amount).toFixed(2)}</span>
                              : <span style={{ color: C.muted }}>None</span>
                            }
                          </td>
                          <td style={{ ...td, color: C.muted, fontSize: 12 }}>
                            {r.cancelled_at ? new Date(r.cancelled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                            {r.cancel_reason && (
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 3, fontStyle: "italic", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.cancel_reason}>
                                "{r.cancel_reason}"
                              </div>
                            )}
                          </td>
                          <td style={td}><Pill status={r.refund_status || "pending_refund"} /></td>
                          <td style={td}>
                            {isPending ? (
                              <button
                                onClick={() => markRefundProcessed(r.task_id)}
                                disabled={isLoading}
                                style={{
                                  background: isLoading ? C.grayLight : C.amberLight,
                                  color:      isLoading ? C.muted      : C.amber,
                                  border: `1px solid ${isLoading ? C.border : C.amberBorder}`,
                                  borderRadius: 9, padding: "7px 14px", fontSize: 12,
                                  fontWeight: 700, cursor: isLoading ? "not-allowed" : "pointer",
                                  display: "flex", alignItems: "center", gap: 6,
                                  transition: "all 0.15s", whiteSpace: "nowrap",
                                }}
                                onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.background = C.amber; e.currentTarget.style.color = "#fff"; }}}
                                onMouseLeave={e => { if (!isLoading) { e.currentTarget.style.background = C.amberLight; e.currentTarget.style.color = C.amber; }}}
                              >
                                {isLoading ? <><Spinner size={12} color={C.amber} /> Processing…</> : "✓ Mark Refunded"}
                              </button>
                            ) : (
                              <span style={{ color: C.muted, fontSize: 12, fontWeight: 600 }}>
                                {r.refunded_at ? `Done ${new Date(r.refunded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Processed"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

            </div>
          )}

          {/* ── Refund legend ── */}
          {tab === "refunds" && refunds.length > 0 && (
            <div style={{ marginTop: 14, padding: "12px 16px", background: C.amberLight, borderRadius: 10, border: `1px solid ${C.amberBorder}`, fontSize: 12, color: "#92400e", display: "flex", gap: 24, flexWrap: "wrap" }}>
              <span>📋 <strong>How it works:</strong></span>
              <span>• Cancelled &lt;3hrs before task → customer gets <strong>75% refund</strong>, worker keeps <strong>25% penalty</strong></span>
              <span>• Cancelled ≥3hrs before task → customer gets <strong>full refund</strong></span>
              <span>• Click <strong>"Mark Refunded"</strong> after manually processing in eSewa — customer will be notified automatically</span>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </>
  );
}

const EmptyRow = ({ cols, msg }) => (
  <tr>
    <td colSpan={cols} style={{ padding: "64px 24px", textAlign: "center", color: C.muted, fontSize: 14, fontWeight: 600 }}>
      {msg}
    </td>
  </tr>
);