import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, TrendingDown, Download, Upload, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MonthSelector } from "@/components/MonthSelector";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InlineEditCell } from "@/components/ui/InlineEditCell";
import { PageHeader } from "@/components/ui/PageHeader";
import { getFinancialAccounts, getExpenses, createExpense, updateExpense, deleteExpense, getExpenseCategories, getBudgets, checkBudgetAlerts } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { exportExpensesTemplate, importExpenses } from "@/lib/excel";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { QK } from "@/lib/queryKeys";
import { invalidateExpenseState } from "@/lib/queryInvalidation";
import { useProfile } from "@/app/providers/ProfileProvider";
import { CashflowTableCard } from "@/components/cashflow/CashflowTableCard";
import { CashflowEmptyState } from "@/components/cashflow/CashflowEmptyState";

const PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "transferencia", label: "Transferencia" },
  { value: "otro", label: "Otro" },
];

const TH: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: "10px",
  fontWeight: 600,
  color: "var(--text-3)",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  textAlign: "left",
};

export function Expenses() {
  const { profileId } = useProfile();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    amount: "",
    transaction_date: new Date().toISOString().split("T")[0],
    account_id: "",
    category_id: "",
    description: "",
    vendor: "",
    payment_method: "",
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
    if (location.state?.category_id) {
      setFilterCategoryId(location.state.category_id);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => { setPage(0); }, [year, month, filterCategoryId]);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: QK.expenses(profileId, year, month),
    queryFn: () => getExpenses(profileId, year, month),
  });

  const { data: categories = [] } = useQuery({
    queryKey: QK.expenseCategories(profileId),
    queryFn: () => getExpenseCategories(profileId),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: QK.financialAccounts(profileId),
    queryFn: () => getFinancialAccounts(profileId),
  });

  const { data: budgets = [] } = useQuery({
    queryKey: QK.budgets(profileId, year, month),
    queryFn: () => getBudgets(profileId, year, month),
  });

  useEffect(() => {
    if (expenses.length > 0 && budgets.length > 0) {
      checkBudgetAlerts(profileId, year, month).catch(() => {});
    }
  }, [expenses.length, budgets.length, year, month]);

  const warningBudgets = budgets.filter((b) => b.pct_used >= 0.8 && !dismissedAlerts.has(b.id));
  const filteredExpenses = filterCategoryId ? expenses.filter((e) => e.category_id === filterCategoryId) : expenses;
  const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const paged = filteredExpenses.slice(page * pageSize, (page + 1) * pageSize);

  const addMutation = useMutation({
    mutationFn: () =>
      createExpense({
        profile_id: profileId,
        amount: parseFloat(form.amount.replace(",", ".")),
        transaction_date: form.transaction_date,
        account_id: form.account_id || undefined,
        category_id: form.category_id || undefined,
        description: form.description || undefined,
        vendor: form.vendor || undefined,
        payment_method: form.payment_method || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      void invalidateExpenseState(qc, profileId);
      setModalOpen(false);
      setForm({ amount: "", transaction_date: new Date().toISOString().split("T")[0], account_id: "", category_id: "", description: "", vendor: "", payment_method: "", notes: "" });
      toast.success("Gasto registrado correctamente");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateExpense>[1] }) =>
      updateExpense(id, payload),
    onSuccess: () => {
      void invalidateExpenseState(qc, profileId);
      toast.success("Gasto actualizado");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      void invalidateExpenseState(qc, profileId);
      setDeleteId(null);
      toast.success("Gasto eliminado");
    },
  });

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const accountOptions = accounts.map((a) => ({ value: a.id, label: `${a.name}${a.institution ? ` · ${a.institution}` : ""}` }));
  const importRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await importExpenses(file);
      if (rows.length === 0) { toast.error("No se encontraron filas válidas en el archivo"); return; }
      let ok = 0;
      for (const r of rows) {
        await createExpense({ profile_id: profileId, amount: r.amount, transaction_date: r.transaction_date, description: r.description || undefined, vendor: r.vendor || undefined, payment_method: r.payment_method || undefined, notes: r.notes || undefined });
        ok++;
      }
      void invalidateExpenseState(qc, profileId);
      toast.success(`${ok} gasto(s) importado(s) correctamente`);
    } catch {
      toast.error("Error al importar el archivo. Verificá que el formato sea el correcto.");
    }
    e.target.value = "";
  };

  const filterCategory = filterCategoryId ? categories.find((c) => c.id === filterCategoryId) : null;

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1400px" }}>
      <PageHeader
        title="Gastos"
        description={
          <>
            Total{filterCategory ? ` · ${filterCategory.name}` : " del mes"}:{" "}
            <span style={{ color: "var(--danger)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
              {formatCurrency(total)}
            </span>
          </>
        }
        actions={
          <>
            <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
            <Button variant="outline" size="xs" onClick={() => exportExpensesTemplate()}>
              <Download size={11} /> Descargar plantilla
            </Button>
            <Button variant="outline" size="xs" onClick={() => importRef.current?.click()}>
              <Upload size={11} /> Importar
            </Button>
            <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
            <Button size="xs" onClick={() => setModalOpen(true)}>
              <Plus size={12} />
              Agregar gasto
            </Button>
          </>
        }
      />

      {warningBudgets.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
          {warningBudgets.map((b) => (
            <div
              key={b.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 16px",
                borderRadius: "10px",
                background: b.pct_used >= 1 ? "color-mix(in srgb, var(--danger) 10%, transparent)" : "color-mix(in srgb, var(--warning) 10%, transparent)",
                border: `1px solid ${b.pct_used >= 1 ? "color-mix(in srgb, var(--danger) 30%, transparent)" : "color-mix(in srgb, var(--warning) 30%, transparent)"}`,
              }}
            >
              <AlertTriangle size={14} style={{ color: b.pct_used >= 1 ? "var(--danger)" : "var(--warning)", flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: "var(--text-2)", flex: 1, fontFamily: "var(--font-ui)" }}>
                <strong>{b.category_name}</strong>: {b.pct_used >= 1 ? "Presupuesto superado" : "Presupuesto al " + Math.round(b.pct_used * 100) + "%"} {" — "}
                <span style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(b.spent_amount)}</span> de <span style={{ fontFamily: "var(--font-mono)" }}>{formatCurrency(b.budget_amount)}</span>
              </span>
              <button
                onClick={() => setDismissedAlerts((s) => new Set([...s, b.id]))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "2px", borderRadius: "4px", display: "flex", alignItems: "center" }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {filterCategoryId && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-ui)" }}>Filtrando por:</span>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "3px 10px", borderRadius: "20px",
              background: "color-mix(in srgb, var(--primary) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
              fontSize: "12px", color: "var(--primary)", fontFamily: "var(--font-ui)", fontWeight: 500,
            }}
          >
            {filterCategory?.name ?? filterCategoryId}
            <button
              onClick={() => setFilterCategoryId(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: "0", display: "flex", alignItems: "center" }}
            >
              <X size={11} />
            </button>
          </span>
        </div>
      )}

      <CashflowTableCard
        isLoading={isLoading}
        isEmpty={filteredExpenses.length === 0}
        loadingColumns={["15%", "18%", "18%", "18%", "14%", "10%"]}
        emptyState={
          <CashflowEmptyState
            icon={<TrendingDown size={24} style={{ color: "var(--text-3)" }} />}
            title="No hay gastos registrados"
            description="Registra tu primer gasto del mes para ver su distribución por categorías."
            actionLabel="Agregar gasto"
            onAction={() => setModalOpen(true)}
          />
        }
        total={filteredExpenses.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={TH}>Fecha</th>
              <th style={TH}>Cuenta</th>
              <th style={TH}>Categoría</th>
              <th style={TH}>Descripción</th>
              <th style={TH}>Proveedor</th>
              <th style={TH}>Método</th>
              <th style={{ ...TH, textAlign: "right" }}>Monto</th>
              <th style={{ ...TH, width: "40px" }} />
            </tr>
          </thead>
          <tbody>
            {paged.map((expense, i) => (
              <tr
                key={expense.id}
                style={{ borderBottom: i !== paged.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.1s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "6px 16px", fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-mono)", width: "120px" }}>
                  <InlineEditCell
                    value={expense.transaction_date}
                    displayValue={formatDate(expense.transaction_date)}
                    type="date"
                    mono
                    onCommit={(v) => updateMutation.mutate({ id: expense.id, payload: { amount: expense.amount, transaction_date: v, account_id: expense.account_id, category_id: expense.category_id, description: expense.description, vendor: expense.vendor, payment_method: expense.payment_method, notes: expense.notes } })}
                  />
                </td>
                <td style={{ padding: "6px 16px", fontSize: "12px", color: "var(--text-2)", minWidth: "160px" }}>
                  <InlineEditCell
                    value={expense.account_id ?? ""}
                    displayValue={expense.account_name ?? "Sin cuenta"}
                    type="select"
                    options={accountOptions}
                    onCommit={(v) => updateMutation.mutate({ id: expense.id, payload: { amount: expense.amount, transaction_date: expense.transaction_date, account_id: v || null, category_id: expense.category_id, description: expense.description, vendor: expense.vendor, payment_method: expense.payment_method, notes: expense.notes } })}
                  />
                </td>
                <td style={{ padding: "6px 16px", fontSize: "12px", color: "var(--text-2)", fontWeight: 500, minWidth: "140px" }}>
                  <InlineEditCell
                    value={expense.category_id ?? ""}
                    displayValue={expense.category_name ? expense.category_name : undefined}
                    type="select"
                    options={categoryOptions}
                    onCommit={(v) => updateMutation.mutate({ id: expense.id, payload: { amount: expense.amount, transaction_date: expense.transaction_date, account_id: expense.account_id, category_id: v || null, description: expense.description, vendor: expense.vendor, payment_method: expense.payment_method, notes: expense.notes } })}
                  />
                </td>
                <td style={{ padding: "6px 16px", fontSize: "12px", color: "var(--text-3)", minWidth: "140px" }}>
                  <InlineEditCell
                    value={expense.description ?? ""}
                    placeholder="Agregar descripción"
                    onCommit={(v) => updateMutation.mutate({ id: expense.id, payload: { amount: expense.amount, transaction_date: expense.transaction_date, account_id: expense.account_id, category_id: expense.category_id, description: v || null, vendor: expense.vendor, payment_method: expense.payment_method, notes: expense.notes } })}
                  />
                </td>
                <td style={{ padding: "6px 16px", fontSize: "12px", color: "var(--text-3)", minWidth: "120px" }}>
                  <InlineEditCell
                    value={expense.vendor ?? ""}
                    placeholder="Agregar proveedor"
                    onCommit={(v) => updateMutation.mutate({ id: expense.id, payload: { amount: expense.amount, transaction_date: expense.transaction_date, account_id: expense.account_id, category_id: expense.category_id, description: expense.description, vendor: v || null, payment_method: expense.payment_method, notes: expense.notes } })}
                  />
                </td>
                <td style={{ padding: "6px 16px", fontSize: "12px", color: "var(--text-3)", minWidth: "110px" }}>
                  <InlineEditCell
                    value={expense.payment_method ?? ""}
                    displayValue={expense.payment_method ? PAYMENT_METHODS.find((p) => p.value === expense.payment_method)?.label ?? expense.payment_method : undefined}
                    type="select"
                    options={PAYMENT_METHODS}
                    onCommit={(v) => updateMutation.mutate({ id: expense.id, payload: { amount: expense.amount, transaction_date: expense.transaction_date, account_id: expense.account_id, category_id: expense.category_id, description: expense.description, vendor: expense.vendor, payment_method: v || null, notes: expense.notes } })}
                  />
                </td>
                <td style={{ padding: "6px 16px", textAlign: "right", width: "140px" }}>
                  <InlineEditCell
                    value={String(expense.amount)}
                    displayValue={`−${formatCurrency(expense.amount)}`}
                    type="number"
                    mono
                    align="right"
                    color="var(--danger)"
                    onCommit={(v) => {
                      const num = parseFloat(v.replace(",", "."));
                      if (!isNaN(num) && num > 0) updateMutation.mutate({ id: expense.id, payload: { amount: num, transaction_date: expense.transaction_date, account_id: expense.account_id, category_id: expense.category_id, description: expense.description, vendor: expense.vendor, payment_method: expense.payment_method, notes: expense.notes } });
                    }}
                  />
                </td>
                <td style={{ padding: "6px 16px", textAlign: "right" }}>
                  <button
                    onClick={() => setDeleteId(expense.id)}
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
      </CashflowTableCard>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo gasto">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Input label="Monto *" type="text" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <Input label="Fecha *" type="date" value={form.transaction_date} onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))} />
          {accountOptions.length > 0 && (
            <Select label="Cuenta" placeholder="Sin imputar" options={accountOptions} value={form.account_id} onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))} />
          )}
          {categoryOptions.length > 0 && (
            <Select label="Categoría" placeholder="Sin categoría" options={categoryOptions} value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))} />
          )}
          <Input label="Descripción" placeholder="Ej: Supermercado" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Input label="Proveedor" placeholder="Ej: Carrefour" value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} />
          <Select label="Método de pago" placeholder="Sin especificar" options={PAYMENT_METHODS} value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))} />
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
        title="Eliminar gasto"
        description="¿Estás seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
