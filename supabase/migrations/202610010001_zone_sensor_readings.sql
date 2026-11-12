-- Existing unassigned readings remain unassigned: their zone cannot be inferred.
ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS zone_id bigint REFERENCES public.zones(id);

CREATE INDEX IF NOT EXISTS sensor_readings_zone_latest_idx
  ON public.sensor_readings (zone_id, created_at DESC, id DESC);
