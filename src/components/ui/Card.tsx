import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Card({ className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        boxShadow: "var(--shadow-sm)",
        transition: "all 0.2s ease",
        ...style,
      }}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between", className)}
      style={{ marginBottom: "16px" }}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(className)}
      style={{
        fontSize: "11px",
        fontWeight: 600,
        color: "var(--text-3)",
        letterSpacing: "0.07em",
        textTransform: "uppercase",
      }}
      {...props}
    />
  );
}

export function StatCard({
  label,
  value,
  color = "var(--text)",
  prefix,
  suffix,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  color?: string;
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  trend?: React.ReactNode;
}) {
  return (
    <Card>
      {/* Top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: color,
          opacity: 0.6,
          borderRadius: "var(--radius) var(--radius) 0 0",
        }}
      />
      <div className="flex items-start justify-between mb-3">
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {label}
        </span>
        {trend && <span style={{ opacity: 0.7 }}>{trend}</span>}
      </div>
      <div className="flex items-end gap-2">
        {icon && <span style={{ color, marginBottom: "2px" }}>{icon}</span>}
        <span
          style={{
            fontSize: "22px",
            fontWeight: 600,
            color,
            fontFamily: "var(--font-mono)",
            lineHeight: 1,
          }}
        >
          {prefix}{typeof value === "number" ? value.toLocaleString("es-AR") : value}{suffix}
        </span>
      </div>
    </Card>
  );
}
