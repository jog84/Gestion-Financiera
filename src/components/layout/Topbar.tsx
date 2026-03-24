import { Search, User } from "lucide-react";
import { AlertBell } from "@/components/ui/AlertBell";

export function Topbar() {
  return (
    <header className="h-[64px] flex items-center px-6 glass shrink-0 sticky top-0 z-50 transition-colors duration-200 text-[var(--text)]">
      <div className="flex-1" />
      <div className="w-72 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" size={15} />
        <input
          type="text"
          placeholder="Buscar..."
          style={{ paddingLeft: "34px" }}
          className="w-full bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-3)] rounded-lg pr-4 py-2 text-sm outline-none focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--primary)] transition-all border border-[var(--border)] focus:border-[var(--primary)] shadow-sm"
        />
      </div>
      <div className="flex-1 flex justify-end">
        <div className="flex items-center gap-4">
          <AlertBell />
          <div className="flex items-center gap-2.5 cursor-pointer hover:bg-[var(--surface-2)] p-1.5 rounded-lg transition-colors border border-transparent">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-[var(--surface-3)] flex items-center justify-center text-[var(--text-2)] overflow-hidden">
                <User size={18} />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[var(--surface)] rounded-full"></span>
            </div>
            <span className="text-sm font-medium text-[var(--text)] pr-1">Admin User</span>
          </div>
        </div>
      </div>
    </header>
  );
}
