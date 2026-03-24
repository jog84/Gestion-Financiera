interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "danger" | "warning" | "info";
}

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  default: { background: "var(--surface-3)", color: "var(--text-2)" },
  success: { background: "var(--success-dim)", color: "var(--success)" },
  danger:  { background: "var(--danger-dim)",  color: "var(--danger)" },
  warning: { background: "var(--warning-dim)", color: "var(--warning)" },
  info:    { background: "var(--primary-dim)", color: "var(--primary)" },
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        borderRadius: "4px",
        padding: "2px 7px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.02em",
        ...VARIANT_STYLES[variant],
      }}
    >
      <span
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "currentColor",
          opacity: 0.8,
          flexShrink: 0,
        }}
      />
      {children}
    </span>
  );
}
