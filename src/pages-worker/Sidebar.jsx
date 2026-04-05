import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  DollarSign,
  Star,
  ClipboardList,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

export default function Sidebar({ workerId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const getActive = () => {
    if (location.pathname.includes("overview")) return "overview";
    if (location.pathname.includes("earning")) return "earnings";
    if (location.pathname.includes("reviews")) return "reviews";
    if (location.pathname.includes("task")) return "tasks";
    return "overview";
  };

  const [active, setActive] = useState(getActive());

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileOpen]);

  const go = (name) => {
    setActive(name);
    if (name === "overview") navigate(`/worker/dashboard/overview/${workerId}`);
    if (name === "earnings") navigate(`/worker/dashboard/earning/${workerId}`);
    if (name === "reviews") navigate(`/worker/dashboard/reviews/${workerId}`);
    if (name === "tasks") navigate(`/worker/dashboard/task/${workerId}`);
  };

  const Item = ({ name, label, icon: Icon }) => {
    const isActive = active === name;
    return (
      <button
        onClick={() => go(name)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "13px 16px",
          borderRadius: "14px",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "15px",
          fontWeight: isActive ? 700 : 500,
          color: isActive ? "#fff" : "#4b5563",
          background: isActive ? "#f6a832" : "transparent",
          boxShadow: isActive ? "0 4px 14px rgba(246,168,50,0.35)" : "none",
          transition: "all 0.18s ease",
          textAlign: "left",
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = "#fff7ed";
        }}
        onMouseLeave={(e) => {
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
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        style={{
          position: "fixed",
          top: "100px",
          left: "1rem",
          zIndex: 1001,
          padding: "0.75rem",
          background: "#f6a832",
          border: "none",
          borderRadius: "12px",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(246,168,50,0.4)",
          display: "none",
        }}
        className="mobile-menu-toggle"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X size={20} color="#fff" /> : <Menu size={20} color="#fff" />}
      </button>

      {/* Overlay */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 999,
            display: "none",
          }}
          className="mobile-overlay"
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          width: "320px",
          flexShrink: 0,
          backgroundColor: "#ffffff",
          padding: "1.5rem 1rem",
          fontFamily: "'DM Sans', 'Inter', sans-serif",
          position: "fixed",
          top: "89px",
          left: 0,
          height: "calc(100vh - 89px)",
          overflowY: "auto",
          boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
          border: "1px solid #f1f5f9",
          zIndex: 1000,
          transition: "transform 0.3s ease",
        }}
        className="sidebar"
      >
        {/* Overview */}
        <div style={{ marginBottom: "1.5rem" }}>
          <Item name="overview" label="Overview" icon={LayoutDashboard} />
        </div>

        {/* Management section */}
        <div>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "#9ca3af",
              textTransform: "uppercase",
              padding: "0 8px",
              marginBottom: "10px",
            }}
          >
            Management
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <Item name="earnings" label="Earnings" icon={DollarSign} />
            <Item name="reviews" label="Reviews" icon={Star} />
            <Item name="tasks" label="Tasks" icon={ClipboardList} />
          </div>
        </div>
      </div>

      {/* Responsive CSS */}
      <style>{`
        /* Tablet and below */
        @media (max-width: 1024px) {
          .sidebar {
            transform: translateX(${isMobileOpen ? "0" : "-100%"}) !important;
          }
          
          .mobile-menu-toggle {
            display: block !important;
          }
          
          .mobile-overlay {
            display: block !important;
          }
        }

        /* Mobile phones */
        @media (max-width: 640px) {
          .sidebar {
            width: 280px !important;
          }
        }
      `}</style>
    </>
  );
}