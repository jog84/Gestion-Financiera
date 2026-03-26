import { Search } from "lucide-react";
import { AlertBell } from "@/components/ui/AlertBell";
import { useProfile } from "@/app/providers/ProfileProvider";

export function Topbar() {
  const { profile } = useProfile();

  return (
    <header className="h-[64px] flex items-center px-6 glass shrink-0 sticky top-0 z-50 transition-colors duration-200 text-[var(--text)]">
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div>
          <div className="text-sm font-semibold text-[var(--text)] leading-none">
            {profile?.name ?? "Mi Perfil"}
          </div>
          <div className="text-[11px] text-[var(--text-3)] mt-1 leading-none">
            {profile?.currency_code ?? "ARS"} · {profile?.locale ?? "es-AR"}
          </div>
        </div>
      </div>

      <div className="flex-1 flex justify-center">
        <div className="w-80 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" size={15} />
          <input
            type="text"
            placeholder="Buscar vistas, métricas o movimientos"
            style={{ paddingLeft: "34px" }}
            className="w-full bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-3)] rounded-xl pr-4 py-2.5 text-sm outline-none focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--primary)] transition-all border border-[var(--border)] focus:border-[var(--primary)] shadow-sm"
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-end gap-3">
        <AlertBell />
        <div className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-right">
          <div className="text-xs font-semibold text-[var(--text)] leading-none">
            Perfil activo
          </div>
          <div className="text-[11px] text-[var(--text-3)] mt-1 leading-none">
            {profile?.name ?? "Mi Perfil"}
          </div>
        </div>
      </div>
    </header>
  );
}
