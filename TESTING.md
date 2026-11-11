# Jest tests – Dashboard, Crops, Fertilizer, Irrigation, History

248 tests in 7 files. They pass against the app code you sent.

## Install (once)
1. Unzip into your project root (the folder with `package.json`). It adds `__tests__/` and `setup-jest.js`.
2. `node setup-jest.js` – adds the Jest settings to `package.json` plus two missing dev dependencies
   (`test-renderer`, `@react-native/jest-preset`).
3. `npm install`

## Run
    npm test                      # everything
    npm run test:watch            # re-run on save
    npm run test:coverage         # coverage report
    npx jest __tests__/irrigation.test.tsx
    npx jest -t "pull-to-refresh"

## What is covered
| File | Tab | Highlights |
|---|---|---|
| `dashboard.test.tsx` | Dashboard | loading/error/cache fallback, realtime refresh, 6 sensor cards + progress, alert thresholds (and boundaries), soil-health badge/ring/breakdown modal, zone selector, add-zone modal (validation, save, failure), PDF export |
| `crops.test.tsx` | Crops | loading/error/empty/retry, cache, realtime, best vs. other crops, 0% filtering, sorting, navigation, status icons |
| `fertilizer.test.tsx` | Fertilizer | same as Crops for fertilizers |
| `reasoning.test.tsx` | Crop + Fertilizer "why" screens | soil data fetch, AI prompt/language, AI errors, reference links |
| `irrigation.test.tsx` | Irrigation | watering decision at every moisture band + boundaries (70 / 75), confidence maths, history list, cache, realtime, refresh |
| `history.test.tsx` | History | chart switcher, health-score colours, metric chips, tooltips, PDF export button states + errors |
| `exportSoilPDF.test.ts` | History | HTML report, sharing, empty-history error |

Every screen is also checked in Tagalog and with a different font scale where relevant.

## How it works / assumptions
* No network or native code runs. Supabase, cache, haptics, expo-router, charts, SVG, progress bars and
  the AppContext are mocked in `__tests__/setup/jest.setup.js` and `__tests__/helpers/mocks.ts`.
* Your root `lib/` files (`cache`, `supabaseClient`, `haptics`, `exportSensorReadings`, `getHistory`,
  `soilHealthScore`, `apiConfig`) were not in the zip. They are fully mocked, so their contents don't matter,
  but the files must exist at those paths (they do in your app, since the screens import them).
  `computeSoilHealthScore` is mocked, so the scoring formula itself is NOT tested here.
* Images (`.jpg/.png`) are mapped to a stub, so missing assets can't break tests.
* Tests live in `__tests__/` (outside `app/`) so Expo Router never treats them as routes.
* Pressing a button whose handler stays pending (e.g. an export in progress) must not be `await`ed;
  use `waitFor` as the existing tests do.

## Things the tests revealed in the app
* Dashboard fetches the readings and subscribes to the realtime channel **twice** on first load,
  because `fetchData` depends on `data.length` (so the effect re-runs once data arrives). It settles after that;
  it is harmless but wasteful.
* `app/lib/getHistory.ts` in your zip is an empty file; the screens import `@/lib/getHistory` (root `lib/`).
