# GeoPulse requested test scenarios

These eight scenarios replace MAIN-01 through MAIN-19 as the requested acceptance plan. Partial automated evidence is not a full system-test pass.

| Test ID | Test Scenario | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| TC-01 | Connect the USB HID sensor to the ESP32-S3 and request a reading. | Device is detected and a valid sensor report is received. | Not executed: ESP32-S3, USB HID sensor and firmware are not available in this workspace. | NOT EXECUTED |
| TC-02 | Decode soil parameters from a valid sensor report. | Supported N, P, K, pH, moisture, and temperature fields are decoded correctly. | Not executed: requires firmware decoder and a captured valid HID report. | NOT EXECUTED |
| TC-03 | Verify potassium x3 scaling for each new reading. | Raw K of 46 produces adjusted K of 138; other parameters remain unchanged. | Not executed: firmware scaling code is unavailable. API tests preserve an already adjusted K of 138; they do not verify 46 x3. | NOT EXECUTED |
| TC-04 | Send a sensor record from ESP32-S3 to FastAPI. | API receives the request and responds according to its implemented contract. | Automated API checks passed: valid payload returns 201 and saved row; missing pH returns 422 without saving. ESP32 transmission not tested. | PARTIAL - API ONLY |
| TC-05 | Save and retrieve a sensor record through backend / Supabase. | Record is stored and retrieved with expected field values. | Mocked save and retrieval contracts preserve expected values. No live Supabase insert/read was performed. | PARTIAL - MOCKED STORAGE |
| TC-06 | Open the mobile dashboard and refresh sensor information. | Dashboard displays available readings and handles loading or network errors appropriately. | Not executed on a phone or UI runner. Network helper checks passed separately; dashboard rendering and interactions remain unverified. | NOT EXECUTED - UI |
| TC-07 | Check crop recommendation using a known test input. | System displays the recommendation returned by the implemented prediction logic. | Known-input prediction check passed with mocked probabilities: corn 70%, rice 20%, garlic 10%; feature order and ranking verified. Model accuracy and mobile display not tested. | PARTIAL - LOGIC ONLY |
| TC-08 | Test behavior when API or internet is unavailable. | Application or device handles failure without crashing and communicates the problem where implemented. | Automated network/error helper checks passed; simulated storage failure returns controlled HTTP 500. Physical device and mobile UI outage behavior not tested. | PARTIAL - AUTOMATED |

## Run automated evidence

From the project root:

```powershell
Push-Location backend
& "..\.venv\Scripts\python.exe" -B -m unittest tests.test_scenario_contract -v
Pop-Location
node --test tests/zoneRecommendations.test.cjs tests/backendRequest.test.cjs
```

Verified: five new backend checks and 19 existing JavaScript checks passed. External dependencies are mocked. No live database writes, real pushes, firmware execution or phone UI tests were performed.

## Manual execution

- TC-01: connect the sensor to the ESP32-S3 USB host; capture detection and report logs.
- TC-02: compare every supported decoded field against a known HID report fixture.
- TC-03: capture raw and adjusted values on consecutive readings; verify 46 becomes 138 once per reading and other fields remain unchanged.
- TC-04/TC-05: use an isolated test zone/database; send a real device reading and compare the persisted row and retrieved values.
- TC-06: refresh on a phone with valid readings, no readings, and a disconnected network; record screenshots and observed behavior.
- TC-07: compare the displayed crop result with the API response for the same known input.
- TC-08: disconnect API/internet while requesting data; record device logs, messages and recovery after reconnection.
