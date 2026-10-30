-- Canonical historical T20I retirement metadata. Save-specific decisions stay in saves.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_t20i_retired boolean NOT NULL DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS t20i_retirement_date date;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS t20i_retirement_source_url text;
COMMENT ON COLUMN public.players.is_t20i_retired IS 'T20I retirement only; franchise eligibility is unchanged.';
COMMENT ON COLUMN public.players.t20i_retirement_date IS 'First date ineligible for T20I selection; null preserves undated legacy flags.';
