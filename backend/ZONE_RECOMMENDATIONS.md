# Zone recommendations

Deploy the backend with `GET /zones/{zone_id}/recommendations` before using the
updated crop and fertilizer tabs. Set `DEFAULT_FARM_ID` for the farm served by
this backend and point `EXPO_PUBLIC_API_URL` at that deployment.

Apply `supabase/migrations/202610010001_zone_sensor_readings.sql` if needed.
Sensor ingestion must record the actual `zone_id` on each sensor reading.
The endpoint does not assign historical readings or infer a zone from whichever
zone a user happens to be viewing. Existing unassigned records remain unassigned.

The endpoint generates results on demand from the newest reading in the requested
zone, with ID as the tie breaker. It does not reuse the global prediction tables.
Incomplete latest readings produce a validation error. Fertilizer predictions use
the recorded planted crop, or an explicitly labelled predicted crop if none exists.
Unsupported fertilizer crop labels leave crop recommendations available.

The tabs follow the dashboard zone and offer a refresh button. Sensor changes
show a refresh notice rather than automatically invoking prediction again, because
older servers may insert readings during prediction. Requests have a 30-second
UI deadline. Realtime notices
require Supabase Realtime to be enabled for `sensor_readings` with appropriate read
policies. Detail screens read the exact zone and reading selected by the result.

Validation: from `backend`, run
`python -m unittest discover -s tests -p test_zone_recommendations.py`.
