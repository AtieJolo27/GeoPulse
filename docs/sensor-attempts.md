Sensor testing uses explicit Start and Finish events on the dashboard. Start when
the physical sensor is powered on; Finish when the test ends. The app does not
control device power or infer power-off from missing readings. Firmware is not
included in this repository. Automatic power events require device integration.

Pause before lifting or moving the probe to another spot within the same zone.
Wait for the probe to settle, then select Resume recording. Pause is a saved,
server-timed state and survives navigation or app restarts. Raw telemetry continues
to be stored and current parameters continue to refresh every five seconds, with
the last reading timestamp and a warning after one minute without fresh data.
Pausing does not control the physical sensor or guarantee probe accuracy.
The recording timer and completed duration exclude pauses. Finish also works
while paused. Switching collection zones still requires finishing the attempt.

Apply `supabase/migrations/202611140001_attempt_pauses.sql` after the original
attempts migration, then deploy the backend and app together.

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
Readings in each pause interval (`pause <= created_at < resume`, or Finish when
still paused) are excluded from the snapshot, including delayed paused readings.
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
7. Start, record moisture 10, pause, record moisture 90, resume, record moisture 30,
   then Finish. Verify count 2 and moisture average 20. Repeat Pause and Resume
   requests to verify they do not create duplicate intervals or add duration twice.
8. Finish while paused; verify the pause closes, the final timer excludes its full
   duration, and all paused readings are excluded. Repeat Finish and verify no change.
9. Reopen while paused, verify the timer stays stopped and parameters still update.
   Verify a reading exactly at Pause is excluded and exactly at Resume is included.
