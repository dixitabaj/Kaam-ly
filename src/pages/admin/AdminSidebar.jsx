// AdminSidebar.tsx - Completely fixed sidebar
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, HardHat,
  FileText, ClipboardList,
  ChevronRight, ShieldAlert, Menu, X,
  DollarSign, RefreshCw
} from "lucide-react";

// ── Nav items config ──────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    section: null,
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard }
    ]
  },
  {
    section: "MANAGEMENT",
    items: [
      { id: "customers", label: "Customers", icon: Users },
      { id: "workers", label: "Workers", icon: HardHat },
      { id: "tasks", label: "Tasks", icon: ClipboardList },
      { id: "reports", label: "Reports", icon: FileText },
    ]
  },
  {
    section: "SECURITY",
    items: [
      { id: "fraud", label: "Fraud Detection", icon: ShieldAlert },
    ]
  }
];

// ── Single nav item ───────────────────────────────────────────────────────────
const NavItem = ({ item, active, onClick, isCollapsed }) => {
  const [hovered, setHovered] = useState(false);
  const isActive = active === item.id;
  const Icon = item.icon;

  if (isCollapsed) {
    return (
      <button
        onClick={() => onClick(item.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px",
          borderRadius: "10px",
          border: "none",
          cursor: "pointer",
          background: isActive
            ? "#F6AD56"
            : hovered
            ? "#fdf6ee"
            : "transparent",
          color: isActive ? "white" : hovered ? "#F6AD56" : "#3c3f44",
          transition: "all 0.15s ease",
          position: "relative",
        }}
      >
        <Icon
          size={20}
          style={{
            color: isActive ? "white" : hovered ? "#F6AD56" : "#6b7280",
          }}
        />
        {hovered && (
          <div style={{
            position: "absolute",
            left: "100%",
            marginLeft: "8px",
            background: "#1f2937",
            color: "white",
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "12px",
            whiteSpace: "nowrap",
            zIndex: 1000,
            pointerEvents: "none",
          }}>
            {item.label}
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => onClick(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 12px",
        borderRadius: "10px",
        border: "none",
        cursor: "pointer",
        background: isActive
          ? "#F6AD56"
          : hovered
          ? "#fdf6ee"
          : "transparent",
        color: isActive ? "white" : hovered ? "#F6AD56" : "#3c3f44",
        fontWeight: isActive ? "600" : "500",
        fontSize: "clamp(12px, 3vw, 14px)",
        textAlign: "left",
        transition: "all 0.15s ease",
        position: "relative",
      }}
    >
      <Icon
        size={18}
        style={{
          flexShrink: 0,
          color: isActive ? "white" : hovered ? "#F6AD56" : "#6b7280",
          transition: "color 0.15s",
        }}
      />
      <span style={{ flex: 1 }}>{item.label}</span>
      {isActive && <ChevronRight size={14} style={{ opacity: 0.7 }} />}
    </button>
  );
};

// ── Mobile Drawer ─────────────────────────────────────────────────────────────
const MobileDrawer = ({ isOpen, onClose, activeTab, onTabChange }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          zIndex: 9998,
          animation: "fadeIn 0.2s ease",
        }}
      />
      
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "min(280px, 85vw)",
          background: "white",
          boxShadow: "2px 0 8px rgba(0,0,0,0.1)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          animation: "slideIn 0.2s ease",
        }}
      >
        <div style={{
          padding: "20px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 44,
              minHeight: 44,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <nav style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
          {NAV_ITEMS.map(({ section, items }) => (
            <div key={section ?? "top"} style={{ marginBottom: "24px" }}>
              {section && (
                <div style={{
                  fontSize: "10px",
                  fontWeight: "700",
                  color: "#9ca3af",
                  letterSpacing: "1px",
                  padding: "0 12px",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                }}>
                  {section}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      onClose();
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "none",
                      cursor: "pointer",
                      background: activeTab === item.id ? "#F6AD56" : "transparent",
                      color: activeTab === item.id ? "white" : "#3c3f44",
                      fontWeight: activeTab === item.id ? "600" : "500",
                      fontSize: "14px",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
};

// ── Main Sidebar Component - FIXED POSITION ────────────────────────────────────
export default function AdminSidebar({ activeTab, onTabChange }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsCollapsed(false);
      }
    };
    
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const toggleCollapse = () => {
    if (!isMobile) {
      setIsCollapsed(!isCollapsed);
    }
  };

  // Mobile: show hamburger menu
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setIsMobileOpen(true)}
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: 1000,
            background: "#F6AD56",
            border: "none",
            borderRadius: "50%",
            width: "56px",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            color: "white",
          }}
        >
          <Menu size={24} />
        </button>

        <MobileDrawer
          isOpen={isMobileOpen}
          onClose={() => setIsMobileOpen(false)}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideIn {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
          }
        `}</style>
      </>
    );
  }

  // Desktop Sidebar - USING FIXED POSITION (not sticky)
  return (
    <>
      {/* Sidebar */}
      <div
        style={{
          width: isCollapsed ? "72px" : "240px",
          background: "white",
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          position: "fixed", // ← CHANGED from sticky to fixed
          top: "83px", // ← Start from very top
          left: 0,
          bottom: 0, // ← Stretch to bottom
          transition: "width 0.2s ease",
          overflow: "hidden",
          zIndex: 10,
        }}
      >
        <button
          onClick={toggleCollapse}
          style={{
            margin: "12px",
            padding: "8px",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            background: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s ease",
            flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
          onMouseLeave={e => e.currentTarget.style.background = "white"}
        >
          <ChevronRight
            size={18}
            style={{
              transform: isCollapsed ? "rotate(180deg)" : "none",
              transition: "transform 0.2s ease",
              color: "#6b7280",
            }}
          />
        </button>

        {/* Navigation - Scrollable area */}
        <nav
          style={{
            flex: 1,
            padding: isCollapsed ? "12px 8px" : "12px 12px",
            overflowY: "auto",
            overflowX: "hidden",
            minHeight: 0,
          }}
        >
          {NAV_ITEMS.map(({ section, items }) => (
            <div key={section ?? "top"} style={{ marginBottom: "20px" }}>
              {section && !isCollapsed && (
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: "700",
                    color: "#9ca3af",
                    letterSpacing: "1px",
                    padding: "0 12px",
                    marginBottom: "6px",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {section}
                </div>
              )}
              {section && isCollapsed && (
                <div style={{
                  height: "1px",
                  background: "#e5e7eb",
                  margin: "12px 8px",
                }} />
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {items.map(item => (
                  <NavItem
                    key={item.id}
                    item={item}
                    active={activeTab}
                    onClick={onTabChange}
                    isCollapsed={isCollapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Spacer div to push content to the right */}
      <div style={{ width: isCollapsed ? "72px" : "240px", flexShrink: 0 }} />

      <style>{`
        nav::-webkit-scrollbar {
          width: 4px;
        }
        nav::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        nav::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 4px;
        }
        nav::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
        
        nav {
          scroll-behavior: smooth;
        }
      `}</style>
    </>
  );
}