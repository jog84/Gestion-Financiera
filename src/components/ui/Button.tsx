import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "outline" | "success";
  size?: "xs" | "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", style, onMouseEnter, onMouseLeave, ...props }, ref) => {
    const base: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      borderRadius: "10px",
      fontFamily: "var(--font-ui)",
      fontWeight: 500,
      cursor: "pointer",
      transition: "opacity 0.15s ease, background 0.15s ease, box-shadow 0.15s ease",
      border: "none",
      outline: "none",
      letterSpacing: "0.01em",
      whiteSpace: "nowrap",
    };

    const variants: Record<string, React.CSSProperties> = {
      primary: {
        background: "var(--primary)",
        color: "#fff",
        boxShadow: "0 1px 4px rgba(67,97,238,0.3)",
      },
      ghost: {
        background: "var(--surface-2)",
        color: "var(--text-2)",
        border: "1px solid var(--border)",
      },
      danger: {
        background: "var(--danger)",
        color: "#fff",
        boxShadow: "0 1px 4px rgba(239,35,60,0.25)",
      },
      success: {
        background: "var(--success)",
        color: "#fff",
        boxShadow: "0 1px 4px rgba(6,214,160,0.25)",
      },
      outline: {
        background: "transparent",
        color: "var(--text)",
        border: "1px solid var(--border)",
      },
    };

    const sizes: Record<string, React.CSSProperties> = {
      xs: { height: "26px", padding: "0 9px", fontSize: "11px", gap: "4px", borderRadius: "7px" },
      sm: { height: "30px", padding: "0 12px", fontSize: "12px" },
      md: { height: "38px", padding: "0 18px", fontSize: "13px" },
      lg: { height: "42px", padding: "0 22px", fontSize: "14px" },
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (variant === "primary")  { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(67,97,238,0.4)"; }
      if (variant === "ghost")   { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text)"; }
      if (variant === "danger")  { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(239,35,60,0.35)"; }
      if (variant === "success") { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(6,214,160,0.35)"; }
      if (variant === "outline") { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.borderColor = "var(--border-light)"; }
      onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (variant === "primary")  { e.currentTarget.style.opacity = "1"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(67,97,238,0.3)"; }
      if (variant === "ghost")   { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-2)"; }
      if (variant === "danger")  { e.currentTarget.style.opacity = "1"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(239,35,60,0.25)"; }
      if (variant === "success") { e.currentTarget.style.opacity = "1"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(6,214,160,0.25)"; }
      if (variant === "outline") { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border)"; }
      onMouseLeave?.(e);
    };

    return (
      <button
        ref={ref}
        className={cn("disabled:opacity-40 disabled:cursor-not-allowed", className)}
        style={{ ...base, ...variants[variant], ...sizes[size], ...style }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
export { Button };
