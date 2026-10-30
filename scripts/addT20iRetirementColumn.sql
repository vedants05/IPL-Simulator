-- Adds the 'is_t20i_retired' column to public.players table in Supabase
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_t20i_retired boolean DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS t20i_retirement_date date;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS t20i_retirement_source_url text;

COMMENT ON COLUMN public.players.is_t20i_retired IS
  'Player has officially retired from T20 internationals, but may remain active in franchise leagues like IPL.';
