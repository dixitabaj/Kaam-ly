import React, { useState, useRef, useEffect } from "react";
import { Flag, X, AlertCircle, Camera, Trash2, Search } from "lucide-react";

const REPORT_REASONS = [
  "Fraud / Scam",
  "Harassment",
  "No show",
  "Poor quality",
  "Fake profile",
  "Inappropriate",
  "Other",
];

const ReportModal = ({ task, customerId, onClose, onSubmitted }) => {
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Worker search (only used when no task context)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [searching, setSearching] = useState(false);

  const fileInputRef = useRef(null);
  const searchTimeout = useRef(null);

  const hasTaskContext = Boolean(task?.assignedWorkerId);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [previewUrl]);

  // Debounced worker search
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSelectedWorker(null);
    setSearchResults([]);

    if (val.trim().length < 2) return;

    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/workers/search/?q=${encodeURIComponent(val)}&limit=5`);
        const data = await res.json();
        // Expecting: [{ id, name, service_type, area }, ...]
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { setError("File size must be under 5MB"); return; }
      setEvidence(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleSubmit = async () => {
    const finalReason = reason === "Other" ? customReason : reason;
    if (!finalReason) { setError("Please select a reason."); return; }

    const reportedId = hasTaskContext ? task.assignedWorkerId : selectedWorker?.id;
    if (!reportedId) {
      setError(hasTaskContext ? "Worker ID missing." : "Please search for and select the worker you want to report.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("reporterId", customerId || "anonymous");
    formData.append("reporterType", "customer");
    formData.append("reportedId", reportedId);
    formData.append("reportedType", "worker");
    formData.append("reason", finalReason);
    formData.append("description", description || "");
    if (evidence) formData.append("evidence", evidence);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/reports", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail?.[0]?.msg || "Failed to submit");
      }
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.titleGroup}>
            <div style={styles.iconBadge}><Flag size={18} color="#e11d48" /></div>
            <h2 style={styles.title}>Report Worker</h2>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
        </div>

        {/* Worker identification */}
        {hasTaskContext ? (
          <div style={styles.workerBanner}>
            <span style={styles.workerBannerLabel}>Reporting worker from booking</span>
            <span style={styles.workerBannerValue}>{task.assignedWorkerId}</span>
          </div>
        ) : (
          <div style={styles.section}>
            <label style={styles.label}>
              Search Worker <span style={{ color: '#e11d48' }}>*</span>
            </label>

            <div style={styles.searchWrapper}>
              <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Type worker's name..."
                value={searchQuery}
                onChange={handleSearchChange}
                style={styles.searchInput}
              />
              {searching && <span style={styles.searchSpinner}>⏳</span>}
            </div>

            {/* Search results dropdown */}
            {searchResults.length > 0 && !selectedWorker && (
              <div style={styles.dropdown}>
                {searchResults.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setSelectedWorker(w);
                      setSearchQuery(w.name);
                      setSearchResults([]);
                      setError(null);
                    }}
                    style={styles.dropdownItem}
                  >
                    <div style={styles.dropdownName}>{w.name}</div>
                    <div style={styles.dropdownSub}>{w.service_type} · {w.area || "Nepal"}</div>
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && !selectedWorker && (
              <span style={styles.hint}>No workers found. Try a different name.</span>
            )}

            {/* Selected worker confirmed */}
            {selectedWorker && (
              <div style={styles.selectedWorker}>
                <div>
                  <div style={styles.selectedName}>{selectedWorker.name}</div>
                  <div style={styles.selectedSub}>{selectedWorker.service_type} · ID: {selectedWorker.id}</div>
                </div>
                <button
                  onClick={() => { setSelectedWorker(null); setSearchQuery(""); }}
                  style={styles.clearSelected}
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Reason */}
        <div style={styles.section}>
          <label style={styles.label}>Reason <span style={{ color: '#e11d48' }}>*</span></label>
          <div style={styles.grid}>
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => { setReason(r); setError(null); }}
                style={{ ...styles.reasonBtn, ...(reason === r ? styles.reasonBtnActive : {}) }}
              >
                {r}
              </button>
            ))}
          </div>
          {reason === "Other" && (
            <input
              type="text"
              placeholder="Please specify..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              style={{ ...styles.textInput, marginTop: "8px" }}
            />
          )}
        </div>

        {/* Evidence */}
        <div style={styles.section}>
          <label style={styles.label}>Evidence Photo (Optional)</label>
          {!previewUrl ? (
            <div style={styles.uploadBox} onClick={() => fileInputRef.current.click()}>
              <Camera size={24} color="#94a3b8" />
              <span style={{ fontSize: '13px', color: '#64748b' }}>Upload proof (max 5MB)</span>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" hidden />
            </div>
          ) : (
            <div style={styles.previewContainer}>
              <img src={previewUrl} alt="Evidence" style={styles.previewImg} />
              <button onClick={() => { setEvidence(null); setPreviewUrl(null); }} style={styles.removeImgBtn}>
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        <div style={styles.section}>
          <label style={styles.label}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details help us investigate faster..."
            rows={3}
            style={styles.textarea}
          />
        </div>

        {error && (
          <div style={styles.errorAlert}>
            <AlertCircle size={16} />{error}
          </div>
        )}

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ ...styles.submitBtn, ...(submitting ? { opacity: 0.6 } : {}) }}
          >
            {submitting ? "Sending..." : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "16px" },
  modal: { background: "white", borderRadius: "20px", padding: "24px", maxWidth: "460px", width: "100%", maxHeight: "90vh", overflowY: "auto" },
  header: { display: "flex", justifyContent: "space-between", marginBottom: "20px" },
  titleGroup: { display: "flex", gap: "10px", alignItems: "center" },
  iconBadge: { width: "36px", height: "36px", borderRadius: "10px", background: "#fff1f2", display: "flex", alignItems: "center", justifyContent: "center" },
  title: { fontSize: "18px", fontWeight: "700", margin: 0 },
  closeBtn: { background: "none", border: "none", cursor: "pointer", color: "#94a3b8" },
  workerBanner: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "2px" },
  workerBannerLabel: { fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" },
  workerBannerValue: { fontSize: "14px", fontWeight: "600", color: "#1e293b" },
  section: { marginBottom: "16px" },
  label: { display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: "#475569" },
  hint: { display: "block", fontSize: "12px", color: "#94a3b8", marginTop: "6px" },
  searchWrapper: { position: "relative", display: "flex", alignItems: "center" },
  searchInput: { width: "100%", padding: "10px 14px 10px 34px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "14px", outline: "none", boxSizing: "border-box" },
  searchSpinner: { position: "absolute", right: "10px", fontSize: "12px" },
  dropdown: { border: "1px solid #e2e8f0", borderRadius: "10px", marginTop: "4px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
  dropdownItem: { width: "100%", padding: "10px 14px", background: "white", border: "none", borderBottom: "1px solid #f1f5f9", cursor: "pointer", textAlign: "left", display: "block" },
  dropdownName: { fontSize: "14px", fontWeight: "600", color: "#151516" },
  dropdownSub: { fontSize: "12px", color: "#94a3b8", marginTop: "2px" },
  selectedWorker: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fdfcf5", border: "1px solid #e9e9e9", borderRadius: "10px", padding: "10px 14px", marginTop: "6px" },
  selectedName: { fontSize: "14px", fontWeight: "600", color: "#202020" },
  selectedSub: { fontSize: "12px", color: "#4d4d4d", marginTop: "2px" },
  clearSelected: { background: "none", border: "none", cursor: "pointer", color: "#353631", padding: "2px" },
  textInput: { width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "14px", outline: "none", boxSizing: "border-box" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" },
  reasonBtn: { padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "white", color: "#475569", cursor: "pointer", fontSize: "13px", textAlign: "left" },
  reasonBtnActive: { borderColor: "#e11d48", background: "#fff1f2", color: "#e11d48", fontWeight: "600" },
  uploadBox: { border: "2px dashed #e2e8f0", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", cursor: "pointer" },
  previewContainer: { position: "relative", width: "100%", height: "150px", borderRadius: "12px", overflow: "hidden" },
  previewImg: { width: "100%", height: "100%", objectFit: "cover" },
  removeImgBtn: { position: "absolute", top: "8px", right: "8px", background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "8px", padding: "6px", cursor: "pointer", color: "#e11d48" },
  textarea: { width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "14px", resize: "none", boxSizing: "border-box" },
  errorAlert: { color: "#e11d48", background: "#fff1f2", padding: "10px", borderRadius: "8px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" },
  footer: { display: "flex", gap: "10px" },
  cancelBtn: { flex: 1, padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "white", fontWeight: "600", cursor: "pointer" },
  submitBtn: { flex: 2, padding: "12px", borderRadius: "12px", border: "none", background: "#e11d48", color: "white", fontWeight: "600", cursor: "pointer" },
};

export default ReportModal;