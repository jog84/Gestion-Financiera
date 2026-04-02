import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, TrendingUp, TrendingDown, CreditCard,
  Briefcase, PiggyBank, Target, BarChart2, Settings, Sun, Moon, RefreshCw, Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { getDashboardMode, subscribeDashboardMode } from "@/lib/dashboardMode";
import { Logo } from "@/components/ui/Logo";
import { useProfile } from "@/app/providers/ProfileProvider";

const NAV_GROUPS = [
  {
    label: "Control",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/incomes", label: "Ingresos", icon: TrendingUp },
      { to: "/expenses", label: "Gastos", icon: TrendingDown },
      { to: "/installments", label: "Cuotas", icon: CreditCard },
      { to: "/recurring", label: "Recurrentes", icon: RefreshCw },
    ],
  },
  {
    label: "Patrimonio",
    items: [
      { to: "/accounts", label: "Cuentas", icon: Landmark },
      { to: "/investments", label: "Inversiones", icon: Briefcase },
      { to: "/assets", label: "Patrimonio", icon: PiggyBank },
      { to: "/goals", label: "Objetivos", icon: Target },
      { to: "/reports", label: "Reportes", icon: BarChart2 },
    ],
  },
];

export function Sidebar() {
  const { theme, toggle } = useTheme();
  const { profile } = useProfile();
  const [mode, setMode] = useState(getDashboardMode());

  useEffect(() => subscribeDashboardMode(setMode), []);

  const visibleGroups = mode === "pro" ? NAV_GROUPS : NAV_GROUPS.filter((group) => group.label === "Control");

  return (
    <aside
      className="flex h-screen flex-col transition-colors duration-200 glass"
      style={{
        width: "248px",
        minWidth: "248px",
        borderRight: "1px solid var(--border)",
        background: "transparent",
      }}
    >
      <div
        className="flex items-center gap-3 px-4 transition-colors duration-200"
        style={{ minHeight: "88px", borderBottom: "1px solid var(--border)", paddingTop: "10px", paddingBottom: "10px" }}
      >
        <div
          className="transition-transform duration-200 hover:scale-105 animate-glow"
          style={{ position: "relative", height: "40px", width: "118px", flexShrink: 0, display: "inline-block", color: "var(--text)" }}
        >
          <Logo theme={theme} style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", lineHeight: 1.1, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Hola
          </div>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", marginTop: "4px", lineHeight: 1.2, whiteSpace: "nowrap" }}>
            {profile?.name ?? "Mi Perfil"}
          </div>
        </div>
      </div>

      <nav className="flex flex-col flex-1 px-3 py-4" style={{ gap: "14px", overflowY: "auto" }}>
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0 10px", marginBottom: "6px" }}>
              {group.label}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 relative overflow-hidden",
                      isActive
                        ? "text-white shadow-[0_6px_18px_rgba(37,99,235,0.28)]"
                        : "text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                    )
                  }
                  style={({ isActive }) => ({
                    background: isActive
                      ? "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)"
                      : "transparent",
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={18} style={{ color: isActive ? "#ffffff" : "currentColor", flexShrink: 0 }} />
                      <span style={{ fontSize: "14px" }}>{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div style={{ borderTop: "1px solid var(--border)", padding: "8px" }} className="transition-colors duration-200">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-150",
              isActive ? "text-white bg-[var(--primary)]" : "text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Settings size={18} style={{ color: isActive ? "#ffffff" : "currentColor" }} />
              <span style={{ fontSize: "14px", fontWeight: 500 }}>Configuración</span>
            </>
          )}
        </NavLink>
        <button
          onClick={toggle}
          className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
          style={{ fontSize: "14px", fontWeight: 500 }}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          {theme === "dark" ? "Modo claro" : "Modo oscuro"}
        </button>
      </div>
    </aside>
  );
}
