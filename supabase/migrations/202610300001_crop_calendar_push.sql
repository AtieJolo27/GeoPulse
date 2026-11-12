CREATE TABLE public.crop_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zone_id bigint NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  crop text NOT NULL CHECK (length(trim(crop)) BETWEEN 1 AND 100),
  planted_on date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('harvest', 'fertilizer')),
  event_date date NOT NULL CHECK (event_date >= planted_on),
  notify_at timestamptz NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, zone_id, crop, planted_on, kind, event_date)
);
CREATE INDEX crop_events_due ON public.crop_events(notify_at) WHERE NOT completed;
ALTER TABLE public.crop_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY crop_events_owner ON public.crop_events FOR ALL TO authenticated
  USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.zones z WHERE z.id = zone_id))
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.zones z WHERE z.id = zone_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crop_events TO authenticated;

CREATE TABLE public.push_devices (
  token text PRIMARY KEY CHECK (token ~ '^(ExponentPushToken|ExpoPushToken)\[.+\]$'),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'english' CHECK (language IN ('english', 'tagalog')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_devices_owner ON public.push_devices FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO authenticated;

CREATE TABLE public.push_zone_subscriptions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zone_id bigint NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, zone_id)
);
ALTER TABLE public.push_zone_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_subscriptions_owner ON public.push_zone_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.zones z WHERE z.id = zone_id))
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.zones z WHERE z.id = zone_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_zone_subscriptions TO authenticated;

-- Only the trusted server worker can claim or acknowledge deliveries.
CREATE TABLE public.push_deliveries (
  delivery_key text PRIMARY KEY,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  sent boolean NOT NULL DEFAULT false,
  ticket_id text
);
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_push_delivery(p_key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed text;
BEGIN
  INSERT INTO push_deliveries(delivery_key) VALUES(p_key)
  ON CONFLICT (delivery_key) DO UPDATE SET claimed_at = now()
    WHERE NOT push_deliveries.sent AND push_deliveries.claimed_at < now() - interval '5 minutes'
  RETURNING delivery_key INTO claimed;
  RETURN claimed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_push_delivery(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_delivery(text) TO service_role;

GRANT ALL ON public.crop_events, public.push_devices, public.push_zone_subscriptions, public.push_deliveries TO service_role;

NOTIFY pgrst, 'reload schema';
