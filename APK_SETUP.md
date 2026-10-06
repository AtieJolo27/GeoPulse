# Standalone Android APK

The APK contains the app UI and bundled crop guides. It does not need Expo Go,
Metro, or a running laptop. New AI advice, weather, authentication, and cloud
readings still require internet and the hosted services.

## Deploy the backend in Render first

Commit and push the backend changes to the repository connected to your existing
Render service. Do not commit `.env` files or keys.

The service must run the updated `backend/app/main.py`, including POST `/api/groq`.
Use root directory `backend`, build command `pip install -r requirements.txt`,
and start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
Keep the existing service URL: https://capstone-eem0.onrender.com.

Set these values in Render's Environment tab:

- `GROQ_API_KEY`: your existing Groq key (currently in your local root `.env`).
- `GROQ_MODEL`: `openai/gpt-oss-20b` (optional; this is the default).
- `SUPABASE_URL` and `SUPABASE_KEY`: the existing backend database settings.
- `DEFAULT_FARM_ID`: the actual farm ID from Supabase; required for zones.

Deploy the updated service. Open `/docs` on the service and confirm POST
`/api/groq` is listed. Test it with:

```json
{"mode":"daily-care","prompt":"Give three short crop-care tasks for rice in English."}
```

A successful response has a `data` string. If the endpoint returns 404, the new
backend is not deployed. If it returns 503, check Render's `GROQ_API_KEY` setting.
Never put the Groq key in an `EXPO_PUBLIC_` variable or in the Android app.

## Build the APK

The existing Expo project is registered with slug `my-app`; the displayed app
name remains GeoPulse. The `preview` profile is a release APK, with
`developmentClient: false`. Its public variables live in EAS's `preview`
environment:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

EAS upload excludes local `.env` files. Only the public settings above are needed
in the app build. Local development also uses the hosted backend by default.
To explicitly use a local Python backend while developing, set
`EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:8000` in the local `.env`.

```powershell
npx.cmd expo install --check
npx.cmd tsc --noEmit
eas.cmd build --platform android --profile preview
```

Download the APK from the completed EAS build page and install it on the phone.
The Android manifest permits local HTTP because the ESP32 Wi-Fi setup endpoints
use HTTP. Cloud API requests use HTTPS.

## Verify on a real phone

Turn the laptop and development servers off. Using mobile data, test login,
zones, readings, crop and fertilizer predictions, both AI assessments, Daily
Tips, weather, profile settings, and exports. Use the sensor's Wi-Fi network to
test sensor setup; that feature requires access to the actual sensor.

For a clean AI test, use a crop/zone whose daily tips are not already cached.
Restart the app and verify login persists. With airplane mode enabled, verify
bundled crop guides remain available and network errors are handled.

Passing the bundle export and automated tests does not replace installing and
testing the release APK on a real device.