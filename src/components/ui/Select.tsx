import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, options, placeholder, style, ...props }, ref) => {
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
        <div style={{ position: "relative" }}>
          <select
            ref={ref}
            id={id}
            style={{
              height: "34px",
              width: "100%",
              appearance: "none",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${error ? "var(--danger)" : "var(--border-light)"}`,
              background: "var(--surface-2)",
              padding: "0 32px 0 10px",
              fontSize: "13px",
              color: "var(--text)",
              fontFamily: "var(--font-ui)",
              outline: "none",
              cursor: "pointer",
              ...style,
            }}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: "var(--surface-2)" }}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-3)",
              pointerEvents: "none",
            }}
          />
        </div>
        {error && <p style={{ fontSize: "12px", color: "var(--danger)" }}>{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
export { Select };
