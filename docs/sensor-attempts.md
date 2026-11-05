Sensor testing uses explicit Start and Finish events on the dashboard. Start when
the physical sensor is powered on; Finish when the test ends. The app does not
control device power or infer power-off from missing readings. Firmware is not
included in this repository. Automatic power events require device integration.

Apply `supabase/migrations/202611020001_sensor_attempts.sql` and deploy the backend
before using these controls. The backend uses the existing DEFAULT_FARM_ID and
service-role database connection, following the current sensor assignment API.
Do not expose the database functions to anonymous client access.

Each zone has sequential attempt numbers. Only one attempt can be active per farm
(the existing one-sensor-per-farm model). Attempts survive application restarts.
Repeated Start while active returns the same attempt; repeated Finish returns the
saved result. Relocation is rejected while testing is active. History shows the
latest 20 attempts for the selected zone. The dashboard displays only its latest
attempt. Use "View previous attempts" underneath it to open older completed
attempts for that zone, with timestamps, durations, sample counts and averages.
While testing is active, an HH:MM:SS counter updates every second using the saved
start timestamp, so elapsed time survives navigation and application restarts.

Finish stores an immutable snapshot of readings in the collection zone with
`started_at <= created_at < ended_at`. Server timestamps define the boundaries.
Each metric is an arithmetic sample mean; SQL AVG excludes null values. No samples
means no result, not zero. This is not a time-weighted average. Delayed readings
arriving after Finish are not included in the saved result. Readings must be saved
promptly with correct collection-zone and timestamp values. Existing raw readings,
dashboard cards, predictions and exports continue to use their existing data.

Database acceptance checks after migration, using a development farm:

1. Start in its assigned zone; repeat Start and verify the same ID is returned.
2. Record two readings during the attempt with known metric values. Include a null
   metric and readings outside the window/in another zone.
3. Finish; verify the count includes only in-window, same-zone rows, metric averages
   exclude nulls, and the start/end times and duration are correct.
4. Repeat Finish and verify no changes; start again and verify the next number.
5. Finish an attempt without readings and verify count zero and null averages.
6. Try two simultaneous Starts and verify one active attempt. Try relocation while
   active and verify it is rejected. Reopen the app and verify active state persists.
