import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  HardHat,
  ClipboardList,
  FileText,
  DollarSign,
  Star,
  ChevronRight,
} from "lucide-react";

export default function Sidebar({ workerId }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  const getActive = () => {
    if (location.pathname.includes("overview")) return "overview";
    if (location.pathname.includes("earning"))  return "earnings";
    if (location.pathname.includes("reviews"))  return "reviews";
    if (location.pathname.includes("task"))     return "tasks";
    return "overview";
  };

  const [active, setActive] = useState(getActive());

  const go = (name) => {
    setActive(name);
    if (name === "overview") navigate(`/worker/dashboard/overview/${workerId}`);
    if (name === "earnings") navigate(`/worker/dashboard/earning/${workerId}`);
    if (name === "reviews")  navigate(`/worker/dashboard/reviews/${workerId}`);
    if (name === "tasks")    navigate(`/worker/dashboard/task/${workerId}`);
  };

  const Item = ({ name, label, icon: Icon }) => {
    const isActive = active === name;
    return (
      <button
        onClick={() => go(name)}
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          width:          "100%",
          padding:        "13px 16px",
          borderRadius:   "14px",
          border:         "none",
          cursor:         "pointer",
          fontFamily:     "inherit",
          fontSize:       "15px",
          fontWeight:     isActive ? 700 : 500,
          color:          isActive ? "#fff" : "#4b5563",
          background:     isActive ? "#f6a832" : "transparent",
          boxShadow:      isActive ? "0 4px 14px rgba(246,168,50,0.35)" : "none",
          transition:     "all 0.18s ease",
          textAlign:      "left",
        }}
        onMouseEnter={e => {
          if (!isActive) e.currentTarget.style.background = "#fff7ed";
        }}
        onMouseLeave={e => {
          if (!isActive) e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
          {label}
        </span>
        {isActive && <ChevronRight size={16} strokeWidth={2.5} />}
      </button>
    );
  };

  return (
    <div style={{
      width:           "320px",
      flexShrink:      0,
      backgroundColor: "#ffffff",
      padding:         "1.5rem 1rem",
      fontFamily:      "'DM Sans', 'Inter', sans-serif",
      position:        "sticky",
      top:             "90px",
      alignSelf:       "flex-start",
      boxShadow:       "0 2px 16px rgba(0,0,0,0.07)",
      border:          "1px solid #f1f5f9",
      height: "800px"
    }}>

      {/* Overview (top, no section label) */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Item name="overview" label="Overview" icon={LayoutDashboard} />
      </div>

      {/* Management section */}
      <div>
        <p style={{
          fontSize:      "11px",
          fontWeight:    700,
          letterSpacing: "0.1em",
          color:         "#9ca3af",
          textTransform: "uppercase",
          padding:       "0 8px",
          marginBottom:  "10px",
        }}>
          Management
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <Item name="earnings" label="Earnings"  icon={DollarSign}    />
          <Item name="reviews"  label="Reviews"   icon={Star}          />
          <Item name="tasks"    label="Tasks"     icon={ClipboardList} />
        </div>
      </div>

    </div>
  );
}