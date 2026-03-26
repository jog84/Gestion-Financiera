import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, X, AlertCircle, AlertTriangle, Info, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAlerts, markAlertRead, markAllAlertsRead, deleteAlert } from "@/lib/api";
import type { Alert, AlertKind } from "@/types";
import { useProfile } from "@/app/providers/ProfileProvider";
import { QK } from "@/lib/queryKeys";
function alertIcon(kind: AlertKind) {
  if (kind === "budget_exceeded") return <AlertCircle size={14} style={{ color: "var(--danger)", flexShrink: 0 }} />;
  if (kind === "budget_warning") return <AlertTriangle size={14} style={{ color: "var(--warning)", flexShrink: 0 }} />;
  if (kind === "goal_reached" || kind === "goal_milestone") return <Target size={14} style={{ color: "var(--success)", flexShrink: 0 }} />;
  return <Info size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />;
}

function alertRoute(kind: AlertKind): string {
  if (kind.startsWith("budget")) return "/expenses";
  if (kind.startsWith("goal")) return "/goals";
  if (kind === "installment_due") return "/installments";
  if (kind === "price_target") return "/investments";
  return "/";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

export function AlertBell() {
  const { profileId } = useProfile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: QK.alerts(profileId, false),
    queryFn: () => getAlerts(profileId, false),
    refetchInterval: 60_000,
  });

  const unread = alerts.filter((a) => !a.is_read).length;

  const readMutation = useMutation({
    mutationFn: markAlertRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts", profileId] }),
  });

  const readAllMutation = useMutation({
    mutationFn: () => markAllAlertsRead(profileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts", profileId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts", profileId] }),
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleClick = (alert: Alert) => {
    if (!alert.is_read) readMutation.mutate(alert.id);
    navigate(alertRoute(alert.kind));
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-[var(--text-3)] hover:text-[var(--text)] transition-colors rounded-full hover:bg-[var(--surface-2)]"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute", top: "4px", right: "4px",
              width: "16px", height: "16px",
              background: "var(--danger)", borderRadius: "50%",
              border: "2px solid var(--surface)",
              fontSize: "9px", fontWeight: 700, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-ui)",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "340px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
            zIndex: 9999,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-ui)" }}>
              Alertas {unread > 0 && <span style={{ color: "var(--danger)" }}>({unread})</span>}
            </span>
            {unread > 0 && (
              <button
                onClick={() => readAllMutation.mutate()}
                style={{ fontSize: "11px", color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)" }}
              >
                Marcar todo como leído
              </button>
            )}
          </div>

          {/* Alert list */}
          <div style={{ maxHeight: "360px", overflowY: "auto" }}>
            {alerts.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-3)", fontSize: "13px", fontFamily: "var(--font-ui)" }}>
                Sin alertas pendientes
              </div>
            ) : (
              alerts.slice(0, 20).map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--border)",
                    background: alert.is_read ? "transparent" : "color-mix(in srgb, var(--primary) 5%, transparent)",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--surface-2)"; }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = alert.is_read ? "transparent" : "color-mix(in srgb, var(--primary) 5%, transparent)";
                  }}
                  onClick={() => handleClick(alert)}
                >
                  <div style={{ marginTop: "1px" }}>{alertIcon(alert.kind)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)", margin: 0, fontFamily: "var(--font-ui)", lineHeight: 1.3 }}>
                      {alert.title}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--text-3)", margin: "3px 0 0", fontFamily: "var(--font-ui)", lineHeight: 1.4 }}>
                      {alert.body}
                    </p>
                    <p style={{ fontSize: "10px", color: "var(--text-3)", margin: "4px 0 0", fontFamily: "var(--font-ui)" }}>
                      {timeAgo(alert.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(alert.id); }}
                    style={{ padding: "2px", background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", borderRadius: "4px", flexShrink: 0 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}



