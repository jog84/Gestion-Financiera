import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

type CashflowEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

export function CashflowEmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: CashflowEmptyStateProps) {
  return (
    <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "var(--text-3)" }}>
      <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
        {icon}
      </div>
      <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-2)" }}>{title}</p>
      <p style={{ fontSize: "13px", maxWidth: "300px", textAlign: "center", marginBottom: "8px" }}>{description}</p>
      <Button onClick={onAction}>{actionLabel}</Button>
    </div>
  );
}
