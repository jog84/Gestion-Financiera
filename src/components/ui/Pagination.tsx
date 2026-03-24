interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
}: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1 && total <= pageSizeOptions[0]) return null;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  const btnStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
    minWidth: "32px",
    height: "32px",
    padding: "0 8px",
    borderRadius: "8px",
    border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
    background: active ? "var(--primary)" : "var(--surface)",
    color: active ? "#fff" : disabled ? "var(--text-3)" : "var(--text-2)",
    fontSize: "12px",
    fontFamily: "var(--font-ui)",
    fontWeight: active ? 600 : 400,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "all 0.12s",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  });

  // Build page range
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) pages.push(i);
  } else {
    pages.push(0);
    if (page > 2) pages.push("...");
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i);
    if (page < totalPages - 3) pages.push("...");
    pages.push(totalPages - 1);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
      <span style={{ fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-ui)" }}>
        {from}–{to} de {total} registros
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <button
          style={btnStyle(false, page === 0)}
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} style={{ fontSize: "12px", color: "var(--text-3)", padding: "0 4px" }}>…</span>
          ) : (
            <button key={p} style={btnStyle(p === page, false)} onClick={() => onPageChange(p as number)}>
              {(p as number) + 1}
            </button>
          )
        )}
        <button
          style={btnStyle(false, page >= totalPages - 1)}
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </button>
      </div>
      {onPageSizeChange && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-ui)" }}>Filas:</span>
          <select
            value={pageSize}
            onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(0); }}
            style={{
              fontSize: "12px",
              fontFamily: "var(--font-ui)",
              color: "var(--text-2)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "4px 8px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
