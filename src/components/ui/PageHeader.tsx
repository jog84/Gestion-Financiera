import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div
      className="animate-fade-in-up"
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "16px",
        marginBottom: "24px",
        flexWrap: "wrap",
      }}
    >
      <div>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {title}
        </h1>
        {description && (
          <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "6px", lineHeight: 1.6 }}>
            {description}
          </div>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {actions}
        </div>
      )}
    </div>
  );
}
