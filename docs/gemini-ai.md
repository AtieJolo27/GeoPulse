Gemini requests run on the existing Oregon Render backend:

App -> Expo API (prompts and validation) -> Render /ai/gemini -> Google Gemini.

Expo never calls Google's Gemini endpoint directly. The app keeps its existing Expo API address. All Gemini advice and calendar requests use the relay. Gemini requests never fall back to another provider.

Deployment order:

1. Deploy the backend changes to the existing Oregon Render service (capstone-eem0). Set GEMINI_API_KEY and optionally GEMINI_MODEL on that service. Use a text model available to your Google project; the existing default is gemini-3.8-flash.
2. Set the same long random GEMINI_PROXY_TOKEN on Render and in EAS Hosting production with Sensitive visibility. This token authenticates server-to-server requests; never prefix it with EXPO_PUBLIC_.
3. In EAS Hosting production set AI_PROVIDER=gemini and GEMINI_BACKEND_URL=https://capstone-eem0.onrender.com. EAS no longer needs GEMINI_API_KEY or GEMINI_MODEL; those belong on Render.
4. Export and redeploy the Expo API using the production environment after Render is ready. Local environment files do not update hosted environments. No APK rebuild is needed for this server change.
5. Verify /api/gemini with daily-care and fertilizer cards, plus /api/crop-schedule. Missing/wrong relay tokens are rejected before calling Google.

For local development, put GEMINI_PROXY_TOKEN, GEMINI_BACKEND_URL and AI_PROVIDER in .env.local, and put the matching token and Google key in backend/.env.local. The backend URL must use HTTPS. Restart Expo after environment changes.

Run `node scripts/setup-gemini-relay.mjs` to prepare these ignored local files from the existing Google key without printing secrets. Copy the Render variables from backend/.env.local and the EAS variables from .env.local into the corresponding hosting dashboards. The script does not change hosted settings or deploy either service.

The backend constructs the Google request with its own key and model, uses a 25-second Google timeout, and sanitizes errors. Expo allows 35 seconds for the relay and rejects blocked, truncated or empty output using the existing validators. A sleeping Render service may need to wake before retrying. Keep the Oregon service running for reliable latency. Existing daily tips remain cached until expiry or a context/date change.

The backend retries one Google HTTP 500, 502, 503, or 504 after a one-second delay if time remains in its 25-second budget. A timeout returns UPSTREAM_TIMEOUT; other network or malformed-response failures return UPSTREAM_UNAVAILABLE. Render logs record safe failure categories without keys or prompts.

References:
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/available-regions
- https://docs.expo.dev/eas/hosting/environment-variables/
