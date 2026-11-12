-- Existing crops retain an unknown planting date until the farmer supplies it.
ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS planted_on date;
