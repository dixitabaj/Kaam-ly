import { useState } from "react";
import {
  LayoutDashboard, Users, HardHat, MapPin,
  FileText, ClipboardList, Settings, LogOut,
  ChevronRight, Bell
} from "lucide-react";

// ── Nav items config ──────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    section: null,
    items: [
      { id: "dashboard", label: "Overview",   icon: LayoutDashboard },
    ]
  },
  {
    section: "MANAGEMENT",
    items: [
      { id: "customers", label: "Customers",   icon: Users    },
      { id: "workers",   label: "Workers",     icon: HardHat  },
      { id: "tasks",     label: "Tasks",       icon: ClipboardList },
      { id: "reports",   label: "Reports",     icon: FileText },
    ]
  }
];

// ── Single nav item ───────────────────────────────────────────────────────────
const NavItem = ({ item, active, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const isActive = active === item.id;
  const Icon = item.icon;

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
        fontSize: "14px",
        textAlign: "left",
        transition: "all 0.15s ease",
        position: "relative",
        boxShadow: isActive ? "0 4px 12px #e9c292" : "none",
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

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function AdminSidebar({ activeTab, onTabChange }) {
  return (
    <div style={{
      width: "240px",
      background: "white",
      borderRight: "1px solid #e5e7eb",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      position: "sticky",
      top: "102px",
      height: "730px",
    }}>
      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: "12px 12px", overflowY: "auto" }}>
        {NAV_ITEMS.map(({ section, items }) => (
          <div key={section ?? "top"} style={{ marginBottom: "20px" }}>
            {section && (
              <div style={{
                fontSize: "10px",
                fontWeight: "700",
                color: "#9ca3af",
                letterSpacing: "1px",
                padding: "0 12px",
                marginBottom: "6px",
                textTransform: "uppercase",
              }}>
                {section}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {items.map(item => (
                <NavItem
                  key={item.id}
                  item={item}
                  active={activeTab}
                  onClick={onTabChange}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}