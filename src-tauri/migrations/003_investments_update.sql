-- Add CEDEAR/investment fields to match Excel structure
ALTER TABLE investment_entries ADD COLUMN quantity REAL;
ALTER TABLE investment_entries ADD COLUMN price_ars REAL;
ALTER TABLE investment_entries ADD COLUMN dolar_ccl REAL;
ALTER TABLE investment_entries ADD COLUMN current_price_ars REAL;
