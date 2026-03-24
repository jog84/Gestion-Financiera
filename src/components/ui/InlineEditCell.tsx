import { useState, useRef, useEffect } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface InlineEditCellProps {
  value: string;
  displayValue?: string;
  type?: "text" | "number" | "date" | "select";
  options?: SelectOption[];
  onCommit: (newValue: string) => void;
  mono?: boolean;
  align?: "left" | "right";
  color?: string;
  placeholder?: string;
}

export function InlineEditCell({
  value,
  displayValue,
  type = "text",
  options,
  onCommit,
  mono = false,
  align = "left",
  color,
  placeholder,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") cancel();
  };

  const sharedStyle: React.CSSProperties = {
    fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)",
    fontSize: "12px",
    textAlign: align,
    color: color ?? "inherit",
    background: "transparent",
    outline: "none",
  };

  if (editing) {
    if (type === "select" && options) {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          style={{
            ...sharedStyle,
            background: "var(--surface-2)",
            border: "1px solid var(--primary)",
            borderRadius: "4px",
            padding: "2px 4px",
            width: "100%",
            cursor: "pointer",
            color: "var(--text)",
          }}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type === "number" ? "text" : type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          ...sharedStyle,
          background: "var(--surface-2)",
          border: "1px solid var(--primary)",
          borderRadius: "4px",
          padding: "2px 6px",
          width: "100%",
          minWidth: "80px",
          color: "var(--text)",
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Click para editar"
      style={{
        ...sharedStyle,
        cursor: "text",
        display: "block",
        width: "100%",
        borderRadius: "4px",
        padding: "2px 4px",
        transition: "background 0.1s",
        userSelect: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLSpanElement).style.background = "color-mix(in srgb, var(--primary) 10%, transparent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLSpanElement).style.background = "transparent";
      }}
    >
      {(displayValue ?? value) || <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>—</span>}
    </span>
  );
}
