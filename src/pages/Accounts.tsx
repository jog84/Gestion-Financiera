import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Landmark, Plus, Trash2, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  getAccountBalanceHistory,
  getAccountLedger,
  createFinancialTransfer,
  createFinancialAccount,
  deleteFinancialTransfer,
  deleteFinancialAccount,
  getCashOverview,
  getFinancialAccounts,
  getFinancialTransfers,
  updateFinancialAccount,
} from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { QK } from "@/lib/queryKeys";
import { invalidateCashState, invalidateDashboardState } from "@/lib/queryInvalidation";
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
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTransferId, setDeleteTransferId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
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
  const [transferForm, setTransferForm] = useState({
    from_account_id: "",
    to_account_id: "",
    amount: "",
    transfer_date: new Date().toISOString().split("T")[0],
    description: "",
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

  const { data: transfers = [] } = useQuery({
    queryKey: QK.financialTransfers(profileId, 20),
    queryFn: () => getFinancialTransfers(profileId, 20),
  });

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedAccountId("");
      return;
    }

    if (!accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const { data: accountLedger = [] } = useQuery({
    queryKey: QK.accountLedger(profileId, selectedAccountId, 25),
    queryFn: () => getAccountLedger(profileId, selectedAccountId, 25),
    enabled: !!selectedAccountId,
  });

  const { data: accountHistory = [] } = useQuery({
    queryKey: QK.accountBalanceHistory(profileId, selectedAccountId, 30),
    queryFn: () => getAccountBalanceHistory(profileId, selectedAccountId, 30),
    enabled: !!selectedAccountId,
  });

  const invalidate = () => {
    void Promise.all([
      invalidateCashState(qc, profileId),
      invalidateDashboardState(qc, profileId),
    ]);
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
    onError: (e: unknown) => toast.error(String(e)),
  });

  const createTransferMutation = useMutation({
    mutationFn: () =>
      createFinancialTransfer({
        profile_id: profileId,
        from_account_id: transferForm.from_account_id,
        to_account_id: transferForm.to_account_id,
        amount: parseFloat(transferForm.amount.replace(",", ".")),
        transfer_date: transferForm.transfer_date,
        description: transferForm.description || null,
        notes: transferForm.notes || null,
      }),
    onSuccess: () => {
      invalidate();
      setTransferModalOpen(false);
      setTransferForm({
        from_account_id: "",
        to_account_id: "",
        amount: "",
        transfer_date: new Date().toISOString().split("T")[0],
        description: "",
        notes: "",
      });
      toast.success("Transferencia registrada");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const deleteTransferMutation = useMutation({
    mutationFn: deleteFinancialTransfer,
    onSuccess: () => {
      invalidate();
      setDeleteTransferId(null);
      toast.success("Transferencia eliminada");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const selectedOrigin = accounts.find((account) => account.id === transferForm.from_account_id);
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? null;
  const destinationOptions = accounts
    .filter((account) => account.id !== transferForm.from_account_id && (!selectedOrigin || account.currency_code === selectedOrigin.currency_code))
    .map((account) => ({
      value: account.id,
      label: `${account.name}${account.institution ? ` · ${account.institution}` : ""} · ${account.currency_code}`,
    }));
  const historyData = accountHistory.map((point) => ({
    date: point.date.slice(5),
    balance: point.balance,
  }));

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1400px" }}>
      <PageHeader
        title="Cuentas y Caja"
        description="Gestiona saldos líquidos, cajas, billeteras y cuentas operativas."
        actions={
          <div style={{ display: "flex", gap: "8px" }}>
            <Button size="xs" variant="ghost" onClick={() => setTransferModalOpen(true)} disabled={accounts.length < 2}>
              <ArrowLeftRight size={12} />
              Transferir
            </Button>
            <Button size="xs" onClick={() => setModalOpen(true)}>
              <Plus size={12} />
              Nueva cuenta
            </Button>
          </div>
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

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "16px", marginTop: "16px" }}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>Trazabilidad por cuenta</div>
              <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "4px" }}>
                Reconstruye saldo con ingresos, gastos, transferencias y ajustes manuales.
              </div>
            </div>
            <div style={{ minWidth: "240px" }}>
              <Select
                options={accounts.map((account) => ({
                  value: account.id,
                  label: `${account.name}${account.institution ? ` · ${account.institution}` : ""}`,
                }))}
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                disabled={accounts.length === 0}
              />
            </div>
          </div>

          {selectedAccount ? (
            <div style={{ padding: "18px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", marginBottom: "14px" }}>
                <Card style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Cuenta activa</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>{selectedAccount.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "4px" }}>{selectedAccount.institution ?? "Sin institución"}</div>
                </Card>
                <Card style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Saldo actual</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--primary)" }}>{formatCurrency(selectedAccount.current_balance)}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "4px" }}>{selectedAccount.currency_code}</div>
                </Card>
                <Card style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Últimos 30 días</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>
                    {historyData.length > 1 ? formatCurrency(historyData[historyData.length - 1].balance - historyData[0].balance) : formatCurrency(0)}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "4px" }}>Variación neta reconstruida</div>
                </Card>
              </div>

              <div style={{ height: "220px" }}>
                {historyData.length === 0 ? (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: "13px" }}>
                    No hay historial suficiente para esta cuenta.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="accountHistoryFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} width={36} />
                      <Tooltip
                        formatter={(value) => [formatCurrency(Number(value ?? 0)), "Saldo"]}
                        labelFormatter={(label) => `Fecha: ${label}`}
                        contentStyle={{ background: "var(--surface-3)", border: "1px solid var(--border-light)", borderRadius: 8, fontSize: 11 }}
                      />
                      <Area type="monotone" dataKey="balance" stroke="var(--primary)" strokeWidth={2} fill="url(#accountHistoryFill)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: "24px 18px", color: "var(--text-3)", fontSize: "13px" }}>Crea una cuenta para habilitar trazabilidad y conciliación.</div>
          )}
        </Card>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>Actividad reciente de la cuenta</div>
            <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "4px" }}>
              Incluye cashflow imputado, transferencias y ajustes manuales de conciliación.
            </div>
          </div>

          {selectedAccountId && accountLedger.length > 0 ? (
            <div style={{ maxHeight: "420px", overflowY: "auto" }}>
              {accountLedger.map((entry, index) => (
                <div key={`${entry.entry_type}-${entry.id}-${index}`} style={{ padding: "12px 16px", borderBottom: index !== accountLedger.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>
                        {entry.description ?? (
                          entry.entry_type === "transfer"
                            ? "Transferencia interna"
                            : entry.entry_type === "adjustment"
                              ? "Ajuste de saldo"
                              : entry.entry_type === "income"
                                ? "Ingreso"
                                : "Gasto"
                        )}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "4px" }}>
                        {entry.entry_date}
                        {entry.counterparty ? ` · ${entry.direction === "in" ? "Desde" : "Hacia"} ${entry.counterparty}` : ""}
                        {entry.origin ? ` · ${entry.origin}` : ""}
                      </div>
                    </div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: entry.direction === "in" ? "var(--success)" : "var(--danger)", whiteSpace: "nowrap" }}>
                      {entry.direction === "in" ? "+" : "-"} {formatCurrency(entry.amount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "24px 18px", color: "var(--text-3)", fontSize: "13px" }}>
              {selectedAccountId ? "Todavía no hay actividad registrada para esta cuenta." : "Selecciona una cuenta para ver su actividad."}
            </div>
          )}
        </Card>
      </div>

      <Card style={{ padding: 0, overflow: "hidden", marginTop: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>Transferencias internas</div>
            <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "4px" }}>Movimientos entre cuentas propias. No impactan el patrimonio, pero sí la caja por cuenta.</div>
          </div>
          <Button size="xs" variant="outline" onClick={() => setTransferModalOpen(true)} disabled={accounts.length < 2}>
            <ArrowLeftRight size={12} />
            Nueva transferencia
          </Button>
        </div>

        {transfers.length === 0 ? (
          <div style={{ padding: "28px 18px", fontSize: "13px", color: "var(--text-3)" }}>
            Todavía no hay transferencias internas registradas.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={TH}>Fecha</th>
                <th style={TH}>Origen</th>
                <th style={TH}>Destino</th>
                <th style={TH}>Detalle</th>
                <th style={{ ...TH, textAlign: "right" }}>Monto</th>
                <th style={{ ...TH, width: "40px" }} />
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer, i) => (
                <tr key={transfer.id} style={{ borderBottom: i !== transfers.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-2)" }}>{transfer.transfer_date}</td>
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text)" }}>{transfer.from_account_name}</td>
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text)" }}>{transfer.to_account_name}</td>
                  <td style={{ padding: "10px 16px", fontSize: "12px", color: "var(--text-2)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span>{transfer.description ?? "Transferencia interna"}</span>
                      {transfer.notes ? <span style={{ color: "var(--text-3)", fontSize: "11px" }}>{transfer.notes}</span> : null}
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontSize: "12px", color: "var(--primary)", fontWeight: 600 }}>
                    {formatCurrency(transfer.amount)}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>
                    <button
                      onClick={() => setDeleteTransferId(transfer.id)}
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

      <Modal open={transferModalOpen} onClose={() => setTransferModalOpen(false)} title="Nueva transferencia" width={480}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Select
            label="Cuenta origen *"
            options={accounts.map((account) => ({
              value: account.id,
              label: `${account.name}${account.institution ? ` · ${account.institution}` : ""} · ${account.currency_code}`,
            }))}
            value={transferForm.from_account_id}
            onChange={(e) =>
              setTransferForm((current) => ({
                ...current,
                from_account_id: e.target.value,
                to_account_id: current.to_account_id === e.target.value ? "" : current.to_account_id,
              }))
            }
          />
          <Select
            label="Cuenta destino *"
            options={destinationOptions}
            placeholder={selectedOrigin ? "Seleccionar cuenta destino" : "Elegí primero una cuenta origen"}
            value={transferForm.to_account_id}
            onChange={(e) => setTransferForm((current) => ({ ...current, to_account_id: e.target.value }))}
            disabled={!selectedOrigin}
          />
          {selectedOrigin ? (
            <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "-6px" }}>
              Moneda operativa: {selectedOrigin.currency_code}. Por ahora solo se permiten transferencias entre cuentas de la misma moneda.
            </div>
          ) : null}
          <Input
            label="Monto *"
            type="text"
            inputMode="decimal"
            value={transferForm.amount}
            onChange={(e) => setTransferForm((current) => ({ ...current, amount: e.target.value }))}
          />
          <Input
            label="Fecha *"
            type="date"
            value={transferForm.transfer_date}
            onChange={(e) => setTransferForm((current) => ({ ...current, transfer_date: e.target.value }))}
          />
          <Input
            label="Descripción"
            value={transferForm.description}
            onChange={(e) => setTransferForm((current) => ({ ...current, description: e.target.value }))}
            placeholder="Ej. fondeo de broker, mover a caja de ahorro"
          />
          <Input
            label="Notas"
            value={transferForm.notes}
            onChange={(e) => setTransferForm((current) => ({ ...current, notes: e.target.value }))}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <Button variant="ghost" onClick={() => setTransferModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createTransferMutation.mutate()}
              disabled={
                !transferForm.from_account_id ||
                !transferForm.to_account_id ||
                !transferForm.amount ||
                createTransferMutation.isPending
              }
            >
              {createTransferMutation.isPending ? "Guardando..." : "Registrar transferencia"}
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

      <ConfirmModal
        open={!!deleteTransferId}
        title="Eliminar transferencia"
        description="Se revertirá el movimiento entre cuentas y los saldos volverán a su estado anterior."
        onCancel={() => setDeleteTransferId(null)}
        onConfirm={() => deleteTransferId && deleteTransferMutation.mutate(deleteTransferId)}
        isPending={deleteTransferMutation.isPending}
      />
    </div>
  );
}
