import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, TrendingUp, Download, Upload } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MonthSelector } from "@/components/MonthSelector";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InlineEditCell } from "@/components/ui/InlineEditCell";
import { Pagination } from "@/components/ui/Pagination";
import { getIncomes, createIncome, updateIncome, deleteIncome, getIncomeSources } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { exportIncomesTemplate, importIncomes } from "@/lib/excel";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";

const PROFILE_ID = "default";

const TH: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: "10px",
  fontWeight: 600,
  color: "var(--text-3)",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  textAlign: "left",
};

export function Incomes() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const [form, setForm] = useState({
    amount: "",
    transaction_date: new Date().toISOString().split("T")[0],
    source_id: "",
    description: "",
    notes: "",
  });

  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.action === "new") {
      setModalOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Reset page when month/year changes
  useEffect(() => { setPage(0); }, [year, month]);

  const { data: incomes = [], isLoading } = useQuery({
    queryKey: ["incomes", PROFILE_ID, year, month],
    queryFn: () => getIncomes(PROFILE_ID, year, month),
  });

  const { data: sources = [] } = useQuery({
    queryKey: ["income_sources", PROFILE_ID],
    queryFn: () => getIncomeSources(PROFILE_ID),
  });

  const total = incomes.reduce((sum, i) => sum + i.amount, 0);
  const paged = incomes.slice(page * pageSize, (page + 1) * pageSize);

  const addMutation = useMutation({
    mutationFn: () =>
      createIncome({
        profile_id: PROFILE_ID,
        amount: parseFloat(form.amount.replace(",", ".")),
        transaction_date: form.transaction_date,
        source_id: form.source_id || undefined,
        description: form.description || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incomes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setModalOpen(false);
      setForm({ amount: "", transaction_date: new Date().toISOString().split("T")[0], source_id: "", description: "", notes: "" });
      toast.success("Ingreso registrado correctamente");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateIncome>[1] }) =>
      updateIncome(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incomes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Ingreso actualizado");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteIncome,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incomes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteId(null);
      toast.success("Ingreso eliminado");
    },
  });

  const sourceOptions = sources.map((s) => ({ value: s.id, label: s.name }));
  const importRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await importIncomes(file);
      if (rows.length === 0) { toast.error("No se encontraron filas válidas en el archivo"); return; }
      let ok = 0;
      for (const r of rows) {
        await createIncome({ profile_id: PROFILE_ID, amount: r.amount, transaction_date: r.transaction_date, description: r.description || undefined, notes: r.notes || undefined });
        ok++;
      }
      qc.invalidateQueries({ queryKey: ["incomes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`${ok} ingreso(s) importado(s) correctamente`);
    } catch {
      toast.error("Error al importar el archivo. Verificá que el formato sea el correcto.");
    }
    e.target.value = "";
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1400px" }}>
      {/* Header */}
      <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>Ingresos</h1>
          <p style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "2px" }}>
            Total del mes:{" "}
            <span style={{ color: "var(--success)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>{formatCurrency(total)}</span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          <Button variant="outline" size="sm" onClick={() => exportIncomesTemplate()}>
            <Download size={13} /> Descargar plantilla
          </Button>
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
            <Upload size={13} /> Importar
          </Button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={14} />
            Agregar ingreso
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="animate-fade-in-up delay-100" style={{ padding: 0, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <Skeleton style={{ height: "24px", width: "15%" }} />
                <Skeleton style={{ height: "24px", width: "35%" }} />
                <Skeleton style={{ height: "24px", width: "20%" }} />
                <Skeleton style={{ height: "24px", width: "10%", marginLeft: "auto" }} />
              </div>
            ))}
          </div>
        ) : incomes.length === 0 ? (
          <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "var(--text-3)" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
              <TrendingUp size={24} style={{ color: "var(--text-3)" }} />
            </div>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-2)" }}>No hay ingresos registrados</p>
            <p style={{ fontSize: "13px", maxWidth: "300px", textAlign: "center", marginBottom: "8px" }}>Registra tu primer ingreso del mes para comenzar a llevar el control.</p>
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={14} />
              Agregar ingreso
            </Button>
          </div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={TH}>Fecha</th>
                  <th style={TH}>Fuente</th>
                  <th style={TH}>Descripción</th>
                  <th style={{ ...TH, textAlign: "right" }}>Monto</th>
                  <th style={{ ...TH, width: "40px" }} />
                </tr>
              </thead>
              <tbody>
                {paged.map((income, i) => (
                  <tr
                    key={income.id}
                    style={{ borderBottom: i !== paged.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "6px 16px", fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-mono)", width: "120px" }}>
                      <InlineEditCell
                        value={income.transaction_date}
                        displayValue={formatDate(income.transaction_date)}
                        type="date"
                        mono
                        onCommit={(v) => updateMutation.mutate({ id: income.id, payload: { amount: income.amount, transaction_date: v, source_id: income.source_id, description: income.description, notes: income.notes } })}
                      />
                    </td>
                    <td style={{ padding: "6px 16px", fontSize: "12px", color: "var(--text-2)", fontWeight: 500, minWidth: "140px" }}>
                      <InlineEditCell
                        value={income.source_id ?? ""}
                        displayValue={income.source_name ? income.source_name : undefined}
                        type="select"
                        options={sourceOptions}
                        onCommit={(v) => updateMutation.mutate({ id: income.id, payload: { amount: income.amount, transaction_date: income.transaction_date, source_id: v || null, description: income.description, notes: income.notes } })}
                      />
                    </td>
                    <td style={{ padding: "6px 16px", fontSize: "12px", color: "var(--text-3)", minWidth: "160px" }}>
                      <InlineEditCell
                        value={income.description ?? ""}
                        placeholder="Agregar descripción"
                        onCommit={(v) => updateMutation.mutate({ id: income.id, payload: { amount: income.amount, transaction_date: income.transaction_date, source_id: income.source_id, description: v || null, notes: income.notes } })}
                      />
                    </td>
                    <td style={{ padding: "6px 16px", textAlign: "right", width: "140px" }}>
                      <InlineEditCell
                        value={String(income.amount)}
                        displayValue={`+${formatCurrency(income.amount)}`}
                        type="number"
                        mono
                        align="right"
                        color="var(--success)"
                        onCommit={(v) => {
                          const num = parseFloat(v.replace(",", "."));
                          if (!isNaN(num) && num > 0) updateMutation.mutate({ id: income.id, payload: { amount: num, transaction_date: income.transaction_date, source_id: income.source_id, description: income.description, notes: income.notes } });
                        }}
                      />
                    </td>
                    <td style={{ padding: "6px 16px", textAlign: "right" }}>
                      <button
                        onClick={() => setDeleteId(income.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "4px", borderRadius: "4px", transition: "color 0.15s", display: "flex", alignItems: "center" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              total={incomes.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
            />
          </>
        )}
      </Card>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo ingreso">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Input label="Monto *" type="text" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <Input label="Fecha *" type="date" value={form.transaction_date} onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))} />
          {sourceOptions.length > 0 && (
            <Select label="Fuente" placeholder="Sin fuente" options={sourceOptions} value={form.source_id} onChange={(e) => setForm((f) => ({ ...f, source_id: e.target.value }))} />
          )}
          <Input label="Descripción" placeholder="Ej: Sueldo mensual" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Input label="Notas" placeholder="Opcional" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!form.amount || !form.transaction_date || addMutation.isPending}>
              {addMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteId}
        title="Eliminar ingreso"
        description="¿Estás seguro de que deseas eliminar este ingreso? Esta acción no se puede deshacer."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
