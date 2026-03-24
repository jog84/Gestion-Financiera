import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CreditCard, Download, Upload } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { getInstallments, createInstallment, deleteInstallment, getInstallmentCashflow } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { exportInstallmentsTemplate, importInstallments } from "@/lib/excel";
import { toast } from "sonner";
import { QK } from "@/lib/queryKeys";

const PROFILE_ID = "default";

const CAT_COLORS = ["#4361ee","#06d6a0","#fb8500","#ef233c","#4cc9f0","#a855f7","#f59e0b","#e91e63"];

const TH: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: "10px",
  fontWeight: 600,
  color: "var(--text-3)",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  textAlign: "left",
};

function getInstallmentStatus(startDate: string, count: number): { label: string; variant: "success" | "warning" | "danger" | "default" } {
  const start = new Date(startDate);
  const now = new Date();
  const monthsElapsed =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (monthsElapsed >= count) return { label: "Pagado", variant: "default" };
  if (monthsElapsed >= count - 2) return { label: `${count - monthsElapsed} restantes`, variant: "warning" };
  return { label: `${count - monthsElapsed} restantes`, variant: "success" };
}

export function Installments() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    description: "",
    total_amount: "",
    installment_count: "",
    start_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const qc = useQueryClient();

  const { data: installments = [], isLoading } = useQuery({
    queryKey: QK.installments(),
    queryFn: () => getInstallments(PROFILE_ID),
  });

  const { data: cashflow = [] } = useQuery({
    queryKey: QK.installmentCf(),
    queryFn: () => getInstallmentCashflow(PROFILE_ID, 12),
  });

  const active = installments.filter((i) => {
    const start = new Date(i.start_date);
    const now = new Date();
    const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    return elapsed < i.installment_count;
  });

  const totalMonthly = active.reduce((sum, i) => sum + i.total_amount / i.installment_count, 0);

  const addMutation = useMutation({
    mutationFn: () =>
      createInstallment({
        profile_id: PROFILE_ID,
        description: form.description,
        total_amount: parseFloat(form.total_amount.replace(",", ".")),
        installment_count: parseInt(form.installment_count.replace(",", ".")),
        start_date: form.start_date,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.installments() });
      setModalOpen(false);
      setForm({ description: "", total_amount: "", installment_count: "", start_date: new Date().toISOString().split("T")[0], notes: "" });
      toast.success("Cuota registrada correctamente");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInstallment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.installments() });
      setDeleteId(null);
      toast.success("Cuota eliminada");
    },
  });

  const importRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await importInstallments(file);
      if (rows.length === 0) { toast.error("No se encontraron filas válidas en el archivo"); return; }
      let ok = 0;
      for (const r of rows) {
        await createInstallment({ profile_id: PROFILE_ID, description: r.description, total_amount: r.total_amount, installment_count: r.installment_count, start_date: r.start_date, notes: r.notes || undefined });
        ok++;
      }
      qc.invalidateQueries({ queryKey: QK.installments() });
      toast.success(`${ok} cuota(s) importada(s) correctamente`);
    } catch {
      toast.error("Error al importar el archivo. Verificá que el formato sea el correcto.");
    }
    e.target.value = "";
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1400px" }}>
      <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>Cuotas</h1>
          <p style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "2px" }}>
            Costo mensual activo:{" "}
            <span style={{ color: "var(--warning)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>{formatCurrency(totalMonthly)}</span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Button variant="outline" size="sm" onClick={() => exportInstallmentsTemplate()}>
            <Download size={13} /> Descargar plantilla
          </Button>
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
            <Upload size={13} /> Importar
          </Button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={14} />
            Nueva cuota
          </Button>
        </div>
      </div>

      {/* Cashflow chart */}
      {cashflow.length > 0 && (
        <Card className="animate-fade-in-up delay-100" style={{ padding: "20px", marginBottom: "16px" }}>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-2)", marginBottom: "12px", fontFamily: "var(--font-ui)" }}>
            Flujo de cuotas — próximos 12 meses
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={cashflow.map((p) => ({ name: `${p.month}/${p.year}`, total: p.total_due, count: p.installment_count }))} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-3)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-3)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v).replace(/\s/g, "")} width={80} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", fontFamily: "var(--font-ui)" }}
                formatter={(v, _name, props) => [
                  `${formatCurrency(Number(v))} (${(props as { payload?: { count?: number } }).payload?.count ?? 0} cuotas)`,
                  "Total",
                ]}
              />
              <Bar dataKey="total" fill="var(--warning)" fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="animate-fade-in-up delay-200" style={{ padding: 0, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <Skeleton style={{ height: "24px", width: "25%" }} />
                <Skeleton style={{ height: "24px", width: "15%" }} />
                <Skeleton style={{ height: "24px", width: "20%" }} />
                <Skeleton style={{ height: "24px", width: "15%", marginLeft: "auto" }} />
              </div>
            ))}
          </div>
        ) : installments.length === 0 ? (
          <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "var(--text-3)" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
              <CreditCard size={24} style={{ color: "var(--text-3)" }} />
            </div>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-2)" }}>No hay cuotas activas</p>
            <p style={{ fontSize: "13px", maxWidth: "300px", textAlign: "center", marginBottom: "8px" }}>Agrega tus compras en cuotas para prever tu gasto en meses futuros.</p>
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={14} />
              Nueva cuota
            </Button>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={TH}>Descripción</th>
                <th style={TH}>Inicio</th>
                <th style={{ ...TH, textAlign: "right" }}>Total</th>
                <th style={{ ...TH, textAlign: "right" }}>Cuota/mes</th>
                <th style={TH}>Estado</th>
                <th style={{ ...TH, width: "40px" }} />
              </tr>
            </thead>
            <tbody>
              {installments.map((item, i) => {
                const status = getInstallmentStatus(item.start_date, item.installment_count);
                return (
                  <tr
                    key={item.id}
                    style={{ borderBottom: i !== installments.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text)", fontWeight: 500 }}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white" style={{ background: CAT_COLORS[item.description.length % CAT_COLORS.length] }}>
                          {item.description.charAt(0).toUpperCase()}
                        </div>
                        {item.description}
                      </div>
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{formatDate(item.start_date)}</td>
                    <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-2)", textAlign: "right", fontFamily: "var(--font-mono)" }}>{formatCurrency(item.total_amount)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontSize: "13px", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--warning)" }}>
                      {formatCurrency(item.total_amount / item.installment_count)}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <Badge variant={status.variant}>{status.label}</Badge>
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
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva cuota">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Input label="Descripción *" placeholder="Ej: Notebook 12 cuotas" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Input label="Monto total *" type="text" inputMode="decimal" placeholder="0.00" value={form.total_amount} onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))} />
          <Input label="Cantidad de cuotas *" type="text" inputMode="numeric" placeholder="12" value={form.installment_count} onChange={(e) => setForm((f) => ({ ...f, installment_count: e.target.value }))} />
          <Input label="Fecha de inicio *" type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
          <Input label="Notas" placeholder="Opcional" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!form.description || !form.total_amount || !form.installment_count || addMutation.isPending}>
              {addMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteId}
        title="Eliminar cuota"
        description="¿Estás seguro de que deseas eliminar esta cuota? Esta acción no se puede deshacer."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
