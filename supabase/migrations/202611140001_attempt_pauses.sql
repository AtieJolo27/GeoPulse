-- Pauses belong to an attempt; raw telemetry continues to be stored normally.
ALTER TABLE public.sensor_attempts
  ADD COLUMN paused_at timestamptz,
  ADD COLUMN paused_seconds double precision NOT NULL DEFAULT 0;
CREATE TABLE public.sensor_attempt_pauses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id bigint NOT NULL REFERENCES public.sensor_attempts(id),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX sensor_attempt_one_pause ON public.sensor_attempt_pauses(attempt_id) WHERE ended_at IS NULL;
ALTER TABLE public.sensor_attempt_pauses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sensor_attempt_pauses FROM anon, authenticated;
GRANT ALL ON public.sensor_attempt_pauses TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sensor_attempt_pauses_id_seq TO service_role;

CREATE FUNCTION public.set_sensor_attempt_paused(p_farm_id bigint, p_attempt_id bigint, p_paused boolean)
RETURNS public.sensor_attempts LANGUAGE plpgsql SET search_path = public AS $$
DECLARE result public.sensor_attempts; event_time timestamptz;
BEGIN
  PERFORM 1 FROM public.farm_sensor_assignments WHERE farm_id = p_farm_id FOR UPDATE;
  SELECT * INTO result FROM public.sensor_attempts WHERE id = p_attempt_id AND farm_id = p_farm_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF result.ended_at IS NOT NULL THEN RAISE EXCEPTION 'Attempt already finished'; END IF;
  IF p_paused = (result.paused_at IS NOT NULL) THEN RETURN result; END IF;
  event_time := clock_timestamp();
  IF p_paused THEN
    INSERT INTO public.sensor_attempt_pauses(attempt_id, started_at) VALUES (result.id, event_time);
    UPDATE public.sensor_attempts SET paused_at = event_time WHERE id = result.id RETURNING * INTO result;
  ELSE
    UPDATE public.sensor_attempt_pauses SET ended_at = event_time WHERE attempt_id = result.id AND ended_at IS NULL;
    UPDATE public.sensor_attempts SET paused_seconds = paused_seconds + extract(epoch FROM event_time - paused_at),
      paused_at = NULL WHERE id = result.id RETURNING * INTO result;
  END IF;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.finish_sensor_attempt(p_farm_id bigint, p_attempt_id bigint)
RETURNS public.sensor_attempts LANGUAGE plpgsql SET search_path = public AS $$
DECLARE result public.sensor_attempts; stop_time timestamptz;
BEGIN
  PERFORM 1 FROM public.farm_sensor_assignments WHERE farm_id = p_farm_id FOR UPDATE;
  SELECT * INTO result FROM public.sensor_attempts WHERE id = p_attempt_id AND farm_id = p_farm_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF result.ended_at IS NOT NULL THEN RETURN result; END IF;
  stop_time := clock_timestamp();
  UPDATE public.sensor_attempt_pauses SET ended_at = stop_time WHERE attempt_id = result.id AND ended_at IS NULL;
  UPDATE public.sensor_attempts SET ended_at = stop_time,
    paused_seconds = paused_seconds + CASE WHEN paused_at IS NULL THEN 0 ELSE extract(epoch FROM stop_time - paused_at) END,
    paused_at = NULL, reading_count = s.n, averages = s.values
  FROM (
    SELECT count(*) AS n, jsonb_build_object(
      'soil_moisture', avg(r.soil_moisture), 'soil_temperature', avg(r.soil_temperature),
      'ph', avg(r.ph), 'nitrogen', avg(r.nitrogen), 'phosphorus', avg(r.phosphorus), 'potassium', avg(r.potassium)
    ) AS values FROM public.sensor_readings r
    WHERE r.zone_id = result.zone_id AND r.created_at >= result.started_at AND r.created_at < stop_time
      AND NOT EXISTS (SELECT 1 FROM public.sensor_attempt_pauses p WHERE p.attempt_id = result.id
        AND r.created_at >= p.started_at AND r.created_at < p.ended_at)
  ) s WHERE id = result.id RETURNING sensor_attempts.* INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.set_sensor_attempt_paused(bigint, bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_sensor_attempt_paused(bigint, bigint, boolean) TO service_role;
