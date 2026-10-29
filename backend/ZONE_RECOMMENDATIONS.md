# Zone recommendations

## Zone loading and sensor assignment

The dashboard reads `sensor_readings` directly from Supabase, filtered by the
selected `zone_id`. Selecting a zone only changes the viewed history. The separate
"Move sensor to this zone" action requires confirmation before changing assignment.
Zone and assignment failures have independent retry feedback; a late assignment
response does not replace a zone the user selected while waiting.

Read-only diagnostics from the repository root:

```sh
node scripts/check-data-access.mjs
```

This uses `.env` public settings without a signed-in session, and prints endpoint
status and row counts only. Signed-in RLS visibility can differ. An empty result
can mean no matching records or an RLS policy hiding them; do not disable RLS to
make the dashboard work.

On 2026-10-28, the existing Render deployment returned both `/zones` and
`/device/active-zone` successfully. Its active zone was 27. The public Supabase
query could read 5,514 records, all with `zone_id IS NULL`, and no records for the
five listed zones. This is a data-assignment issue, not evidence that Supabase is
unreachable. Do not backfill these records without knowing their collection zone.
The ingestion process must write the actual collection `zone_id` on new rows;
firmware and the production ingestion implementation are not included here.
The local `save_sensor_data` path now validates an explicit collection zone or
uses the persisted sensor assignment. It rejects new readings when no collection
zone is known and propagates insert failures instead of reporting false success.
Deploying this code does not change a device that inserts directly into Supabase;
that device must also send the actual collection zone with every insert.

The backend in this repository now includes GET and POST `/device/active-zone`,
persisted per `DEFAULT_FARM_ID`. Before deploying this local implementation, apply
`supabase/migrations/202610280001_farm_sensor_assignments.sql` and configure the
server-only Supabase service role key as `SUPABASE_KEY`. Never put it in an
`EXPO_PUBLIC_` variable. The migration grants no browser/mobile assignment access.
The existing deployed server already has its own assignment implementation;
inspect and migrate its assignment storage deliberately before replacing it.
This local migration does not copy or overwrite the deployed sensor assignment.
The endpoint uses this repository's existing single-farm server model; expose it
only under the same trusted access controls as other farm mutation endpoints.

Validate the local assignment service from `backend` with:

```sh
python -m unittest discover -s tests -p test_sensor_assignment.py
```

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

The tabs follow the dashboard zone and offer a refresh button. Requests
check for a readable latest zone record before contacting the
recommendation server, so empty zones do not wait for backend startup. Invalid
measurements are reported before prediction. The crop model is cached once per
server process; deploying a changed model requires restarting the process.
Model paths resolve relative to the Python module instead of the working directory.
The deployed endpoint must include `GET /zones/{zone_id}/recommendations` to avoid
the legacy `/predict` path and its database writes. Deploy this repository's
`app.main:app` from the `backend` directory only after reconciling the existing
production sensor assignment storage as described above.

Sensor changes
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
