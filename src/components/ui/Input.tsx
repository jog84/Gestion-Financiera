import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, style, ...props }, ref) => {
    return (
      <div className="flex flex-col" style={{ gap: "6px" }}>
        {label && (
          <label
            htmlFor={id}
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-3)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(className)}
          style={{
            height: "34px",
            width: "100%",
            borderRadius: "var(--radius-sm)",
            border: `1px solid ${error ? "var(--danger)" : "var(--border-light)"}`,
            background: "var(--surface-2)",
            padding: "0 10px",
            fontSize: "13px",
            color: "var(--text)",
            fontFamily: "var(--font-ui)",
            outline: "none",
            transition: "border-color 0.15s, box-shadow 0.15s",
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--primary)";
            e.currentTarget.style.boxShadow = "0 0 0 3px var(--primary-dim)";
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? "var(--danger)" : "var(--border-light)";
            e.currentTarget.style.boxShadow = "none";
            props.onBlur?.(e);
          }}
          {...props}
        />
        {error && (
          <p style={{ fontSize: "12px", color: "var(--danger)" }}>{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input };
