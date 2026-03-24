-- Add instrument type and specific fields for different investment types
ALTER TABLE investment_entries ADD COLUMN instrument_type TEXT NOT NULL DEFAULT 'cedear';
ALTER TABLE investment_entries ADD COLUMN tna REAL;           -- Tasa nominal anual (plazo fijo)
ALTER TABLE investment_entries ADD COLUMN plazo_dias INTEGER; -- Plazo en días (plazo fijo)
ALTER TABLE investment_entries ADD COLUMN fecha_vencimiento TEXT; -- Fecha vencimiento ISO (plazo fijo, bono)
