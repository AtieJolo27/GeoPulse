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
the recorded currently planted crop plus the latest NPK and environmental readings.
When no crop is planted, a deterministic soil-target assessment replaces the crop
model for fertilizer selection. It uses the same provisional bands as the app:
N 20-100, P 15-80, K 15-55 mg/kg (ppm on a mass basis). Low nutrients get separate
sources (urea, single superphosphate, muriate of potash); within/high nutrients
get no additions. The gap is to the lower boundary, never a product application
rate. These are app reference targets pending calibration, not universal ideals.
The response includes `nutrient_assessment` and uses `soil_targets` as the source
for unplanted zones; these suggestions have no model confidence percentage.
Older servers without the zone endpoint cannot supply fertilizer recommendations;
the compatibility path retains crop options but hides predicted-crop fertilizer.
Unsupported fertilizer crop labels leave crop recommendations available.

The tabs follow the dashboard zone and offer a refresh button. Sensor changes
show a refresh notice rather than automatically invoking prediction again, because
older servers may insert readings during prediction. Requests have a 30-second
UI deadline. Realtime notices
require Supabase Realtime to be enabled for `sensor_readings` with appropriate read
policies. Detail screens read the exact zone and reading selected by the result. Fertilizer
explanations also receive the planted crop used for the recommendation. Changing
the planted crop clears previous recommendations and requests fresh results.

Validation: from `backend`, run
`python -m unittest discover -s tests -p test_zone_recommendations.py`.

Fertilizer provenance is checked against the training CSV with explicit urea/MOP
aliases. Every outside-dataset option must match the reviewed evidence catalog
in `app/services/fertilizer_evidence.py`; unknown products without citations are
excluded. Each returned suggestion includes dataset membership and source links.
The catalog cites University of Minnesota Extension for nutrient composition,
not local application rates or validation of app ppm targets. References were
reviewed on 2026-10-11; recommendations do not perform a live internet search.
