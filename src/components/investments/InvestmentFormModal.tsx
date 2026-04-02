import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
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
  transactionKind: "buy" | "sell";
  setTransactionKind: Dispatch<SetStateAction<"buy" | "sell">>;
  instrType: InstrumentType;
  setInstrType: Dispatch<SetStateAction<InstrumentType>>;
  tickerDetection: TickerDetection | null;
  setTickerDetection: Dispatch<SetStateAction<TickerDetection | null>>;
  accountOptions: { value: string; label: string }[];
  canSave: () => boolean;
  isPending: boolean;
  onSubmit: () => void;
};

export function InvestmentFormModal({
  open,
  onClose,
  form,
  setForm,
  transactionKind,
  setTransactionKind,
  instrType,
  setInstrType,
  tickerDetection,
  setTickerDetection,
  accountOptions,
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

    const ratio = p(form.cedear_ratio) || 1;
    const ccl = p(form.dolar_ccl);
    const precioUsd = p(form.precio_usd);
    // Auto-calc ARS price from USD + ratio when user fills precio_usd
    const calcPriceArs = precioUsd > 0 && ccl > 0 ? (precioUsd * ccl) / ratio : null;

    const handlePrecioUsdChange = (val: string) => {
      const usd = p(val);
      const newPriceArs = usd > 0 && ccl > 0 ? String(Math.round((usd * ccl) / ratio)) : "";
      setForm((f) => ({ ...f, precio_usd: val, price_ars: newPriceArs }));
    };
    const handleRatioChange = (val: string) => {
      const r = p(val) || 1;
      const newPriceArs = precioUsd > 0 && ccl > 0 ? String(Math.round((precioUsd * ccl) / r)) : form.price_ars;
      setForm((f) => ({ ...f, cedear_ratio: val, price_ars: newPriceArs }));
    };
    const handleCclChange = (val: string) => {
      const newCcl = p(val);
      const newPriceArs = precioUsd > 0 && newCcl > 0 ? String(Math.round((precioUsd * newCcl) / ratio)) : form.price_ars;
      setForm((f) => ({ ...f, dolar_ccl: val, price_ars: precioUsd > 0 ? newPriceArs : f.price_ars }));
    };

    return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Input label="Ticker *" placeholder="Ej: NVDAD, GGAL" value={form.ticker} onChange={(e) => handleTickerChange(e.target.value)} />
          <Input label="Nombre (opcional)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        {renderDetectionChip({ tickerDetection, formTicker: form.ticker, instrType })}

        {/* Sección ratio CEDEAR */}
        <div style={{ background: "color-mix(in srgb, var(--primary) 6%, var(--surface-2))", border: "1px solid color-mix(in srgb, var(--primary) 20%, var(--border))", borderRadius: "8px", padding: "10px 12px" }}>
          <div style={{ fontSize: "11px", color: "var(--primary)", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Precio CEDEAR = (Precio USD × CCL) ÷ Ratio
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <Input label="Precio USD subyacente" type="text" inputMode="decimal" placeholder="Ej: 155.40" value={form.precio_usd} onChange={(e) => handlePrecioUsdChange(e.target.value)} />
            <Input label="Ratio CEDEAR" type="text" inputMode="decimal" placeholder="Ej: 10" value={form.cedear_ratio} onChange={(e) => handleRatioChange(e.target.value)} />
            <Input label="Dólar CCL *" type="text" inputMode="decimal" value={form.dolar_ccl} onChange={(e) => handleCclChange(e.target.value)} />
          </div>
          {calcPriceArs !== null && (
            <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-3)" }}>
              → Precio CEDEAR ARS calculado: <strong style={{ color: "var(--success, #4ade80)", fontFamily: "var(--font-mono)" }}>${fNum(calcPriceArs, 2)}</strong>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Input label="Cantidad *" type="text" inputMode="numeric" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
          <Input
            label={calcPriceArs !== null ? "Precio CEDEAR ARS * (auto)" : "Precio CEDEAR ARS *"}
            type="text" inputMode="decimal"
            value={form.price_ars}
            onChange={(e) => setForm((f) => ({ ...f, price_ars: e.target.value }))}
          />
        </div>
        <Input label="Precio actual ARS" type="text" inputMode="decimal" value={form.current_price_ars} onChange={(e) => setForm((f) => ({ ...f, current_price_ars: e.target.value }))} />
        {form.price_ars && form.dolar_ccl && form.quantity && (
          <div style={{ background: "var(--surface-2)", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "var(--text-3)" }}>
            Total invertido:{" "}
            <strong style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>
              ${fNum(p(form.price_ars) * p(form.quantity))} ARS
            </strong>
            {ccl > 0 && (
              <span style={{ marginLeft: "12px" }}>
                · <strong style={{ fontFamily: "var(--font-mono)" }}>USD {fNum((p(form.price_ars) * p(form.quantity)) / ccl)}</strong>
              </span>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={transactionKind === "sell" ? "Registrar venta" : "Nueva inversión"}>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>
            Operación
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {[
              { value: "buy", label: "Compra" },
              { value: "sell", label: "Venta" },
            ].map((option) => {
              const disabled = option.value === "sell" && (instrType === "plazo_fijo" || instrType === "otro");
              const active = transactionKind === option.value;
              return (
                <button
                  key={option.value}
                  disabled={disabled}
                  onClick={() => {
                    if (!disabled) {
                      setTransactionKind(option.value as "buy" | "sell");
                      setForm((current) => ({ ...current, account_id: "" }));
                    }
                  }}
                  style={{
                    padding: "5px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: "1px solid",
                    cursor: disabled ? "not-allowed" : "pointer",
                    borderRadius: "6px",
                    transition: "all 0.15s",
                    opacity: disabled ? 0.45 : 1,
                    borderColor: active ? "var(--primary)" : "var(--border)",
                    background: active ? "var(--primary-dim)" : "transparent",
                    color: active ? "var(--primary)" : "var(--text-3)",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
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
        {accountOptions.length > 0 && (
          <Select
            label={transactionKind === "sell" ? "Cuenta de liquidación *" : "Cuenta"}
            options={accountOptions}
            placeholder={transactionKind === "sell" ? "Seleccionar cuenta" : "Sin impacto en caja"}
            value={form.account_id}
            onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
          />
        )}
        {formFields()}
        <Input label="Notas" placeholder="Opcional" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        {(instrType === "cedear" || instrType === "accion") && (
          <Input label="Fecha *" type="date" value={form.transaction_date} onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))} />
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={!canSave() || isPending}>
            {isPending ? "Guardando..." : transactionKind === "sell" ? "Registrar venta" : "Guardar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
