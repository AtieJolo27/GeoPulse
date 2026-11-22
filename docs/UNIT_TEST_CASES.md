# GeoPulse unit test cases

Current requested TC-01 through TC-08 acceptance plan and execution evidence: [TEST_SCENARIOS.md](TEST_SCENARIOS.md). The MAIN cases below remain supporting automated regression tests.

Run from the project root:

```powershell
npm test -- --runInBand
npm run test:node
```

## Jest cases

Jest covers previously untested logic and targeted failure/recovery cases for core features. Existing Node tests are retained.

Each table-driven row is a separate test case. Tests check software behavior against the app rules; they do not validate agronomic accuracy or sensor calibration.

### cache

File: `tests/jest/cache.test.ts`

- round-trips data and expires old entries
- missing and corrupt values return null
- clears only cache keys and preserves account preferences

### farmCare

File: `tests/jest/farmCare.test.ts`

- weather decision for moisture %s temperature %s humidity %s
- insufficient history has unknown trends
- compares recent seven readings against previous seven
- dry low-nitrogen field receives moisture, compost and review tasks

### fertilizerAdvice

File: `tests/jest/fertilizerAdvice.test.ts`

- uses trusted catalog metadata and trims text
- rejects malformed or duplicate recommendations: %j
- rejects invalid assessments
- rejects invalid JSON

### recommendationReasoning

File: `tests/jest/recommendationReasoning.test.ts`

- matches all six in-range rice factors with case-insensitive crop lookup
- explains low and high factors
- unknown crop reports unavailable profile

## Existing Node suites

These suites remain under `tests/*.test.cjs`; Jest does not collect them. They include function tests, mocked service tests, and configuration checks.

- `tests/backendRequest.test.cjs`
- `tests/cropCalendar.test.cjs`
- `tests/cropEventStore.test.cjs`
- `tests/cropGuideData.test.cjs`
- `tests/cropMoisture.test.cjs`
- `tests/cropScheduleResponse.test.cjs`
- `tests/dailyCropApi.test.cjs`
- `tests/geminiApi.test.cjs`
- `tests/groqHostingConfig.test.cjs`
- `tests/notificationReadState.test.cjs`
- `tests/plantingDate.test.cjs`
- `tests/sensorConnection.test.cjs`
- `tests/soilHealthScore.test.cjs`
- `tests/soilReportExport.test.cjs`
- `tests/soilTypeRanges.test.cjs`
- `tests/tutorialGeometry.test.cjs`
- `tests/zoneRecommendations.test.cjs`
- `tests/zoneSoilHistory.test.cjs`

## Backend unit suites

Use the project virtual environment. From the project root:

```powershell
Push-Location backend
& "..\.venv\Scripts\python.exe" -m unittest tests.test_push_main_functionality tests.test_push_worker tests.test_sensor_assignment tests.test_realtime_sensor tests.test_zone_recommendations tests.test_crop_model_cache tests.test_fertilizer_evidence -v
Pop-Location
```

The selected suites use mocks or local fixtures and do not send real pushes or save live sensor readings. Do not replace this explicit list with blanket discovery: legacy `test_sensor.py` writes generated data to a database.

## Remaining coverage

This is core business-logic coverage, not complete coverage of every screen or exported function. UI rendering and interactions, authentication context, push registration on native devices, exports on devices, live APIs, sensor hardware, and database permissions need additional component, integration, and system tests. Existing Node suites cover several related helpers, but passing those alone does not prove full workflows work.

## Main functionality: new targeted cases

| ID | Feature | Scenario | Expected result | Test file |
|---|---|---|---|---|
| MAIN-01 | Recommendations | Reading access denied | Show error; do not request predictions | tests/jest/zoneRecommendationFailures.test.ts |
| MAIN-02 | Sensor validation | Humidity over 100, negative moisture/N, pH over 14 | Reject invalid input before requesting predictions | tests/jest/zoneRecommendationFailures.test.ts |
| MAIN-03 | Recommendations | Network fails or request is cancelled | Show connection or timeout guidance | tests/jest/zoneRecommendationFailures.test.ts |
| MAIN-04 | Crop calendar | Upload of pending reminders fails | Preserve local dates and report sync failure | tests/jest/cropCalendarRecovery.test.ts |
| MAIN-05 | Crop calendar | Saved local calendar is corrupted | Report unreadable data; do not upload it | tests/jest/cropCalendarRecovery.test.ts |
| MAIN-06 | Push reminders | Current crop has a due harvest reminder | Route reminder to that zone's calendar | backend/tests/test_push_main_functionality.py |
| MAIN-07 | Push reminders | Event belongs to another user, old crop cycle or missing zone | Do not deliver reminder | backend/tests/test_push_main_functionality.py |
| MAIN-08 | Push reminders | Tagalog fertilizer reminder | Use localized zone/title and correct zone destination | backend/tests/test_push_main_functionality.py |
| MAIN-09 | Push delivery | Expo reports DeviceNotRegistered | Remove stale token; do not mark delivery sent | backend/tests/test_push_main_functionality.py |

These cases use mocked dependencies. They do not verify live push arrival, real database permissions, or on-device navigation. MAIN-06 tests routing of a due event returned by the database, not the database time-filter implementation.

## Additional main-functionality cases

| ID | Feature | Scenario | Expected result |
|---|---|---|---|
| MAIN-10 | Recommendations | Modern API returns planted-crop fertilizer and evidence | Preserve fertilizer, source crop, and evidence |
| MAIN-11 | Recommendations | Legacy prediction API rejects request | Display service explanation |
| MAIN-12 | Recommendations | Legacy response lacks crop recommendations array | Reject malformed result |
| MAIN-13 | Sensor readings | Multiple readings share timestamp | Query latest timestamp with ID tie-break and limit one |
| MAIN-14 | Calendar | Upload succeeds but refresh fails | Retain local recovery copy |
| MAIN-15 | Calendar | Pending completed task syncs successfully | Remove temporary ID, preserve completion, clear recovery copy after refresh |
| MAIN-16 | Calendar | Edit would duplicate another local task | Reject edit without overwriting saved dates |
| MAIN-17 | Push transport | Send harvest reminder with zone destination | Preserve destination, Android channel, access header and timeout |
| MAIN-18 | Push transport | Expo rejects oversized message | Return rejection instead of successful ticket |
| MAIN-19 | Push delivery | Message rejected for reason other than expired device | Retain device and leave delivery unacknowledged |

MAIN-10 through MAIN-13 are in `tests/jest/zoneRecommendationFailures.test.ts`; MAIN-14 through MAIN-16 are in `tests/jest/cropCalendarRecovery.test.ts`; MAIN-17 through MAIN-19 are in `backend/tests/test_push_main_functionality.py`. All network calls are mocked.

Verification: 40 Jest cases pass across six suites; seven cases pass in the main-functionality backend push suite.
