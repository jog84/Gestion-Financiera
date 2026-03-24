import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, RefreshCw, Play, Pause } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  getRecurringTransactions, createRecurringTransaction, updateRecurringTransaction,
  deleteRecurringTransaction, toggleRecurringActive, applyDueRecurring,
  getIncomeSources, getExpenseCategories,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { QK } from "@/lib/queryKeys";

const PROFILE_ID = "default";

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Mensual" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "yearly", label: "Anual" },
];

const FREQ_LABELS: Record<string, string> = {
  monthly: "Mensual",
  weekly: "Semanal",
  biweekly: "Quincenal",
  yearly: "Anual",
};

const TH: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: "10px",
  fontWeight: 600,
  color: "var(--text-3)",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  textAlign: "left",
};

const emptyForm = {
  kind: "expense" as "income" | "expense",
  source_id: "",
  category_id: "",
  amount: "",
  description: "",
  vendor: "",
  payment_method: "",
  notes: "",
  frequency: "monthly",
  day_of_month: "",
  next_due_date: new Date().toISOString().split("T")[0],
};

export function Recurring() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const qc = useQueryClient();

  const { data: recurring = [], isLoading } = useQuery({
    queryKey: QK.recurring(),
    queryFn: () => getRecurringTransactions(PROFILE_ID),
  });

  const { data: sources = [] } = useQuery({
    queryKey: QK.incomeSources(),
    queryFn: () => getIncomeSources(PROFILE_ID),
  });

  const { data: categories = [] } = useQuery({
    queryKey: QK.expenseCategories(),
    queryFn: () => getExpenseCategories(PROFILE_ID),
  });

  const sourceOptions = sources.map((s) => ({ value: s.id, label: s.name }));
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  const openNew = () => {
    setEditItem(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (id: string) => {
    const item = recurring.find((r) => r.id === id);
    if (!item) return;
    setEditItem(id);
    setForm({
      kind: item.kind as "income" | "expense",
      source_id: item.source_id ?? "",
      category_id: item.category_id ?? "",
      amount: String(item.amount),
      description: item.description ?? "",
      vendor: item.vendor ?? "",
      payment_method: item.payment_method ?? "",
      notes: item.notes ?? "",
      frequency: item.frequency,
      day_of_month: item.day_of_month != null ? String(item.day_of_month) : "",
      next_due_date: item.next_due_date,
    });
    setModalOpen(true);
  };

  const addMutation = useMutation({
    mutationFn: () =>
      createRecurringTransaction({
        profile_id: PROFILE_ID,
        kind: form.kind,
        source_id: form.source_id || null,
        category_id: form.category_id || null,
        amount: parseFloat(form.amount.replace(",", ".")),
        description: form.description || null,
        vendor: form.vendor || null,
        payment_method: form.payment_method || null,
        notes: form.notes || null,
        frequency: form.frequency,
        day_of_month: form.day_of_month ? parseInt(form.day_of_month) : null,
        next_due_date: form.next_due_date,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.recurring() });
      setModalOpen(false);
      setForm(emptyForm);
      toast.success("Transacción recurrente creada");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateRecurringTransaction(editItem!, {
        profile_id: PROFILE_ID,
        kind: form.kind,
        source_id: form.source_id || null,
        category_id: form.category_id || null,
        amount: parseFloat(form.amount.replace(",", ".")),
        description: form.description || null,
        vendor: form.vendor || null,
        payment_method: form.payment_method || null,
        notes: form.notes || null,
        frequency: form.frequency,
        day_of_month: form.day_of_month ? parseInt(form.day_of_month) : null,
        next_due_date: form.next_due_date,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.recurring() });
      setModalOpen(false);
      setEditItem(null);
      toast.success("Transacción recurrente actualizada");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecurringTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.recurring() });
      setDeleteId(null);
      toast.success("Transacción recurrente eliminada");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleRecurringActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.recurring() }),
  });

  const applyMutation = useMutation({
    mutationFn: () => applyDueRecurring(PROFILE_ID, new Date().toISOString().split("T")[0]),
    onSuccess: (applied) => {
      qc.invalidateQueries({ queryKey: QK.recurring() });
      qc.invalidateQueries({ queryKey: ["incomes"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (applied.length === 0) {
        toast.info("No hay transacciones vencidas para aplicar");
      } else {
        toast.success(`${applied.length} transacción(es) aplicada(s)`);
      }
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const isPending = addMutation.isPending || updateMutation.isPending;

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1200px" }}>
      {/* Header */}
      <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>Recurrentes</h1>
          <p style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "2px" }}>
            Automatizá ingresos y gastos que se repiten periódicamente
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Button variant="outline" size="sm" onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
            <RefreshCw size={13} />
            {applyMutation.isPending ? "Aplicando..." : "Aplicar vencidas"}
          </Button>
          <Button onClick={openNew}>
            <Plus size={14} />
            Nueva recurrente
          </Button>
        </div>
      </div>

      <Card className="animate-fade-in-up delay-100" style={{ padding: 0, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <Skeleton style={{ height: "24px", width: "20%" }} />
                <Skeleton style={{ height: "24px", width: "30%" }} />
                <Skeleton style={{ height: "24px", width: "15%", marginLeft: "auto" }} />
              </div>
            ))}
          </div>
        ) : recurring.length === 0 ? (
          <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "var(--text-3)" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
              <RefreshCw size={24} style={{ color: "var(--text-3)" }} />
            </div>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-2)" }}>Sin transacciones recurrentes</p>
            <p style={{ fontSize: "13px", maxWidth: "320px", textAlign: "center", marginBottom: "8px" }}>Configurá tus ingresos y gastos fijos para que se apliquen automáticamente cada mes.</p>
            <Button onClick={openNew}>
              <Plus size={14} />
              Nueva recurrente
            </Button>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={TH}>Tipo</th>
                <th style={TH}>Descripción</th>
                <th style={TH}>Categoría / Fuente</th>
                <th style={TH}>Frecuencia</th>
                <th style={TH}>Próxima fecha</th>
                <th style={{ ...TH, textAlign: "right" }}>Monto</th>
                <th style={{ ...TH, width: "80px" }}>Estado</th>
                <th style={{ ...TH, width: "40px" }} />
              </tr>
            </thead>
            <tbody>
              {recurring.map((item, i) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: i !== recurring.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.1s", opacity: item.is_active ? 1 : 0.5 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      borderRadius: "4px", padding: "2px 7px", fontSize: "11px", fontWeight: 600,
                      background: item.kind === "income" ? "color-mix(in srgb, var(--success) 15%, transparent)" : "color-mix(in srgb, var(--danger) 15%, transparent)",
                      color: item.kind === "income" ? "var(--success)" : "var(--danger)",
                    }}>
                      {item.kind === "income" ? "Ingreso" : "Gasto"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text)", fontWeight: 500, cursor: "pointer" }} onClick={() => openEdit(item.id)}>
                    {item.description ?? "—"}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-3)" }}>
                    {item.kind === "income"
                      ? (item.source_name ?? "—")
                      : (item.category_name ?? "—")}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-3)" }}>
                    {FREQ_LABELS[item.frequency] ?? item.frequency}
                    {item.day_of_month != null && ` (día ${item.day_of_month})`}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                    {formatDate(item.next_due_date)}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontSize: "13px", fontWeight: 600, fontFamily: "var(--font-mono)", color: item.kind === "income" ? "var(--success)" : "var(--danger)" }}>
                    {item.kind === "income" ? "+" : "−"}{formatCurrency(item.amount)}
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <button
                      onClick={() => toggleMutation.mutate(item.id)}
                      title={item.is_active ? "Pausar" : "Activar"}
                      style={{ background: "none", border: "none", cursor: "pointer", color: item.is_active ? "var(--success)" : "var(--text-3)", display: "flex", alignItems: "center", padding: "2px" }}
                    >
                      {item.is_active ? <Play size={14} /> : <Pause size={14} />}
                    </button>
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>
                    <button
                      onClick={() => setDeleteId(item.id)}
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
        )}
      </Card>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }} title={editItem ? "Editar recurrente" : "Nueva transacción recurrente"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Select
            label="Tipo *"
            options={[{ value: "income", label: "Ingreso" }, { value: "expense", label: "Gasto" }]}
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as "income" | "expense", source_id: "", category_id: "" }))}
          />
          <Input label="Monto *" type="text" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          {form.kind === "income" && sourceOptions.length > 0 && (
            <Select label="Fuente" placeholder="Sin fuente" options={sourceOptions} value={form.source_id} onChange={(e) => setForm((f) => ({ ...f, source_id: e.target.value }))} />
          )}
          {form.kind === "expense" && categoryOptions.length > 0 && (
            <Select label="Categoría" placeholder="Sin categoría" options={categoryOptions} value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))} />
          )}
          <Input label="Descripción" placeholder="Ej: Sueldo, Netflix, Alquiler" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          {form.kind === "expense" && (
            <Input label="Proveedor" placeholder="Opcional" value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} />
          )}
          <Select label="Frecuencia *" options={FREQUENCY_OPTIONS} value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))} />
          <Input label="Día del mes (opcional)" type="number" placeholder="Ej: 10 (solo para frecuencia mensual)" value={form.day_of_month} onChange={(e) => setForm((f) => ({ ...f, day_of_month: e.target.value }))} />
          <Input label="Próxima fecha *" type="date" value={form.next_due_date} onChange={(e) => setForm((f) => ({ ...f, next_due_date: e.target.value }))} />
          <Input label="Notas" placeholder="Opcional" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
            <Button variant="ghost" onClick={() => { setModalOpen(false); setEditItem(null); }}>Cancelar</Button>
            <Button
              onClick={() => editItem ? updateMutation.mutate() : addMutation.mutate()}
              disabled={!form.amount || !form.next_due_date || isPending}
            >
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteId}
        title="Eliminar recurrente"
        description="¿Estás seguro de que deseas eliminar esta transacción recurrente?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
