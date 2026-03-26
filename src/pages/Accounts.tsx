import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Plus, Trash2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InlineEditCell } from "@/components/ui/InlineEditCell";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  createFinancialAccount,
  deleteFinancialAccount,
  getCashOverview,
  getFinancialAccounts,
  updateFinancialAccount,
} from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { QK } from "@/lib/queryKeys";
import { useProfile } from "@/app/providers/ProfileProvider";

const ACCOUNT_TYPES = [
  { value: "cash", label: "Efectivo" },
  { value: "checking", label: "Cuenta corriente" },
  { value: "savings", label: "Caja de ahorro" },
  { value: "broker", label: "Broker" },
  { value: "wallet", label: "Billetera virtual" },
  { value: "other", label: "Otra" },
];

const CURRENCY_OPTIONS = [
  { value: "ARS", label: "ARS" },
  { value: "USD", label: "USD" },
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

export function Accounts() {
  const { profileId } = useProfile();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    institution: "",
    account_type: "cash",
    currency_code: "ARS",
    current_balance: "",
    is_liquid: true,
    include_in_net_worth: true,
    notes: "",
  });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: QK.financialAccounts(profileId),
    queryFn: () => getFinancialAccounts(profileId),
  });

  const { data: cashOverview } = useQuery({
    queryKey: QK.cashOverview(profileId),
    queryFn: () => getCashOverview(profileId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.financialAccounts(profileId) });
    qc.invalidateQueries({ queryKey: QK.cashOverview(profileId) });
    qc.invalidateQueries({ queryKey: QK.financialOverview(profileId, new Date().getFullYear(), new Date().getMonth() + 1) });
  };

  const addMutation = useMutation({
    mutationFn: () =>
      createFinancialAccount({
        profile_id: profileId,
        name: form.name,
        institution: form.institution || null,
        account_type: form.account_type,
        currency_code: form.currency_code,
        current_balance: parseFloat(form.current_balance.replace(",", ".")),
        is_liquid: form.is_liquid,
        include_in_net_worth: form.include_in_net_worth,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      invalidate();
      setModalOpen(false);
      setForm({
        name: "",
        institution: "",
        account_type: "cash",
        currency_code: "ARS",
        current_balance: "",
        is_liquid: true,
        include_in_net_worth: true,
        notes: "",
      });
      toast.success("Cuenta guardada");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateFinancialAccount>[1] }) =>
      updateFinancialAccount(id, payload),
    onSuccess: () => {
      invalidate();
      toast.success("Cuenta actualizada");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFinancialAccount,
    onSuccess: () => {
      invalidate();
      setDeleteId(null);
      toast.success("Cuenta eliminada");
    },
  });

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1400px" }}>
      <PageHeader
        title="Cuentas y Caja"
        description="Gestiona saldos líquidos, cajas, billeteras y cuentas operativas."
        actions={
          <Button size="xs" onClick={() => setModalOpen(true)}>
            <Plus size={12} />
            Nueva cuenta
          </Button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px", marginBottom: "16px" }}>
        {[
          { label: "Saldo total", value: formatCurrency(cashOverview?.total_balance ?? 0), sub: `${cashOverview?.account_count ?? 0} cuentas` },
          { label: "Liquidez inmediata", value: formatCurrency(cashOverview?.liquid_balance ?? 0), sub: `${cashOverview?.liquid_account_count ?? 0} cuentas líquidas` },
          { label: "Saldo no líquido", value: formatCurrency(cashOverview?.non_liquid_balance ?? 0), sub: "Incluido en patrimonio" },
          { label: "Cobertura rápida", value: cashOverview && cashOverview.liquid_balance > 0 ? "Disponible" : "N/D", sub: "Base para emergencia y caja" },
        ].map((item) => (
          <Card key={item.label} style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>{item.label}</div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", marginBottom: "6px" }}>{item.value}</div>
            <div style={{ fontSize: "11px", color: "var(--text-3)" }}>{item.sub}</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: "flex", gap: "12px" }}>
                <Skeleton style={{ height: "24px", width: "20%" }} />
                <Skeleton style={{ height: "24px", width: "20%" }} />
                <Skeleton style={{ height: "24px", width: "16%" }} />
                <Skeleton style={{ height: "24px", width: "16%" }} />
              </div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: "var(--text-3)" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Wallet size={24} />
            </div>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-2)" }}>Todavía no hay cuentas cargadas</p>
            <p style={{ fontSize: "13px", maxWidth: "340px", textAlign: "center" }}>Empieza por tus saldos líquidos reales: efectivo, billeteras, caja de ahorro o broker.</p>
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={14} />
              Crear primera cuenta
            </Button>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={TH}>Cuenta</th>
                <th style={TH}>Institución</th>
                <th style={TH}>Tipo</th>
                <th style={TH}>Moneda</th>
                <th style={{ ...TH, textAlign: "right" }}>Saldo</th>
                <th style={{ ...TH, textAlign: "center" }}>Liquidez</th>
                <th style={{ ...TH, textAlign: "center" }}>Patrimonio</th>
                <th style={{ ...TH, width: "40px" }} />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account, i) => (
                <tr
                  key={account.id}
                  style={{ borderBottom: i !== accounts.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.1s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "8px 16px", fontSize: "12px", color: "var(--text)", fontWeight: 500 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Landmark size={12} />
                      </div>
                      <InlineEditCell
                        value={account.name}
                        onCommit={(value) => value && updateMutation.mutate({ id: account.id, payload: { ...account, name: value } })}
                      />
                    </div>
                  </td>
                  <td style={{ padding: "8px 16px", fontSize: "12px" }}>
                    <InlineEditCell
                      value={account.institution ?? ""}
                      displayValue={account.institution ?? "—"}
                      onCommit={(value) => updateMutation.mutate({ id: account.id, payload: { ...account, institution: value || null } })}
                    />
                  </td>
                  <td style={{ padding: "8px 16px", fontSize: "12px" }}>
                    <InlineEditCell
                      value={account.account_type}
                      type="select"
                      options={ACCOUNT_TYPES}
                      onCommit={(value) => updateMutation.mutate({ id: account.id, payload: { ...account, account_type: value || "cash" } })}
                    />
                  </td>
                  <td style={{ padding: "8px 16px", fontSize: "12px" }}>
                    <InlineEditCell
                      value={account.currency_code}
                      type="select"
                      options={CURRENCY_OPTIONS}
                      onCommit={(value) => updateMutation.mutate({ id: account.id, payload: { ...account, currency_code: value || "ARS" } })}
                    />
                  </td>
                  <td style={{ padding: "8px 16px", textAlign: "right" }}>
                    <InlineEditCell
                      value={String(account.current_balance)}
                      displayValue={formatCurrency(account.current_balance)}
                      type="number"
                      mono
                      align="right"
                      color="var(--primary)"
                      onCommit={(value) => {
                        const parsed = parseFloat(value.replace(",", "."));
                        if (!isNaN(parsed)) updateMutation.mutate({ id: account.id, payload: { ...account, current_balance: parsed } });
                      }}
                    />
                  </td>
                  <td style={{ padding: "8px 16px", textAlign: "center" }}>
                    <button
                      onClick={() => updateMutation.mutate({ id: account.id, payload: { ...account, is_liquid: !account.is_liquid } })}
                      style={{ border: "1px solid var(--border)", borderRadius: "999px", padding: "4px 10px", background: account.is_liquid ? "var(--success-dim)" : "var(--surface-2)", color: account.is_liquid ? "var(--success)" : "var(--text-3)" }}
                    >
                      {account.is_liquid ? "Sí" : "No"}
                    </button>
                  </td>
                  <td style={{ padding: "8px 16px", textAlign: "center" }}>
                    <button
                      onClick={() => updateMutation.mutate({ id: account.id, payload: { ...account, include_in_net_worth: !account.include_in_net_worth } })}
                      style={{ border: "1px solid var(--border)", borderRadius: "999px", padding: "4px 10px", background: account.include_in_net_worth ? "rgba(67,97,238,0.12)" : "var(--surface-2)", color: account.include_in_net_worth ? "var(--primary)" : "var(--text-3)" }}
                    >
                      {account.include_in_net_worth ? "Sí" : "No"}
                    </button>
                  </td>
                  <td style={{ padding: "8px 16px", textAlign: "right" }}>
                    <button
                      onClick={() => setDeleteId(account.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "4px", display: "flex", alignItems: "center" }}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva cuenta">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Input label="Nombre *" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
          <Input label="Institución" value={form.institution} onChange={(e) => setForm((current) => ({ ...current, institution: e.target.value }))} />
          <Select label="Tipo" options={ACCOUNT_TYPES} value={form.account_type} onChange={(e) => setForm((current) => ({ ...current, account_type: e.target.value }))} />
          <Select label="Moneda" options={CURRENCY_OPTIONS} value={form.currency_code} onChange={(e) => setForm((current) => ({ ...current, currency_code: e.target.value }))} />
          <Input label="Saldo actual *" type="text" inputMode="decimal" value={form.current_balance} onChange={(e) => setForm((current) => ({ ...current, current_balance: e.target.value }))} />
          <Input label="Notas" value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} />
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-2)" }}>
            <input type="checkbox" checked={form.is_liquid} onChange={(e) => setForm((current) => ({ ...current, is_liquid: e.target.checked }))} />
            Cuenta líquida
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-2)" }}>
            <input type="checkbox" checked={form.include_in_net_worth} onChange={(e) => setForm((current) => ({ ...current, include_in_net_worth: e.target.checked }))} />
            Incluir en patrimonio
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!form.name || !form.current_balance || addMutation.isPending}>
              {addMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteId}
        title="Eliminar cuenta"
        description="Se eliminará la cuenta y su saldo actual. Esta acción no se puede deshacer."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
