import { useEffect, useState } from "react";
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

const Pill = ({ status }) => {
  const map = {
    success: { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
    paid:    { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
    pending: { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    failed:  { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    skipped: { color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
    error:   { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  };
  const labels = { success: "Paid", paid: "Paid", pending: "Pending", failed: "Failed", skipped: "Skipped", error: "Error" };
  const s = map[status] || map.pending;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
      {labels[status] || "Pending"}
    </span>
  );
};

const StatCard = ({ label, value, sub }) => (
  <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", border: "1px solid #e5e7eb", flex: 1, minWidth: 160 }}>
    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>{label}</div>
    <div style={{ fontSize: 30, fontWeight: 700, color: "#111827", lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{sub}</div>}
  </div>
);

export default function AdminPayoutDashboard() {
  const [pending,    setPending]    = useState([]);
  const [history,    setHistory]    = useState([]);
  const [tab,        setTab]        = useState("pending");
  const [loading,    setLoading]    = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, h] = await Promise.all([
        fetch(`${API_BASE}/payouts/pending`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_BASE}/payouts/history`, { headers: authHeaders() }).then(r => r.json()),
      ]);
      setPending(p.payouts || []);
      setHistory(h.payouts || []);  // ← fixed: was h.history
    } catch (e) {
      setError("Failed to load payout data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const runBulkPayout = async () => {
    if (!window.confirm(`Pay out NPR ${totalPending.toFixed(2)} to ${pending.length} workers via eSewa?\n\nThis cannot be undone.`)) return;
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

  const totalPending = pending.reduce((s, p) => s + (p.worker_payout || 0), 0);
  const totalPaid    = history.reduce((s, h) => s + (h.worker_payout || 0), 0);
  const missingEsewa = pending.filter(p => !p.worker_esewa).length;

  const thStyle = {
    padding: "12px 16px", textAlign: "left", fontWeight: 600,
    color: "#6b7280", fontSize: 11, textTransform: "uppercase",
    letterSpacing: "0.5px", background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
  };

  const tdStyle = { padding: "14px 16px", color: "#374151", fontSize: 14 };

  return (
    <>
      <BookingNavbar />
      <div style={{ minHeight: "89vh", background: "#F7F5EF", fontFamily: "Inter", padding: "2rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: "#D77D43", margin: "0 0 6px" }}>Worker Payouts</h1>
              <p style={{ color: "#6b7280", margin: 0, fontSize: 14 }}>Bulk disburse released escrows to workers via eSewa</p>
            </div>
            <button
              onClick={runBulkPayout}
              disabled={processing || pending.length === 0}
              style={{
                background: processing || pending.length === 0 ? "#f3f4f6" : "#111827",
                color:      processing || pending.length === 0 ? "#9ca3af" : "#fff",
                border: "none", borderRadius: 12, padding: "11px 22px",
                fontWeight: 600, fontSize: 14,
                cursor: processing || pending.length === 0 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              {processing ? (
                <>
                  <span style={{ width: 14, height: 14, border: "2px solid #6b7280", borderTop: "2px solid #fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                  Processing…
                </>
              ) : (
                `Pay All — NPR ${totalPending.toFixed(2)}`
              )}
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
            <StatCard label="Pending Payouts" value={pending.length}                sub={`NPR ${totalPending.toFixed(2)} total`}  />
            <StatCard label="Total Paid Out"   value={history.length}                sub={`NPR ${totalPaid.toFixed(2)} disbursed`} />
            <StatCard label="Missing eSewa ID" value={missingEsewa}                  sub="will be skipped"                         />
            <StatCard label="Ready to Pay"     value={pending.length - missingEsewa} sub="workers with eSewa ID"                   />
          </div>

          {/* Missing eSewa warning */}
          {missingEsewa > 0 && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: "#92400e" }}>
              ⚠ <span><strong>{missingEsewa} worker{missingEsewa > 1 ? "s" : ""}</strong> have no eSewa ID and will be skipped.</span>
            </div>
          )}

          {/* Result banner */}
          {result && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "14px 18px", marginBottom: 16, fontSize: 14 }}>
              <strong style={{ color: "#15803d" }}>{result.message}</strong>
              <div style={{ marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
                {result.results?.map((r, i) => (
                  <span key={i} style={{ color: "#374151" }}>
                    {r.worker_email}: <Pill status={r.status} />
                    {r.reason && <span style={{ color: "#9ca3af", marginLeft: 4 }}>({r.reason})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#dc2626", fontSize: 14 }}>
              {error}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[["pending", `Pending (${pending.length})`], ["history", `Paid (${history.length})`]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: "8px 20px", borderRadius: 10, fontSize: 14, fontWeight: 500,
                border: "1px solid #e5e7eb",
                background: tab === id ? "#111827" : "#fff",
                color:      tab === id ? "#fff"    : "#374151",
                cursor: "pointer",
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 80, background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb" }}>
              <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTop: "3px solid #6b7280", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
              <p style={{ color: "#6b7280", margin: 0 }}>Loading payouts…</p>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    {(tab === "pending"
                      ? ["Task", "Worker", "eSewa ID", "Payout (NPR)", "Fee (NPR)", "Released At", "Status"]
                      : ["Task", "Worker", "Payout (NPR)", "Fee (NPR)", "Ref ID", "Paid At", "Status"]
                    ).map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {tab === "pending" && pending.map((p, i) => (
                    <tr key={p.task_id} style={{ borderBottom: "1px solid #f3f4f6" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                      onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                    >
                      <td style={{ ...tdStyle, fontWeight: 600, color: "#111827" }}>{p.task_name}</td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: "#111827" }}>{p.worker_name}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{p.worker_email}</div>
                      </td>
                      <td style={tdStyle}>
                        {p.worker_esewa
                          ? <span style={{ color: "#374151" }}>{p.worker_esewa}</span>
                          : <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>Not set</span>}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "#111827" }}>{Number(p.worker_payout).toFixed(2)}</td>
                      <td style={{ ...tdStyle, color: "#9ca3af" }}>{Number(p.platform_fee).toFixed(2)}</td>
                      <td style={{ ...tdStyle, color: "#9ca3af" }}>{p.released_at ? new Date(p.released_at).toLocaleDateString() : "—"}</td>
                      <td style={tdStyle}><Pill status={p.worker_esewa ? "pending" : "skipped"} /></td>
                    </tr>
                  ))}

                  {tab === "history" && history.map((h, i) => (
                    <tr key={h.task_id} style={{ borderBottom: "1px solid #f3f4f6" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                      onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                    >
                      <td style={{ ...tdStyle, fontWeight: 600, color: "#111827" }}>{h.task_name}</td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: "#111827" }}>{h.worker_name}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{h.worker_email}</div>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "#111827" }}>{Number(h.worker_payout).toFixed(2)}</td>
                      <td style={{ ...tdStyle, color: "#9ca3af" }}>{Number(h.platform_fee).toFixed(2)}</td>
                      <td style={{ ...tdStyle, fontSize: 12, color: "#9ca3af", fontFamily: "monospace" }}>{h.esewa_ref_id || "—"}</td>
                      <td style={{ ...tdStyle, color: "#9ca3af" }}>{h.payout_at ? new Date(h.payout_at).toLocaleDateString() : "—"}</td>
                      <td style={tdStyle}><Pill status={h.payout_status || "paid"} /></td>
                    </tr>
                  ))}

                  {((tab === "pending" && pending.length === 0) || (tab === "history" && history.length === 0)) && (
                    <tr>
                      <td colSpan={7} style={{ padding: 80, textAlign: "center", color: "#9ca3af" }}>
                        {tab === "pending" ? "No pending payouts" : "No payout history yet"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  );
}