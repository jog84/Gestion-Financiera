import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, TrendingUp, TrendingDown, CreditCard,
  Briefcase, PiggyBank, Target, BarChart2, Settings, Sun, Moon, RefreshCw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { getDefaultProfile } from "@/lib/api";
import { Logo } from "@/components/ui/Logo";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/incomes", label: "Ingresos", icon: TrendingUp },
  { to: "/expenses", label: "Gastos", icon: TrendingDown },
  { to: "/installments", label: "Cuotas", icon: CreditCard },
  { to: "/investments", label: "Inversiones", icon: Briefcase },
  { to: "/assets", label: "Patrimonio", icon: PiggyBank },
  { to: "/goals", label: "Objetivos", icon: Target },
  { to: "/recurring", label: "Recurrentes", icon: RefreshCw },
  { to: "/reports", label: "Reportes", icon: BarChart2 },
];

export function Sidebar() {
  const { theme, toggle } = useTheme();
  const { data: profile } = useQuery({ queryKey: ["default-profile"], queryFn: getDefaultProfile });

  return (
    <aside
      className="flex h-screen flex-col transition-colors duration-200 glass"
      style={{
        width: "220px",
        minWidth: "220px",
        borderRight: "1px solid var(--border)",
        background: "transparent", // background is handled by .glass
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 transition-colors duration-200"
        style={{ height: "64px", borderBottom: "1px solid var(--border)" }}
      >
        <div
          className="transition-transform duration-200 hover:scale-105 animate-glow"
          style={{ position: "relative", height: "30px", width: "30px", flexShrink: 0, display: "inline-block", color: "var(--text)" }}
        >
          <Logo theme={theme} style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", lineHeight: 1.2, whiteSpace: "nowrap" }}>
            {profile?.name ? `Hola, ${profile.name}` : "Finanzas Personales"}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col flex-1 px-3 py-4" style={{ gap: "2px", overflowY: "auto" }}>
        <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "0 8px", marginBottom: "6px" }}>
          General
        </div>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 relative overflow-hidden",
                isActive
                  ? "text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
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
                <Icon
                  size={18}
                  style={{ color: isActive ? "#ffffff" : "currentColor", flexShrink: 0 }}
                />
                <span style={{ fontSize: "14px" }}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "8px" }} className="transition-colors duration-200">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150",
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
          className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 transition-all text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
          style={{ fontSize: "14px", fontWeight: 500 }}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          {theme === "dark" ? "Modo claro" : "Modo oscuro"}
        </button>
      </div>
    </aside>
  );
}
