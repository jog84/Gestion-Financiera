import { Search } from "lucide-react";
import { AlertBell } from "@/components/ui/AlertBell";

export function Topbar() {
  return (
    <header
      className="h-[64px] glass shrink-0 sticky top-0 z-50 transition-colors duration-200 text-[var(--text)]"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "16px",
        padding: "0 20px 0 24px",
      }}
    >
      <div className="flex-1" />

      <div className="w-full max-w-[420px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" size={15} />
          <input
            type="text"
            placeholder="Buscar vistas, métricas o movimientos"
            style={{ paddingLeft: "34px" }}
            className="w-full bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-3)] rounded-xl pr-4 py-2.5 text-sm outline-none focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--primary)] transition-all border border-[var(--border)] focus:border-[var(--primary)] shadow-sm"
          />
      </div>

      <div className="flex items-center justify-end pr-2">
        <AlertBell />
      </div>
    </header>
  );
}
