-- Storage used by the backend in this repository (one sensor per configured farm).
-- Do not replace an existing deployment's device assignment storage blindly.
CREATE TABLE IF NOT EXISTS public.farm_sensor_assignments (
  farm_id bigint PRIMARY KEY REFERENCES public.farms(id),
  zone_id bigint NOT NULL REFERENCES public.zones(id)
);

-- Assignment access is server-only. No public write policy is granted.
ALTER TABLE public.farm_sensor_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.farm_sensor_assignments FROM anon, authenticated;
GRANT ALL ON public.farm_sensor_assignments TO service_role;
