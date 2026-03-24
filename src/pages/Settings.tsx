import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, CheckCircle, FolderOpen, AlertTriangle, RotateCcw, Copy, Plus, Trash2, Palette } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  getDefaultProfile, updateProfileSettings,
  getDbLocation, setDbLocation, resetDbLocation, copyDbToLocation,
  getExpenseCategories, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory,
  getIncomeSources, createIncomeSource, updateIncomeSource, deleteIncomeSource,
  getThemes, createTheme, activateTheme, deactivateAllThemes, deleteTheme,
} from "@/lib/api";
import { toast } from "sonner";

const PROFILE_ID = "default";

const CURRENCIES = [
  { value: "ARS", label: "ARS — Peso Argentino" },
  { value: "USD", label: "USD — Dólar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "BRL", label: "BRL — Real Brasileño" },
  { value: "CLP", label: "CLP — Peso Chileno" },
  { value: "UYU", label: "UYU — Peso Uruguayo" },
  { value: "MXN", label: "MXN — Peso Mexicano" },
];

const LOCALES = [
  { value: "es-AR", label: "Español (Argentina)" },
  { value: "es-ES", label: "Español (España)" },
  { value: "es-MX", label: "Español (México)" },
  { value: "pt-BR", label: "Portugués (Brasil)" },
  { value: "en-US", label: "Inglés (EE.UU.)" },
];

const DEFAULT_COLORS = ["#4361ee","#06d6a0","#fb8500","#ef233c","#4cc9f0","#a855f7","#f59e0b","#e91e63","#64748b","#10b981"];

const PRESET_THEMES = [
  {
    name: "Océano",
    tokens: JSON.stringify({
      "--primary": "#0ea5e9",
      "--success": "#06d6a0",
      "--danger": "#ef4444",
      "--warning": "#f59e0b",
    }),
  },
  {
    name: "Violeta",
    tokens: JSON.stringify({
      "--primary": "#a855f7",
      "--success": "#06d6a0",
      "--danger": "#ef4444",
      "--warning": "#fb8500",
    }),
  },
  {
    name: "Esmeralda",
    tokens: JSON.stringify({
      "--primary": "#10b981",
      "--success": "#06d6a0",
      "--danger": "#ef4444",
      "--warning": "#f59e0b",
    }),
  },
];

export function Settings() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: "", currency_code: "ARS", locale: "es-AR" });

  // DB location state
  const [folderInput, setFolderInput] = useState("");
  const [dbRestartNeeded, setDbRestartNeeded] = useState(false);

  // Category/Source add forms
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(DEFAULT_COLORS[0]);
  const [newSrcName, setNewSrcName] = useState("");
  const [newSrcColor, setNewSrcColor] = useState(DEFAULT_COLORS[1]);

  // Editing state for inline name edits
  const [editingCat, setEditingCat] = useState<{ id: string; name: string; color: string } | null>(null);
  const [editingSrc, setEditingSrc] = useState<{ id: string; name: string; color: string } | null>(null);

  // Build full .db path from folder input
  const sep = "\\";
  const dbPathInput = folderInput.trim()
    ? folderInput.trim().replace(/[\\/]+$/, "") + sep + "finanzas.db"
    : "";

  const { data: profile } = useQuery({
    queryKey: ["profile_settings"],
    queryFn: getDefaultProfile,
  });

  const { data: currentDbPath, refetch: refetchDbPath } = useQuery({
    queryKey: ["db_location"],
    queryFn: getDbLocation,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["expense_categories", PROFILE_ID],
    queryFn: () => getExpenseCategories(PROFILE_ID),
  });

  const { data: sources = [] } = useQuery({
    queryKey: ["income_sources", PROFILE_ID],
    queryFn: () => getIncomeSources(PROFILE_ID),
  });

  const { data: themes = [] } = useQuery({
    queryKey: ["themes", PROFILE_ID],
    queryFn: () => getThemes(PROFILE_ID),
  });

  useEffect(() => {
    if (profile) setForm({ name: profile.name, currency_code: profile.currency_code, locale: profile.locale });
  }, [profile]);

  useEffect(() => {
    if (currentDbPath) {
      const folder = currentDbPath.replace(/[\\/][^\\/]+$/, "");
      setFolderInput(folder);
    }
  }, [currentDbPath]);

  const saveMutation = useMutation({
    mutationFn: () => updateProfileSettings(form.name, form.currency_code, form.locale),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile_settings"] });
      qc.invalidateQueries({ queryKey: ["default-profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("Configuración guardada");
    },
  });

  const moveDbMutation = useMutation({
    mutationFn: async () => {
      await copyDbToLocation(dbPathInput);
      await setDbLocation(dbPathInput);
    },
    onSuccess: () => {
      refetchDbPath();
      setDbRestartNeeded(true);
      toast.success("Datos copiados. Reiniciá la app para usar la nueva ubicación.");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const setPathOnlyMutation = useMutation({
    mutationFn: () => setDbLocation(dbPathInput),
    onSuccess: () => {
      refetchDbPath();
      setDbRestartNeeded(true);
      toast.success("Ruta actualizada. Reiniciá la app para conectar.");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const resetMutation = useMutation({
    mutationFn: resetDbLocation,
    onSuccess: () => {
      refetchDbPath();
      setDbRestartNeeded(true);
      toast.success("Ruta restablecida. Reiniciá la app.");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  // Category mutations
  const addCatMutation = useMutation({
    mutationFn: () => createExpenseCategory(PROFILE_ID, newCatName.trim(), newCatColor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense_categories"] });
      setNewCatName("");
      toast.success("Categoría creada");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const updateCatMutation = useMutation({
    mutationFn: ({ id, name, color }: { id: string; name: string; color: string }) =>
      updateExpenseCategory(id, name, color),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense_categories"] });
      setEditingCat(null);
      toast.success("Categoría actualizada");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const deleteCatMutation = useMutation({
    mutationFn: deleteExpenseCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense_categories"] });
      toast.success("Categoría eliminada");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  // Source mutations
  const addSrcMutation = useMutation({
    mutationFn: () => createIncomeSource(PROFILE_ID, newSrcName.trim(), newSrcColor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["income_sources"] });
      setNewSrcName("");
      toast.success("Fuente creada");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const updateSrcMutation = useMutation({
    mutationFn: ({ id, name, color }: { id: string; name: string; color: string }) =>
      updateIncomeSource(id, name, color),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["income_sources"] });
      setEditingSrc(null);
      toast.success("Fuente actualizada");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const deleteSrcMutation = useMutation({
    mutationFn: deleteIncomeSource,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["income_sources"] });
      toast.success("Fuente eliminada");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  // Theme mutations
  const addThemeMutation = useMutation({
    mutationFn: ({ name, tokens }: { name: string; tokens: string }) =>
      createTheme(PROFILE_ID, name, tokens),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["themes"] });
      toast.success("Tema creado");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const activateThemeMutation = useMutation({
    mutationFn: (themeId: string) => activateTheme(PROFILE_ID, themeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["themes"] });
      toast.success("Tema activado — recargá la app para ver el cambio completo");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateAllThemes(PROFILE_ID),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["themes"] });
      toast.success("Tema desactivado — usando tema por defecto");
    },
    onError: (e: unknown) => toast.error(String(e)),
  });

  const deleteThemeMutation = useMutation({
    mutationFn: deleteTheme,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["themes"] }),
    onError: (e: unknown) => toast.error(String(e)),
  });

  const pathChanged = dbPathInput.trim() !== "" && dbPathInput !== currentDbPath;
  const activeTheme = themes.find((t) => t.is_active);

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 0",
    borderBottom: "1px solid var(--border)",
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: "620px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <h1 className="animate-fade-in-up" style={{ fontSize: "20px", fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em", margin: 0 }}>Configuración</h1>

      {/* Profile */}
      <Card className="animate-fade-in-up delay-100" style={{ padding: "20px" }}>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Input label="Nombre del perfil" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Select label="Moneda" options={CURRENCIES} value={form.currency_code} onChange={(e) => setForm((f) => ({ ...f, currency_code: e.target.value }))} />
          <Select label="Idioma / Locale" options={LOCALES} value={form.locale} onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))} />
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save size={13} />
              {saveMutation.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
            {saved && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--success)" }}>
                <CheckCircle size={13} />
                Guardado
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Expense Categories */}
      <Card className="animate-fade-in-up delay-150" style={{ padding: "20px" }}>
        <CardHeader>
          <CardTitle>Categorías de gastos</CardTitle>
        </CardHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "12px" }}>
          {categories.length === 0 && (
            <p style={{ fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-ui)", padding: "8px 0" }}>Sin categorías. Agregá la primera.</p>
          )}
          {categories.map((cat) => (
            <div key={cat.id} style={rowStyle}>
              {editingCat?.id === cat.id ? (
                <>
                  <input
                    type="color"
                    value={editingCat.color ?? "#4361ee"}
                    onChange={(e) => setEditingCat((c) => c ? { ...c, color: e.target.value } : c)}
                    style={{ width: "28px", height: "28px", padding: 0, border: "none", borderRadius: "6px", cursor: "pointer", flexShrink: 0 }}
                  />
                  <input
                    autoFocus
                    value={editingCat.name}
                    onChange={(e) => setEditingCat((c) => c ? { ...c, name: e.target.value } : c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editingCat.name.trim()) updateCatMutation.mutate({ id: editingCat.id, name: editingCat.name.trim(), color: editingCat.color });
                      if (e.key === "Escape") setEditingCat(null);
                    }}
                    style={{ flex: 1, fontSize: "12px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--primary)", background: "var(--surface)", color: "var(--text)", outline: "none", fontFamily: "var(--font-ui)" }}
                  />
                  <Button size="sm" onClick={() => { if (editingCat.name.trim()) updateCatMutation.mutate({ id: editingCat.id, name: editingCat.name.trim(), color: editingCat.color }); }}>
                    Guardar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingCat(null)}>Cancelar</Button>
                </>
              ) : (
                <>
                  <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: cat.color ?? "#4361ee", flexShrink: 0 }} />
                  <span
                    style={{ flex: 1, fontSize: "12px", color: "var(--text-2)", fontFamily: "var(--font-ui)", cursor: "pointer" }}
                    onClick={() => setEditingCat({ id: cat.id, name: cat.name, color: cat.color ?? "#4361ee" })}
                  >
                    {cat.name}
                  </span>
                  <button
                    onClick={() => deleteCatMutation.mutate(cat.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="color"
            value={newCatColor}
            onChange={(e) => setNewCatColor(e.target.value)}
            style={{ width: "32px", height: "32px", padding: 0, border: "none", borderRadius: "6px", cursor: "pointer", flexShrink: 0 }}
          />
          <input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newCatName.trim()) addCatMutation.mutate(); }}
            placeholder="Nueva categoría"
            style={{ flex: 1, fontSize: "12px", padding: "6px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", outline: "none", fontFamily: "var(--font-ui)" }}
          />
          <Button size="sm" onClick={() => addCatMutation.mutate()} disabled={!newCatName.trim() || addCatMutation.isPending}>
            <Plus size={12} /> Agregar
          </Button>
        </div>
      </Card>

      {/* Income Sources */}
      <Card className="animate-fade-in-up delay-200" style={{ padding: "20px" }}>
        <CardHeader>
          <CardTitle>Fuentes de ingresos</CardTitle>
        </CardHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "12px" }}>
          {sources.length === 0 && (
            <p style={{ fontSize: "12px", color: "var(--text-3)", fontFamily: "var(--font-ui)", padding: "8px 0" }}>Sin fuentes. Agregá la primera.</p>
          )}
          {sources.map((src) => (
            <div key={src.id} style={rowStyle}>
              {editingSrc?.id === src.id ? (
                <>
                  <input
                    type="color"
                    value={editingSrc.color ?? "#06d6a0"}
                    onChange={(e) => setEditingSrc((s) => s ? { ...s, color: e.target.value } : s)}
                    style={{ width: "28px", height: "28px", padding: 0, border: "none", borderRadius: "6px", cursor: "pointer", flexShrink: 0 }}
                  />
                  <input
                    autoFocus
                    value={editingSrc.name}
                    onChange={(e) => setEditingSrc((s) => s ? { ...s, name: e.target.value } : s)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editingSrc.name.trim()) updateSrcMutation.mutate({ id: editingSrc.id, name: editingSrc.name.trim(), color: editingSrc.color });
                      if (e.key === "Escape") setEditingSrc(null);
                    }}
                    style={{ flex: 1, fontSize: "12px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--primary)", background: "var(--surface)", color: "var(--text)", outline: "none", fontFamily: "var(--font-ui)" }}
                  />
                  <Button size="sm" onClick={() => { if (editingSrc.name.trim()) updateSrcMutation.mutate({ id: editingSrc.id, name: editingSrc.name.trim(), color: editingSrc.color }); }}>
                    Guardar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingSrc(null)}>Cancelar</Button>
                </>
              ) : (
                <>
                  <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: src.color ?? "#06d6a0", flexShrink: 0 }} />
                  <span
                    style={{ flex: 1, fontSize: "12px", color: "var(--text-2)", fontFamily: "var(--font-ui)", cursor: "pointer" }}
                    onClick={() => setEditingSrc({ id: src.id, name: src.name, color: src.color ?? "#06d6a0" })}
                  >
                    {src.name}
                  </span>
                  <button
                    onClick={() => deleteSrcMutation.mutate(src.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "4px", borderRadius: "4px", display: "flex", alignItems: "center" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="color"
            value={newSrcColor}
            onChange={(e) => setNewSrcColor(e.target.value)}
            style={{ width: "32px", height: "32px", padding: 0, border: "none", borderRadius: "6px", cursor: "pointer", flexShrink: 0 }}
          />
          <input
            value={newSrcName}
            onChange={(e) => setNewSrcName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newSrcName.trim()) addSrcMutation.mutate(); }}
            placeholder="Nueva fuente (ej: Sueldo)"
            style={{ flex: 1, fontSize: "12px", padding: "6px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", outline: "none", fontFamily: "var(--font-ui)" }}
          />
          <Button size="sm" onClick={() => addSrcMutation.mutate()} disabled={!newSrcName.trim() || addSrcMutation.isPending}>
            <Plus size={12} /> Agregar
          </Button>
        </div>
      </Card>

      {/* Custom Themes */}
      <Card className="animate-fade-in-up delay-250" style={{ padding: "20px" }}>
        <CardHeader>
          <CardTitle style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Palette size={15} />
            Temas de color
          </CardTitle>
        </CardHeader>
        <p style={{ fontSize: "12px", color: "var(--text-3)", marginBottom: "12px", fontFamily: "var(--font-ui)" }}>
          {activeTheme ? `Tema activo: ${activeTheme.name}` : "Usando tema por defecto"}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
          {PRESET_THEMES.map((t) => {
            const tokens = JSON.parse(t.tokens) as Record<string, string>;
            const isActive = activeTheme?.name === t.name;
            return (
              <div
                key={t.name}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                  padding: "10px 14px", borderRadius: "10px", cursor: "pointer",
                  border: `1px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                  background: isActive ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "var(--surface)",
                  minWidth: "80px",
                }}
                onClick={() => {
                  const existing = themes.find((th) => th.name === t.name);
                  if (existing) {
                    activateThemeMutation.mutate(existing.id);
                  } else {
                    addThemeMutation.mutate({ name: t.name, tokens: t.tokens }, {
                      onSuccess: (newTheme) => activateThemeMutation.mutate(newTheme.id),
                    });
                  }
                }}
              >
                <div style={{ display: "flex", gap: "3px" }}>
                  {Object.values(tokens).slice(0, 3).map((c, i) => (
                    <div key={i} style={{ width: "14px", height: "14px", borderRadius: "50%", background: c }} />
                  ))}
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-2)", fontFamily: "var(--font-ui)" }}>{t.name}</span>
              </div>
            );
          })}
        </div>
        {themes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
            {themes.map((theme) => (
              <div key={theme.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" }}>
                <span style={{ flex: 1, fontSize: "12px", color: theme.is_active ? "var(--primary)" : "var(--text-2)", fontFamily: "var(--font-ui)", fontWeight: theme.is_active ? 600 : 400 }}>
                  {theme.name} {theme.is_active && "✓"}
                </span>
                <button
                  onClick={() => deleteThemeMutation.mutate(theme.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "2px", borderRadius: "4px", display: "flex", alignItems: "center" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {activeTheme && (
          <Button variant="ghost" size="sm" onClick={() => deactivateMutation.mutate()} style={{ color: "var(--text-3)" }}>
            Volver al tema por defecto
          </Button>
        )}
      </Card>

      {/* Shared folder */}
      <Card className="animate-fade-in-up delay-300" style={{ padding: "20px" }}>
        <CardHeader>
          <CardTitle style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FolderOpen size={16} />
            Base de datos compartida
          </CardTitle>
        </CardHeader>

        <div style={{
          background: "color-mix(in srgb, var(--primary) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
          borderRadius: "8px",
          padding: "12px 14px",
          fontSize: "12px",
          color: "var(--text-2)",
          lineHeight: 1.8,
          marginBottom: "16px",
        }}>
          <strong style={{ color: "var(--text)" }}>¿Cómo compartir los datos con otra persona?</strong>
          <ol style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
            <li>Creá una carpeta en <strong>Dropbox, OneDrive o Google Drive</strong> (ej: "Finanzas Personales DB")</li>
            <li>Pegá la ruta de esa carpeta abajo y hacé click en <strong>"Mover mis datos aquí"</strong></li>
            <li>La otra persona instala la app, va a esta pantalla y pega la misma ruta → <strong>"Solo conectar"</strong></li>
          </ol>
          <div style={{ marginTop: "8px", color: "var(--warning)", fontWeight: 500 }}>
            ⚠ No usen la app al mismo tiempo — los datos se pueden corromper.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-3)", display: "block", marginBottom: "6px" }}>
              Ubicación actual de tus datos
            </label>
            <div style={{
              fontSize: "11px", color: "var(--text-2)", background: "var(--surface-2)",
              border: "1px solid var(--border)", borderRadius: "7px", padding: "8px 12px",
              fontFamily: "var(--font-mono)", wordBreak: "break-all",
            }}>
              {currentDbPath ?? "Cargando..."}
            </div>
          </div>

          <div>
            <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-3)", display: "block", marginBottom: "4px" }}>
              Carpeta compartida (Dropbox / OneDrive / Google Drive)
            </label>
            <p style={{ fontSize: "11px", color: "var(--text-3)", margin: "0 0 6px" }}>
              Pegá la ruta de la carpeta — la app agrega el nombre del archivo automáticamente.
            </p>
            <input
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="Ej: G:\Mi unidad\Finanzas Personales DB"
              style={{
                width: "100%", padding: "8px 12px", fontSize: "12px",
                fontFamily: "var(--font-mono)", background: "var(--surface)",
                border: "1px solid var(--border)", borderRadius: "7px",
                color: "var(--text)", outline: "none", boxSizing: "border-box",
              }}
            />
            {folderInput.trim() && (
              <p style={{ fontSize: "11px", color: "var(--success)", margin: "6px 0 0", fontFamily: "var(--font-mono)" }}>
                ✓ Archivo: {dbPathInput}
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Button onClick={() => moveDbMutation.mutate()} disabled={!pathChanged || moveDbMutation.isPending}>
              <Copy size={13} />
              {moveDbMutation.isPending ? "Copiando..." : "Mover mis datos aquí"}
            </Button>
            <Button variant="outline" onClick={() => setPathOnlyMutation.mutate()} disabled={!pathChanged || setPathOnlyMutation.isPending}>
              {setPathOnlyMutation.isPending ? "Conectando..." : "Solo conectar (ya existe)"}
            </Button>
            <Button variant="ghost" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending} style={{ color: "var(--text-3)" }}>
              <RotateCcw size={13} />
              Restaurar por defecto
            </Button>
          </div>

          <p style={{ fontSize: "11px", color: "var(--text-3)", margin: 0, lineHeight: 1.6 }}>
            <strong>"Mover mis datos aquí"</strong> — copiá todos tus datos a la carpeta compartida (usalo vos la primera vez).<br />
            <strong>"Solo conectar"</strong> — conectá a datos que ya existen en esa carpeta (usalo la otra persona).
          </p>

          <div style={{
            background: "color-mix(in srgb, var(--success) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--success) 25%, transparent)",
            borderRadius: "8px", padding: "10px 14px",
            fontSize: "12px", color: "var(--text-2)", lineHeight: 1.6,
          }}>
            <strong style={{ color: "var(--success)" }}>✓ Tus datos se conservan al actualizar la app</strong><br />
            Al instalar una nueva versión, la app nunca borra tus datos — ya sea que estén en la carpeta por defecto o en una carpeta compartida.
          </div>

          {dbRestartNeeded && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: "color-mix(in srgb, var(--warning) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
              borderRadius: "8px", padding: "10px 14px",
              fontSize: "12px", color: "var(--text-2)",
            }}>
              <AlertTriangle size={14} style={{ color: "var(--warning)", flexShrink: 0 }} />
              Reiniciá la aplicación para que los cambios tomen efecto.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
