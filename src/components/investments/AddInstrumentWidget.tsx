import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Loader, Search, X } from "lucide-react";
import {
  addTickerToInversiones,
  searchInversionesInstruments,
  type InversionesInstrument,
} from "@/lib/api";

const ASSET_CLASSES = [
  { value: "CEDEAR", label: "CEDEAR" },
  { value: "ACCION", label: "Acción" },
  { value: "BONO_SOBERANO", label: "Bono soberano" },
  { value: "BONO_CORPORATIVO", label: "Bono corporativo" },
];

interface Props {
  onAnalyze: (ticker: string) => void;
}

export function AddInstrumentWidget({ onAnalyze }: Props) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Buscar instrumentos existentes en Inversiones AR
  const { data: suggestions = [] } = useQuery({
    queryKey: ["inversiones-search", query],
    queryFn: () => searchInversionesInstruments(query),
    enabled: query.length >= 1,
    staleTime: 30_000,
  });

  const isNewTicker =
    query.length >= 2 &&
    query.length <= 10 &&
    /^[A-Za-z0-9]+$/.test(query) &&
    !suggestions.some((s) => s.ticker.toUpperCase() === query.toUpperCase());

  const addMutation = useMutation({
    mutationFn: ({ ticker, ac }: { ticker: string; ac: string }) =>
      addTickerToInversiones(ticker, ac),
    onSuccess: (result) => {
      setStatus({
        type: "success",
        msg: `${result.ticker} agregado — ${result.bars_count} barras, ${result.has_signal ? "señal generada ✓" : "sin señal aún"}`,
      });
      setQuery("");
      setShowDropdown(false);
      setTimeout(() => {
        onAnalyze(result.ticker);
        setStatus(null);
      }, 1500);
    },
    onError: (err: any) => {
      setStatus({ type: "error", msg: String(err) });
    },
  });

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (instrument: InversionesInstrument) => {
    setShowDropdown(false);
    setQuery("");
    onAnalyze(instrument.ticker);
  };

  const handleAdd = (ac: string) => {
    if (!query.trim()) return;
    setStatus(null);
    addMutation.mutate({ ticker: query.trim().toUpperCase(), ac });
  };

  return (
    <div style={{
      border: "1px solid var(--border-light)",
      borderRadius: "var(--radius)",
      background: "var(--surface)",
      padding: "12px 14px",
      marginBottom: "16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
        <Search size={14} color="var(--primary)" />
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Buscar / Agregar instrumento
        </span>
      </div>

      <div style={{ position: "relative", display: "flex", gap: "8px", alignItems: "flex-start" }}>
        {/* Input de búsqueda */}
        <div style={{ position: "relative", flex: 1 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value.toUpperCase()); setShowDropdown(true); setStatus(null); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Ej: GGAL, MELI, TSLA..."
            style={{
              width: "100%",
              height: "34px",
              borderRadius: "7px",
              border: "1px solid var(--border-light)",
              background: "var(--surface-2)",
              padding: "0 30px 0 10px",
              fontSize: "13px",
              color: "var(--text)",
              fontFamily: "var(--font-ui)",
              outline: "none",
              boxSizing: "border-box",
            }}
            onKeyDown={(e) => { if (e.key === "Escape") { setShowDropdown(false); setQuery(""); } }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setStatus(null); }}
              style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}
            >
              <X size={13} />
            </button>
          )}

          {/* Dropdown de sugerencias */}
          {showDropdown && query.length >= 1 && (suggestions.length > 0 || isNewTicker) && (
            <div
              ref={dropdownRef}
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0, right: 0,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                zIndex: 100,
                overflow: "hidden",
                maxHeight: "220px",
                overflowY: "auto",
              }}
            >
              {suggestions.map((s) => (
                <button
                  key={s.ticker}
                  onClick={() => handleSelect(s)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", background: "none", border: "none",
                    cursor: "pointer", textAlign: "left",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <div>
                    <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--text)" }}>{s.ticker}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>{s.name}</span>
                  </div>
                  <span style={{
                    fontSize: "10px", padding: "1px 6px", borderRadius: "4px",
                    background: "var(--surface-3)", color: "var(--text-muted)",
                  }}>{s.asset_class}</span>
                </button>
              ))}

              {isNewTicker && (
                <div style={{ padding: "8px 12px", background: "color-mix(in srgb, var(--primary) 6%, transparent)" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>
                    <strong style={{ color: "var(--primary)" }}>{query}</strong> no está en Inversiones AR — agregarlo como:
                  </div>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {ASSET_CLASSES.map((ac) => (
                      <button
                        key={ac.value}
                        onClick={() => handleAdd(ac.value)}
                        disabled={addMutation.isPending}
                        style={{
                          padding: "3px 10px", borderRadius: "5px",
                          border: "1px solid var(--primary)",
                          background: "transparent",
                          color: "var(--primary)",
                          fontSize: "11px", fontWeight: 600, cursor: "pointer",
                          opacity: addMutation.isPending ? 0.5 : 1,
                        }}
                      >
                        {ac.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botón analizar si hay texto */}
        {query.length >= 1 && suggestions.some((s) => s.ticker.toUpperCase() === query.toUpperCase()) && (
          <button
            onClick={() => { onAnalyze(query.toUpperCase()); setQuery(""); setShowDropdown(false); }}
            style={{
              height: "34px", padding: "0 12px", borderRadius: "7px",
              border: "1px solid var(--primary)", background: "var(--primary)",
              color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer",
              whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            Ver análisis
          </button>
        )}
      </div>

      {/* Estado de la mutación */}
      {addMutation.isPending && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
          <Loader size={12} style={{ animation: "spin 1s linear infinite" }} />
          Buscando precios y generando análisis para {query}... (puede tardar hasta 30s)
        </div>
      )}
      {status && (
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          marginTop: "8px", fontSize: "12px",
          color: status.type === "success" ? "var(--success, #4ade80)" : "var(--danger, #f87171)",
        }}>
          {status.type === "success" ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
          {status.msg}
        </div>
      )}
    </div>
  );
}
