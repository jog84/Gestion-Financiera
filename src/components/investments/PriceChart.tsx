import { useEffect, useRef, useState } from "react";
import { X, TrendingUp, ExternalLink } from "lucide-react";

interface PriceChartProps {
  ticker: string;
  assetClass?: string;
  onClose: () => void;
}

type Market = "bcba" | "usd";
type Interval = "1D" | "1W" | "1M";

function toTVSymbol(ticker: string, market: Market): string {
  if (market === "bcba") return `BCBA:${ticker}`;
  const nyse = new Set([
    "BAC", "C", "JPM", "GS", "MS", "WFC", "XOM", "CVX", "OXY", "SLB", "HAL",
    "KO", "PEP", "MCD", "WMT", "TGT", "COST", "NKE", "DIS", "IBM", "T", "VZ",
    "MMM", "HON", "CAT", "DE", "GE", "BA", "JNJ", "PFE", "MRK", "ABT", "BMY",
    "CVS", "UNH", "V", "MA", "BRKB", "F", "GM",
  ]);
  return nyse.has(ticker) ? `NYSE:${ticker}` : `NASDAQ:${ticker}`;
}

declare global {
  interface Window { TradingView: any; }
}

export function PriceChart({ ticker, assetClass, onClose }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [market, setMarket] = useState<Market>("bcba");
  const [interval, setInterval] = useState<Interval>("1D");
  const isCedear = !assetClass || assetClass === "CEDEAR";

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const containerId = `tv_fp_${ticker}_${Date.now()}`;
    const widgetDiv = document.createElement("div");
    widgetDiv.id = containerId;
    widgetDiv.style.width = "100%";
    widgetDiv.style.height = "100%";
    containerRef.current.appendChild(widgetDiv);

    const symbol = toTVSymbol(ticker, market);

    const initWidget = () => {
      if (!window.TradingView || !containerRef.current) return;
      const w = containerRef.current.clientWidth || 900;
      const h = containerRef.current.clientHeight || 520;
      widgetRef.current = new window.TradingView.widget({
        autosize: false,
        width: w,
        height: h,
        symbol,
        interval,
        timezone: "America/Argentina/Buenos_Aires",
        theme: "dark",
        style: "1",
        locale: "es",
        toolbar_bg: "#18181b",
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: true,
        container_id: containerId,
        studies: [
          "MASimple@tv-basicstudies",
          "RSI@tv-basicstudies",
          "MACD@tv-basicstudies",
          "Volume@tv-basicstudies",
        ],
        overrides: {
          "mainSeriesProperties.candleStyle.upColor":         "#22c55e",
          "mainSeriesProperties.candleStyle.downColor":       "#ef4444",
          "mainSeriesProperties.candleStyle.borderUpColor":   "#22c55e",
          "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
          "mainSeriesProperties.candleStyle.wickUpColor":     "#22c55e",
          "mainSeriesProperties.candleStyle.wickDownColor":   "#ef4444",
          "paneProperties.background":                        "#18181b",
          "paneProperties.backgroundGradientStartColor":      "#18181b",
          "paneProperties.backgroundGradientEndColor":        "#18181b",
          "paneProperties.vertGridProperties.color":          "rgba(39,39,42,0.4)",
          "paneProperties.horzGridProperties.color":          "rgba(39,39,42,0.4)",
          "scalesProperties.textColor":                       "#71717a",
          "scalesProperties.backgroundColor":                 "#18181b",
        },
        loading_screen: { backgroundColor: "#18181b", foregroundColor: "#22d3ee" },
      });
    };

    if (window.TradingView) {
      initWidget();
    } else {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    }

    const handleResize = () => {
      if (!containerRef.current || !widgetRef.current?.resize) return;
      widgetRef.current.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [ticker, market, interval]);

  const tvUrl = `https://www.tradingview.com/chart/?symbol=${toTVSymbol(ticker, market)}`;

  const btnBase: React.CSSProperties = {
    padding: "4px 10px", fontSize: "12px", cursor: "pointer",
    border: "none", transition: "background 0.15s",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.80)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#18181b", border: "1px solid rgba(63,63,70,0.6)",
          borderRadius: "20px", width: "100%", maxWidth: "1100px",
          height: "90vh", display: "flex", flexDirection: "column",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", borderBottom: "1px solid rgba(63,63,70,0.5)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <TrendingUp size={15} color="#22d3ee" />
            <span style={{ fontWeight: 700, fontSize: "15px", color: "#fff" }}>{ticker}</span>
            <span style={{ fontSize: "10px", color: "#52525b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {assetClass ?? "CEDEAR"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Toggle ARS / USD para CEDEARs */}
            {isCedear && (
              <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(63,63,70,0.6)" }}>
                <button
                  onClick={() => setMarket("bcba")}
                  style={{
                    ...btnBase,
                    background: market === "bcba" ? "rgba(34,211,238,0.15)" : "rgba(39,39,42,0.5)",
                    color: market === "bcba" ? "#67e8f9" : "#71717a",
                  }}
                >
                  ARS (BCBA)
                </button>
                <button
                  onClick={() => setMarket("usd")}
                  style={{
                    ...btnBase,
                    background: market === "usd" ? "rgba(245,158,11,0.15)" : "rgba(39,39,42,0.5)",
                    color: market === "usd" ? "#fcd34d" : "#71717a",
                  }}
                >
                  USD (origen)
                </button>
              </div>
            )}

            {/* Selector de intervalo */}
            <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(63,63,70,0.6)" }}>
              {(["1D", "1W", "1M"] as Interval[]).map((i) => (
                <button
                  key={i}
                  onClick={() => setInterval(i)}
                  style={{
                    ...btnBase,
                    background: interval === i ? "rgba(63,63,70,0.8)" : "rgba(39,39,42,0.5)",
                    color: interval === i ? "#e4e4e7" : "#71717a",
                  }}
                >
                  {i}
                </button>
              ))}
            </div>

            {/* Abrir en TradingView */}
            <a
              href={tvUrl} target="_blank" rel="noopener noreferrer"
              title="Abrir en TradingView"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "6px", borderRadius: "8px", color: "#71717a",
                textDecoration: "none", cursor: "pointer",
              }}
            >
              <ExternalLink size={14} />
            </a>

            <button
              onClick={onClose}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "6px", borderRadius: "8px", background: "none",
                border: "none", cursor: "pointer", color: "#a1a1aa",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Widget container */}
        <div ref={containerRef} style={{ flex: 1, width: "100%", minHeight: 0, overflow: "hidden", borderRadius: "0 0 20px 20px" }} />
      </div>
    </div>
  );
}
