import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, PiggyBank, Download, Upload, Save } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InlineEditCell } from "@/components/ui/InlineEditCell";
import { Pagination } from "@/components/ui/Pagination";
import { getAssets, createAsset, updateAsset, deleteAsset, getNetWorthHistory, saveNetWorthSnapshot } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { exportAssetsTemplate, importAssets } from "@/lib/excel";
import { toast } from "sonner";

const PROFILE_ID = "default";

const CAT_COLORS = ["#4361ee","#06d6a0","#fb8500","#ef233c","#4cc9f0","#a855f7","#f59e0b","#e91e63"];

const ASSET_CATEGORIES = [
  { value: "efectivo", label: "Efectivo" },
  { value: "inmueble", label: "Inmueble" },
  { value: "vehiculo", label: "Vehículo" },
  { value: "inversion", label: "Inversión" },
  { value: "cripto", label: "Cripto" },
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

export function Assets() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [form, setForm] = useState({
    name: "",
    category: "",
    value: "",
    snapshot_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const qc = useQueryClient();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets", PROFILE_ID],
    queryFn: () => getAssets(PROFILE_ID),
  });

  const { data: netWorthHistory = [] } = useQuery({
    queryKey: ["net_worth_history", PROFILE_ID],
    queryFn: () => getNetWorthHistory(PROFILE_ID, 90),
  });

  const totalPatrimonio = assets.reduce((sum, a) => sum + a.value, 0);

  const byCategory = assets.reduce<Record<string, number>>((acc, a) => {
    const cat = a.category ?? "otro";
    acc[cat] = (acc[cat] ?? 0) + a.value;
    return acc;
  }, {});

  const paged = assets.slice(page * pageSize, (page + 1) * pageSize);

  const chartData = netWorthHistory.map((p) => ({
    date: p.snapshot_date.slice(5), // MM-DD
    valor: p.total_assets,
  }));

  const addMutation = useMutation({
    mutationFn: () =>
      createAsset({
        profile_id: PROFILE_ID,
        name: form.name,
        category: form.category || undefined,
        value: parseFloat(form.value.replace(",", ".")),
        snapshot_date: form.snapshot_date,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      setModalOpen(false);
      setForm({ name: "", category: "", value: "", snapshot_date: new Date().toISOString().split("T")[0], notes: "" });
      toast.success("Activo registrado correctamente");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateAsset>[1] }) =>
      updateAsset(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Activo actualizado");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      setDeleteId(null);
      toast.success("Activo eliminado");
    },
  });

  const snapshotMutation = useMutation({
    mutationFn: () => saveNetWorthSnapshot(PROFILE_ID, totalPatrimonio),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["net_worth_history"] });
      toast.success("Snapshot de patrimonio guardado");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const importRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await importAssets(file);
      if (rows.length === 0) { toast.error("No se encontraron filas válidas en el archivo"); return; }
      let ok = 0;
      for (const r of rows) {
        await createAsset({ profile_id: PROFILE_ID, name: r.name, category: r.category || undefined, value: r.value, snapshot_date: r.snapshot_date, notes: r.notes || undefined });
        ok++;
      }
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success(`${ok} activo(s) importado(s) correctamente`);
    } catch {
      toast.error("Error al importar el archivo. Verificá que el formato sea el correcto.");
    }
    e.target.value = "";
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1400px" }}>
      <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>Patrimonio</h1>
          <p style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "2px" }}>
            Patrimonio total:{" "}
            <span style={{ color: "var(--primary)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>{formatCurrency(totalPatrimonio)}</span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Button variant="outline" size="sm" onClick={() => snapshotMutation.mutate()} disabled={assets.length === 0 || snapshotMutation.isPending}>
            <Save size={13} /> Guardar snapshot
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportAssetsTemplate()}>
            <Download size={13} /> Descargar plantilla
          </Button>
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
            <Upload size={13} /> Importar
          </Button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={14} />
            Nuevo activo
          </Button>
        </div>
      </div>

      {/* Net worth history chart */}
      {chartData.length >= 2 && (
        <Card className="animate-fade-in-up delay-100" style={{ padding: "20px", marginBottom: "20px" }}>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-2)", marginBottom: "12px", fontFamily: "var(--font-ui)" }}>
            Evolución del patrimonio (últimos 90 días)
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gwNW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-3)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-3)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v).replace(/\s/g, "")} width={80} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", fontFamily: "var(--font-ui)" }}
                formatter={(v) => [formatCurrency(Number(v)), "Patrimonio"]}
              />
              <Area type="monotone" dataKey="valor" stroke="var(--primary)" strokeWidth={2} fill="url(#gwNW)" dot={false} activeDot={{ r: 3, fill: "var(--primary)" }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Category summary chips */}
      {Object.keys(byCategory).length > 0 && (
        <div className="animate-fade-in-up delay-100" style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
          {Object.entries(byCategory).map(([cat, val]) => (
            <div
              key={cat}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: "6px 12px",
                fontSize: "12px",
              }}
            >
              <span style={{ textTransform: "capitalize", color: "var(--text-3)" }}>{cat}</span>
              <span style={{ fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-mono)" }}>{formatCurrency(val)}</span>
              <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
                {totalPatrimonio > 0 ? ((val / totalPatrimonio) * 100).toFixed(0) : 0}%
              </span>
            </div>
          ))}
        </div>
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
        ) : assets.length === 0 ? (
          <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "var(--text-3)" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
              <PiggyBank size={24} style={{ color: "var(--text-3)" }} />
            </div>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-2)" }}>No tienes activos registrados</p>
            <p style={{ fontSize: "13px", maxWidth: "300px", textAlign: "center", marginBottom: "8px" }}>Calcula tu patrimonio neto agregando tus cuentas, vehículos o inmuebles.</p>
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={14} />
              Nuevo activo
            </Button>
          </div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={TH}>Activo</th>
                  <th style={TH}>Categoría</th>
                  <th style={TH}>Fecha snapshot</th>
                  <th style={{ ...TH, textAlign: "right" }}>Valor</th>
                  <th style={{ ...TH, textAlign: "right" }}>% total</th>
                  <th style={{ ...TH, width: "40px" }} />
                </tr>
              </thead>
              <tbody>
                {paged.map((asset, i) => (
                  <tr
                    key={asset.id}
                    style={{ borderBottom: i !== paged.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "6px 16px", fontSize: "12px", color: "var(--text)", fontWeight: 500, minWidth: "160px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "#fff", background: CAT_COLORS[asset.name.length % CAT_COLORS.length], flexShrink: 0 }}>
                          {asset.name.charAt(0).toUpperCase()}
                        </div>
                        <InlineEditCell
                          value={asset.name}
                          onCommit={(v) => { if (v) updateMutation.mutate({ id: asset.id, payload: { name: v, category: asset.category, value: asset.value, snapshot_date: asset.snapshot_date, notes: asset.notes } }); }}
                        />
                      </div>
                    </td>
                    <td style={{ padding: "6px 16px", minWidth: "120px" }}>
                      <InlineEditCell
                        value={asset.category ?? ""}
                        displayValue={asset.category ? asset.category : undefined}
                        type="select"
                        options={ASSET_CATEGORIES}
                        onCommit={(v) => updateMutation.mutate({ id: asset.id, payload: { name: asset.name, category: v || null, value: asset.value, snapshot_date: asset.snapshot_date, notes: asset.notes } })}
                      />
                    </td>
                    <td style={{ padding: "6px 16px", fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-mono)", width: "120px" }}>
                      <InlineEditCell
                        value={asset.snapshot_date}
                        displayValue={formatDate(asset.snapshot_date)}
                        type="date"
                        mono
                        onCommit={(v) => updateMutation.mutate({ id: asset.id, payload: { name: asset.name, category: asset.category, value: asset.value, snapshot_date: v, notes: asset.notes } })}
                      />
                    </td>
                    <td style={{ padding: "6px 16px", textAlign: "right", width: "140px" }}>
                      <InlineEditCell
                        value={String(asset.value)}
                        displayValue={formatCurrency(asset.value)}
                        type="number"
                        mono
                        align="right"
                        color="var(--primary)"
                        onCommit={(v) => {
                          const num = parseFloat(v.replace(",", "."));
                          if (!isNaN(num) && num >= 0) updateMutation.mutate({ id: asset.id, payload: { name: asset.name, category: asset.category, value: num, snapshot_date: asset.snapshot_date, notes: asset.notes } });
                        }}
                      />
                    </td>
                    <td style={{ padding: "6px 16px", textAlign: "right", fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-mono)", width: "80px" }}>
                      {totalPatrimonio > 0 ? ((asset.value / totalPatrimonio) * 100).toFixed(1) : 0}%
                    </td>
                    <td style={{ padding: "6px 16px", textAlign: "right" }}>
                      <button
                        onClick={() => setDeleteId(asset.id)}
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
              total={assets.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
            />
          </>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo activo">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Input label="Nombre *" placeholder="Ej: Departamento Palermo" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Select label="Categoría" placeholder="Sin categoría" options={ASSET_CATEGORIES} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
          <Input label="Valor *" type="text" inputMode="decimal" placeholder="0.00" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
          <Input label="Fecha de snapshot *" type="date" value={form.snapshot_date} onChange={(e) => setForm((f) => ({ ...f, snapshot_date: e.target.value }))} />
          <Input label="Notas" placeholder="Opcional" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!form.name || !form.value || addMutation.isPending}>
              {addMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteId}
        title="Eliminar activo"
        description="¿Estás seguro de que deseas eliminar este activo? Esta acción no se puede deshacer."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
