import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { InstrumentType } from "@/types";
import { detectInstrumentType } from "@/lib/investmentCalcs";
import {
  createEmptyInvestmentForm,
  fNum,
  INSTRUMENT_COLORS,
  INSTRUMENT_LABELS,
  p,
  renderDetectionChip,
  type InvestmentFormState,
  type TickerDetection,
} from "@/components/investments/investmentHelpers";

type InvestmentFormModalProps = {
  open: boolean;
  onClose: () => void;
  form: InvestmentFormState;
  setForm: Dispatch<SetStateAction<InvestmentFormState>>;
  instrType: InstrumentType;
  setInstrType: Dispatch<SetStateAction<InstrumentType>>;
  tickerDetection: TickerDetection | null;
  setTickerDetection: Dispatch<SetStateAction<TickerDetection | null>>;
  canSave: () => boolean;
  isPending: boolean;
  onSubmit: () => void;
};

export function InvestmentFormModal({
  open,
  onClose,
  form,
  setForm,
  instrType,
  setInstrType,
  tickerDetection,
  setTickerDetection,
  canSave,
  isPending,
  onSubmit,
}: InvestmentFormModalProps) {
  const handleTickerChange = (value: string) => {
    const upper = value.toUpperCase();
    setForm((previous) => ({ ...previous, ticker: upper }));

    if (upper.length < 2) {
      setTickerDetection(null);
      return;
    }

    const detected = detectInstrumentType(upper);
    const switched = detected.confidence !== "low" && detected.type !== instrType;

    if (switched) {
      setInstrType(detected.type);
      toast.info(`Tipo detectado: ${INSTRUMENT_LABELS[detected.type]}`, { duration: 2500 });
    }

    setTickerDetection({
      type: detected.type,
      confidence: detected.confidence,
      reason: detected.reason,
      switched,
    });
  };

  const emptyForm = createEmptyInvestmentForm();

  const formFields = () => {
    if (instrType === "plazo_fijo") {
      return (
        <>
          <Input label="Entidad / Banco *" placeholder="Ej: Banco Nación" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <Input label="Monto invertido $ *" type="text" inputMode="decimal" value={form.price_ars} onChange={(e) => setForm((f) => ({ ...f, price_ars: e.target.value }))} />
            <Input label="TNA % *" type="text" inputMode="decimal" value={form.tna} onChange={(e) => setForm((f) => ({ ...f, tna: e.target.value }))} />
            <Input label="Plazo (días) *" type="text" inputMode="numeric" value={form.plazo_dias} onChange={(e) => setForm((f) => ({ ...f, plazo_dias: e.target.value }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input label="Fecha inicio *" type="date" value={form.transaction_date} onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))} />
            <Input label="Fecha vencimiento" type="date" value={form.fecha_vencimiento} onChange={(e) => setForm((f) => ({ ...f, fecha_vencimiento: e.target.value }))} />
          </div>
          {form.price_ars && form.tna && form.plazo_dias && (
            <div style={{ background: "var(--surface-2)", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "var(--text-3)" }}>
              Ganancia estimada:{" "}
              <strong style={{ color: "var(--success)", fontFamily: "var(--font-mono)" }}>
                ${fNum(p(form.price_ars) * (p(form.tna) / 100) * ((parseInt(form.plazo_dias) || 0) / 365))}
              </strong>
            </div>
          )}
        </>
      );
    }

    if (instrType === "fci") {
      return (
        <>
          <Input label="Nombre del fondo *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input label="Cuotapartes *" type="text" inputMode="decimal" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            <Input label="VCP compra $ *" type="text" inputMode="decimal" value={form.price_ars} onChange={(e) => setForm((f) => ({ ...f, price_ars: e.target.value }))} />
          </div>
          <Input label="VCP actual $" type="text" inputMode="decimal" value={form.current_price_ars} onChange={(e) => setForm((f) => ({ ...f, current_price_ars: e.target.value }))} />
        </>
      );
    }

    if (instrType === "bono") {
      return (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input label="Ticker *" value={form.ticker} onChange={(e) => handleTickerChange(e.target.value)} />
            <Input label="Nombre (opcional)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          {renderDetectionChip({ tickerDetection, formTicker: form.ticker, instrType })}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px" }}>
            <Input label="VN *" type="text" inputMode="decimal" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            <Input label="Precio % *" type="text" inputMode="decimal" value={form.price_ars} onChange={(e) => setForm((f) => ({ ...f, price_ars: e.target.value }))} />
            <Input label="CCL" type="text" inputMode="decimal" value={form.dolar_ccl} onChange={(e) => setForm((f) => ({ ...f, dolar_ccl: e.target.value }))} />
            <Input label="Precio actual %" type="text" inputMode="decimal" value={form.current_price_ars} onChange={(e) => setForm((f) => ({ ...f, current_price_ars: e.target.value }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input label="Fecha compra *" type="date" value={form.transaction_date} onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))} />
            <Input label="Fecha vencimiento" type="date" value={form.fecha_vencimiento} onChange={(e) => setForm((f) => ({ ...f, fecha_vencimiento: e.target.value }))} />
          </div>
        </>
      );
    }

    if (instrType === "crypto") {
      return (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input label="Ticker *" value={form.ticker} onChange={(e) => handleTickerChange(e.target.value)} />
            <Input label="Nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          {renderDetectionChip({ tickerDetection, formTicker: form.ticker, instrType })}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <Input label="Cantidad *" type="text" inputMode="decimal" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            <Input label="Precio USD compra *" type="text" inputMode="decimal" value={form.price_ars} onChange={(e) => setForm((f) => ({ ...f, price_ars: e.target.value }))} />
            <Input label="Precio USD actual" type="text" inputMode="decimal" value={form.current_price_ars} onChange={(e) => setForm((f) => ({ ...f, current_price_ars: e.target.value }))} />
          </div>
          <Input label="Dólar CCL" type="text" inputMode="decimal" value={form.dolar_ccl} onChange={(e) => setForm((f) => ({ ...f, dolar_ccl: e.target.value }))} />
        </>
      );
    }

    if (instrType === "otro") {
      return (
        <>
          <Input label="Descripción *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input label="Monto invertido *" type="text" inputMode="decimal" value={form.price_ars} onChange={(e) => setForm((f) => ({ ...f, price_ars: e.target.value }))} />
            <Input label="Valor actual" type="text" inputMode="decimal" value={form.current_price_ars} onChange={(e) => setForm((f) => ({ ...f, current_price_ars: e.target.value }))} />
          </div>
        </>
      );
    }

    return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Input label="Ticker *" placeholder="Ej: NVDAD, GGAL" value={form.ticker} onChange={(e) => handleTickerChange(e.target.value)} />
          <Input label="Nombre (opcional)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        {renderDetectionChip({ tickerDetection, formTicker: form.ticker, instrType })}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <Input label="Cantidad *" type="text" inputMode="numeric" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
          <Input label="Precio ARS *" type="text" inputMode="decimal" value={form.price_ars} onChange={(e) => setForm((f) => ({ ...f, price_ars: e.target.value }))} />
          <Input label="Dólar CCL *" type="text" inputMode="decimal" value={form.dolar_ccl} onChange={(e) => setForm((f) => ({ ...f, dolar_ccl: e.target.value }))} />
        </div>
        <Input label="Precio actual ARS" type="text" inputMode="decimal" value={form.current_price_ars} onChange={(e) => setForm((f) => ({ ...f, current_price_ars: e.target.value }))} />
        {form.price_ars && form.dolar_ccl && form.quantity && (
          <div style={{ background: "var(--surface-2)", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "var(--text-3)" }}>
            Total:{" "}
            <strong style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>
              USD {fNum((p(form.price_ars) * p(form.quantity)) / p(form.dolar_ccl))}
            </strong>
          </div>
        )}
      </>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva inversión">
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>
            Tipo de instrumento
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {(Object.keys(INSTRUMENT_LABELS) as InstrumentType[]).map((type) => (
              <button
                key={type}
                onClick={() => { setInstrType(type); setForm(emptyForm); setTickerDetection(null); }}
                style={{
                  padding: "5px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "1px solid",
                  cursor: "pointer",
                  borderRadius: "6px",
                  transition: "all 0.15s",
                  borderColor: instrType === type ? INSTRUMENT_COLORS[type] : "var(--border)",
                  background: instrType === type ? `${INSTRUMENT_COLORS[type]}22` : "transparent",
                  color: instrType === type ? INSTRUMENT_COLORS[type] : "var(--text-3)",
                }}
              >
                {INSTRUMENT_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
        {formFields()}
        <Input label="Notas" placeholder="Opcional" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        {(instrType === "cedear" || instrType === "accion") && (
          <Input label="Fecha *" type="date" value={form.transaction_date} onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))} />
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={!canSave() || isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
