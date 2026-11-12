-- One physical sensor per farm. Boundaries are explicit, server-timed events.
CREATE TABLE public.sensor_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  farm_id bigint NOT NULL REFERENCES public.farms(id),
  zone_id bigint NOT NULL REFERENCES public.zones(id),
  attempt_number integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ended_at timestamptz,
  reading_count bigint,
  averages jsonb,
  UNIQUE (farm_id, zone_id, attempt_number),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX sensor_attempts_one_active ON public.sensor_attempts(farm_id) WHERE ended_at IS NULL;
ALTER TABLE public.sensor_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sensor_attempts FROM anon, authenticated;
GRANT ALL ON public.sensor_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sensor_attempts_id_seq TO service_role;

CREATE FUNCTION public.start_sensor_attempt(p_farm_id bigint, p_zone_id bigint)
RETURNS public.sensor_attempts LANGUAGE plpgsql SET search_path = public AS $$
DECLARE result public.sensor_attempts;
BEGIN
  -- Serialize start/retry/finish with assignment changes for this sensor.
  PERFORM 1 FROM public.farm_sensor_assignments WHERE farm_id = p_farm_id FOR UPDATE;
  SELECT * INTO result FROM public.sensor_attempts WHERE farm_id = p_farm_id AND ended_at IS NULL;
  IF FOUND THEN
    IF result.zone_id <> p_zone_id THEN RAISE EXCEPTION 'Finish the active attempt first'; END IF;
    RETURN result;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.farm_sensor_assignments WHERE farm_id = p_farm_id AND zone_id = p_zone_id)
    THEN RAISE EXCEPTION 'Assign the sensor to this zone first'; END IF;
  INSERT INTO public.sensor_attempts(farm_id, zone_id, attempt_number)
    SELECT p_farm_id, p_zone_id, COALESCE(MAX(attempt_number), 0) + 1
    FROM public.sensor_attempts WHERE farm_id = p_farm_id AND zone_id = p_zone_id
    RETURNING * INTO result;
  RETURN result;
END $$;

CREATE FUNCTION public.finish_sensor_attempt(p_farm_id bigint, p_attempt_id bigint)
RETURNS public.sensor_attempts LANGUAGE plpgsql SET search_path = public AS $$
DECLARE result public.sensor_attempts; stop_time timestamptz;
BEGIN
  PERFORM 1 FROM public.farm_sensor_assignments WHERE farm_id = p_farm_id FOR UPDATE;
  SELECT * INTO result FROM public.sensor_attempts WHERE id = p_attempt_id AND farm_id = p_farm_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF result.ended_at IS NOT NULL THEN RETURN result; END IF;
  stop_time := clock_timestamp();
  UPDATE public.sensor_attempts SET ended_at = stop_time,
    reading_count = s.n, averages = s.values
  FROM (
    SELECT count(*) AS n, jsonb_build_object(
      'soil_moisture', avg(soil_moisture), 'soil_temperature', avg(soil_temperature),
      'ph', avg(ph), 'nitrogen', avg(nitrogen), 'phosphorus', avg(phosphorus), 'potassium', avg(potassium)
    ) AS values FROM public.sensor_readings
    WHERE zone_id = result.zone_id AND created_at >= result.started_at AND created_at < stop_time
  ) s WHERE id = result.id RETURNING sensor_attempts.* INTO result;
  RETURN result;
END $$;

-- Prevent relocating the collection zone in the middle of an attempt.
CREATE FUNCTION public.guard_active_sensor_attempt() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.zone_id IS DISTINCT FROM OLD.zone_id AND EXISTS (
    SELECT 1 FROM public.sensor_attempts WHERE farm_id = OLD.farm_id AND ended_at IS NULL
  ) THEN RAISE EXCEPTION 'Finish the active sensor attempt before relocating'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_sensor_attempt_relocation BEFORE UPDATE ON public.farm_sensor_assignments
  FOR EACH ROW EXECUTE FUNCTION public.guard_active_sensor_attempt();
REVOKE ALL ON FUNCTION public.start_sensor_attempt(bigint, bigint), public.finish_sensor_attempt(bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_sensor_attempt(bigint, bigint), public.finish_sensor_attempt(bigint, bigint) TO service_role;
