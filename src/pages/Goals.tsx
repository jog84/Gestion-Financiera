import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Target, Download, Upload, Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { getGoals, createGoal, deleteGoal, updateGoalAmount, getMilestones, createMilestone, deleteMilestone, checkAndMarkMilestones } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { exportGoalsTemplate, importGoals } from "@/lib/excel";
import { toast } from "sonner";
import type { GoalEntry } from "@/types";

const PROFILE_ID = "default";

function ProgressBar({ value, max, milestonesPct = [] }: { value: number; max: number; milestonesPct?: number[] }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div style={{ position: "relative", height: "6px", width: "100%", borderRadius: "3px", background: "var(--border)" }}>
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          borderRadius: "3px",
          background: pct >= 100 ? "var(--success)" : "var(--primary)",
          transition: "width 0.5s ease",
        }}
      />
      {milestonesPct.map((mp) => (
        <div
          key={mp}
          style={{
            position: "absolute",
            top: "-2px",
            left: `${mp}%`,
            width: "2px",
            height: "10px",
            background: "var(--warning)",
            borderRadius: "1px",
            transform: "translateX(-50%)",
          }}
        />
      ))}
    </div>
  );
}

function GoalMilestones({ goal, pct }: { goal: GoalEntry; pct: number }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPct, setNewPct] = useState("");

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones", goal.id],
    queryFn: () => getMilestones(goal.id),
  });

  const addMutation = useMutation({
    mutationFn: () => createMilestone(goal.id, PROFILE_ID, newLabel.trim(), parseFloat(newPct)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milestones", goal.id] });
      setAdding(false);
      setNewLabel("");
      setNewPct("");
      toast.success("Hito creado");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const deleteMilestoneM = useMutation({
    mutationFn: deleteMilestone,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", goal.id] }),
  });

  if (milestones.length === 0 && !adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)", display: "flex", alignItems: "center", gap: "4px", padding: 0 }}
      >
        <Flag size={10} /> Agregar hito
      </button>
    );
  }

  return (
    <div style={{ marginTop: "10px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {milestones.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: m.reached_at ? "var(--success)" : "var(--border)", flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: "11px", color: m.reached_at ? "var(--success)" : "var(--text-3)", fontFamily: "var(--font-ui)", textDecoration: m.reached_at ? "line-through" : "none" }}>
              {m.label} ({m.target_pct}%)
            </span>
            {!m.reached_at && pct >= m.target_pct && (
              <span style={{ fontSize: "10px", color: "var(--success)", fontFamily: "var(--font-ui)" }}>✓</span>
            )}
            <button
              onClick={() => deleteMilestoneM.mutate(m.id)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "1px", borderRadius: "3px", display: "flex", alignItems: "center" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
      {adding ? (
        <div style={{ marginTop: "6px", display: "flex", gap: "4px", alignItems: "center" }}>
          <input
            autoFocus
            placeholder="Nombre del hito"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            style={{ flex: 1, fontSize: "11px", padding: "3px 6px", borderRadius: "4px", border: "1px solid var(--primary)", background: "var(--surface)", color: "var(--text)", outline: "none", fontFamily: "var(--font-ui)" }}
          />
          <input
            placeholder="%"
            value={newPct}
            onChange={(e) => setNewPct(e.target.value)}
            style={{ width: "44px", fontSize: "11px", padding: "3px 6px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", outline: "none", fontFamily: "var(--font-mono)" }}
          />
          <button
            onClick={() => { if (newLabel.trim() && newPct) addMutation.mutate(); }}
            style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "4px", background: "var(--primary)", border: "none", color: "#fff", cursor: "pointer", fontFamily: "var(--font-ui)" }}
          >
            OK
          </button>
          <button onClick={() => setAdding(false)} style={{ fontSize: "11px", padding: "3px 6px", borderRadius: "4px", background: "none", border: "1px solid var(--border)", color: "var(--text-3)", cursor: "pointer" }}>✕</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{ marginTop: "6px", fontSize: "11px", color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)", display: "flex", alignItems: "center", gap: "4px", padding: 0 }}
        >
          <Plus size={10} /> Hito
        </button>
      )}
    </div>
  );
}

export function Goals() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [form, setForm] = useState({
    name: "",
    target_amount: "",
    current_amount: "0",
    target_date: "",
    notes: "",
  });

  const qc = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["goals", PROFILE_ID],
    queryFn: () => getGoals(PROFILE_ID),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      createGoal({
        profile_id: PROFILE_ID,
        name: form.name,
        target_amount: parseFloat(form.target_amount.replace(",", ".")),
        current_amount: parseFloat(form.current_amount.replace(",", ".")) || 0,
        target_date: form.target_date || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      setModalOpen(false);
      setForm({ name: "", target_amount: "", current_amount: "0", target_date: "", notes: "" });
      toast.success("Objetivo registrado correctamente");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, amount, targetAmount }: { id: string; amount: number; targetAmount: number }) => {
      await updateGoalAmount(id, amount);
      const pct = targetAmount > 0 ? (amount / targetAmount) * 100 : 0;
      const newMilestones = await checkAndMarkMilestones(id, pct);
      return newMilestones;
    },
    onSuccess: (newMilestones, { id }) => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["milestones", id] });
      setEditingId(null);
      if (newMilestones.length > 0) {
        toast.success(`¡Hito alcanzado: ${newMilestones.map((m) => m.label).join(", ")}!`);
      } else {
        toast.success("Progreso actualizado");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      setDeleteId(null);
      toast.success("Objetivo eliminado");
    },
  });

  const completed = goals.filter((g) => g.current_amount >= g.target_amount).length;
  const importRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await importGoals(file);
      if (rows.length === 0) { toast.error("No se encontraron filas válidas en el archivo"); return; }
      let ok = 0;
      for (const r of rows) {
        await createGoal({ profile_id: PROFILE_ID, name: r.name, target_amount: r.target_amount, current_amount: r.current_amount, target_date: r.target_date || undefined, notes: r.notes || undefined });
        ok++;
      }
      qc.invalidateQueries({ queryKey: ["goals"] });
      toast.success(`${ok} objetivo(s) importado(s) correctamente`);
    } catch {
      toast.error("Error al importar el archivo. Verificá que el formato sea el correcto.");
    }
    e.target.value = "";
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1400px" }}>
      <div className="animate-fade-in-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>Objetivos</h1>
          <p style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "2px" }}>
            {completed} de {goals.length} completados
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Button variant="outline" size="sm" onClick={() => exportGoalsTemplate()}>
            <Download size={13} /> Descargar plantilla
          </Button>
          <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
            <Upload size={13} /> Importar
          </Button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={14} />
            Nuevo objetivo
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {Array.from({ length: 4 }).map((_, j) => (
            <Skeleton key={j} style={{ height: "180px", width: "100%", borderRadius: "var(--radius)" }} />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div style={{ padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "var(--text-3)", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "var(--radius)" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
            <Target size={24} style={{ color: "var(--text-3)" }} />
          </div>
          <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-2)" }}>¡Aún no hay objetivos!</p>
          <p style={{ fontSize: "13px", maxWidth: "300px", textAlign: "center", marginBottom: "8px" }}>Traza tus metas de ahorro y descubre cuánto te falta para cumplirlas.</p>
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={14} />
            Nuevo objetivo
          </Button>
        </div>
      ) : (
        <div className="animate-fade-in-up delay-100" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "12px" }}>
          {goals.map((goal) => {
            const pct = Math.min(100, goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0);
            const isCompleted = pct >= 100;
            return (
              <div
                key={goal.id}
                className="transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                style={{
                  position: "relative",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  padding: "18px 20px",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget.querySelector<HTMLButtonElement>(".delete-btn");
                  if (btn) btn.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget.querySelector<HTMLButtonElement>(".delete-btn");
                  if (btn) btn.style.opacity = "0";
                }}
              >
                {/* Top accent */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: isCompleted ? "var(--success)" : "var(--primary)", opacity: 0.7 }} />

                <button
                  className="delete-btn"
                  onClick={() => setDeleteId(goal.id)}
                  style={{
                    position: "absolute", right: "12px", top: "12px",
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-3)", padding: "4px", borderRadius: "4px",
                    display: "flex", alignItems: "center", opacity: 0, transition: "opacity 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                >
                  <Trash2 size={13} />
                </button>

                <div style={{ marginBottom: "12px" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{goal.name}</h3>
                  {goal.target_date && (
                    <p style={{ marginTop: "2px", fontSize: "11px", color: "var(--text-3)" }}>Meta: {formatDate(goal.target_date)}</p>
                  )}
                </div>

                <ProgressBar value={goal.current_amount} max={goal.target_amount} />

                <div style={{ marginTop: "10px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                  <div>
                    {editingId === goal.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          style={{
                            width: "100px", height: "28px", borderRadius: "4px",
                            border: "1px solid var(--primary)", background: "var(--surface-2)",
                            padding: "0 8px", fontSize: "12px", color: "var(--text)",
                            fontFamily: "var(--font-mono)", outline: "none",
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => updateMutation.mutate({ id: goal.id, amount: parseFloat(editAmount), targetAmount: goal.target_amount })}
                          style={{ height: "30px", padding: "0 12px", borderRadius: "8px", background: "var(--primary)", border: "none", color: "white", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)", boxShadow: "0 1px 4px rgba(67,97,238,0.3)" }}
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{ height: "30px", padding: "0 10px", borderRadius: "8px", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-3)", fontSize: "12px", cursor: "pointer", fontFamily: "var(--font-ui)" }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingId(goal.id); setEditAmount(String(goal.current_amount)); }} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                        <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono)" }}>{formatCurrency(goal.current_amount)}</span>
                        <span style={{ fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}> / {formatCurrency(goal.target_amount)}</span>
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-mono)", color: isCompleted ? "var(--success)" : "var(--primary)" }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>

                <GoalMilestones goal={goal} pct={pct} />
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo objetivo">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Input label="Nombre *" placeholder="Ej: Fondo de emergencia" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Monto objetivo *" type="text" inputMode="decimal" placeholder="0.00" value={form.target_amount} onChange={(e) => setForm((f) => ({ ...f, target_amount: e.target.value }))} />
          <Input label="Monto actual" type="text" inputMode="decimal" placeholder="0.00" value={form.current_amount} onChange={(e) => setForm((f) => ({ ...f, current_amount: e.target.value }))} />
          <Input label="Fecha límite" type="date" value={form.target_date} onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))} />
          <Input label="Notas" placeholder="Opcional" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!form.name || !form.target_amount || addMutation.isPending}>
              {addMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteId}
        title="Eliminar objetivo"
        description="¿Estás seguro de que deseas eliminar este objetivo? Esta acción no se puede deshacer y se perderá su historial de progreso."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
