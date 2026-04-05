# Intake Report — The Oar
**Date:** 2026-04-04  
**Version:** 1.1.3  
**Pipeline Phase:** 1 of 6

---

## 1. App Overview

**Name:** The Oar  
**Version:** 1.1.3  
**Type:** Progressive Web App (PWA)  
**Environment:** Production — GitHub Pages (`https://highspeedhomer.github.io/the-oar/`)

**What it does:** A personal fitness tracker for a single user (the developer). Tracks four health behaviors:
- **Rowing:** Logs workout sessions (meters rowed, date, notes)
- **Intermittent Fasting:** Tracks active fasts with live timer, start/end times, goal hours, streak counting
- **Food/Calorie Logging:** Logs meals with calories + macros (protein, fat, carbs); integrates USDA FoodData Central for food search
- **Water Intake:** Logs water consumption in oz with quick-tap buttons and custom entry

**Who uses it:** Single owner — a personal app. No public registration, no multi-tenancy beyond the auth model. All data is tied to the signed-in Google account via Supabase RLS.

---

## 2. Tech Stack & Dependencies

**Framework:** React 19 + Vite 8  
**Build target:** ESM module, deployed to GitHub Pages via `gh-pages`  
**Database/Backend:** Supabase (Postgres, RLS, Google OAuth)  
**Font:** IBM Plex Sans loaded via Google Fonts CDN at runtime (CSS `@import`)

### Production Dependencies
| Package | Version | Purpose |
|---|---|---|
| `react` | ^19.2.4 | UI framework |
| `react-dom` | ^19.2.4 | DOM rendering |
| `@supabase/supabase-js` | ^2.101.1 | Database client + auth |

### Dev Dependencies
| Package | Purpose |
|---|---|
| `vite` ^8.0.1 | Build tool |
| `@vitejs/plugin-react` ^6.0.1 | React fast refresh + JSX |
| `gh-pages` ^6.3.0 | Deploy to GitHub Pages |
| `eslint` + hooks/refresh plugins | Linting |
| `globals`, `@eslint/js` | ESLint config |
| `@types/react`, `@types/react-dom` | TypeScript type hints only |

**Notable observations:**
- No routing library — navigation is entirely tab-state driven (`useState`)
- No state management library (Redux, Zustand, etc.) — all state in root component
- No test framework
- No PWA manifest file found in `/public/` (no `manifest.json` or `manifest.webmanifest`)
- No service worker found in `/public/` or `/src/`
- Icons present: `public/the_oar_app_icon.svg`, `public/the_oar_app_icon.png`, `public/favicon.svg`, `public/icons.svg` — but without a manifest referencing them, PWA installability is unclear

---

## 3. Code Structure

**Total source files:** 2 meaningful JS files (`src/App.jsx`, `src/main.jsx`)  
**`src/App.jsx`:** 1,513 lines — the entire application  
**`src/main.jsx`:** Entry point only (renders `<TheOar />`)

### Component Hierarchy (all in App.jsx)
```
TheOar (root — ~455 lines of state, auth, actions, render)
├── Dashboard (~75 lines)
├── RowLog (~100 lines)
├── FastTracker (~170 lines)
├── FoodLog (~380 lines — largest screen)
├── Trends (~80 lines)
├── SettingsScreen (~75 lines)
├── ProgressBar (utility)
├── MacroPill (utility)
├── MiniChart (~25 lines)
└── Spinner (utility)
```

### Architectural Patterns
- **All state lives in root `TheOar` component** — data arrays (`rows`, `fasts`, `foodLogs`, `waterLogs`), derived values (`fastElapsed`, `todayCals`, etc.), and auth state all computed in root
- **Action functions defined in root, passed as props** — `addRow`, `updateRow`, `deleteRow`, `addFood`, etc. Each screen receives all its needed actions via prop drilling (no context API)
- **Data fetching:** Single `loadAllData(userId)` function fires 5 sequential Supabase queries on auth, then sets all state
- **ID generation:** All inserts use `id: Date.now()` (millisecond timestamp as bigint primary key)
- **Inline styles:** All styling via `const S = { ... }` object at bottom of file + a `css` string injected via `<style>` tag
- **No routing library** — tab is a `useState` value, no URL reflects current tab

### Complexity Assessment
The single-file architecture is under real strain at 1,513 lines. `FoodLog` alone is ~380 lines with 16 local state variables and dual modal logic for both food and water editing. The root `TheOar` component manages 12+ state variables and 15+ action functions. Future features will make this significantly harder to maintain.

---

## 4. Data Model & Flows

### Supabase Tables
| Table | Key Columns |
|---|---|
| `rows` | id (bigint), user_id (uuid), date (text), meters (int), notes (text) |
| `fasts` | id (bigint), user_id (uuid), date (text), start_time (bigint), end_time (bigint nullable), goal_hours (int) |
| `food_logs` | id (bigint), user_id (uuid), date (text), name (text), calories (int), protein (int), fat (int), carbs (int) |
| `water` | id (bigint), user_id (uuid), date (text), oz (int) |
| `settings` | user_id (uuid PK), calorie_goal, protein_goal, fat_goal, carbs_goal, water_goal, weekday_fast_hours, weekend_fast_hours |

### Data Flow Pattern
1. User action (button press) → calls action function (e.g., `addRow`)
2. Action function sends insert/update to Supabase
3. On success, optimistically updates React state (no full re-fetch)
4. State update triggers re-render

### Notable Transformations
- **Fasts normalization (line 162–174):** `start_time` (snake_case DB column) aliased to `startTime` (camelCase) on read; same for `end_time`→`endTime`, `goal_hours`→`goalHours`. Both snake and camelCase properties exist on fast objects simultaneously
- **Active fast detection:** Fasts with `end_time == null` are separated into `activeFast` state; only completed fasts go into `fasts` array
- **Settings mapping:** DB columns (snake_case) mapped to nested JS object on read; reverse mapping via `keyMap` object in `updateSettings`
- **Date strings:** All dates stored as `YYYY-MM-DD` text (no timezone, client-local date via `todayStr()`)
- **Water `oz` column:** Defined as `int` in schema but parsed with `parseFloat` in code — small inconsistency

---

## 5. External Integrations

### Supabase
- Auth: Google OAuth via `supabase.auth.signInWithOAuth`
- Database: All 5 tables via `@supabase/supabase-js` client
- RLS: All tables use RLS with per-user policies
- URL and publishable key hardcoded in source (known acceptable per review-control)

### USDA FoodData Central API
- Endpoint: `https://api.nal.usda.gov/fdc/v1/foods/search`
- API key (`USDA_API_KEY`) hardcoded in source at line 18
- Uses two CORS proxy fallbacks for mobile:
  1. `https://corsproxy.io/`
  2. `https://api.allorigins.win/raw`
- Fetches up to 5 results, filters to `SR Legacy` and `Survey (FNDDS)` data types
- No caching of search results

### Google OAuth (via Supabase)
- Minimal scope — only identity (name, email, avatar) from user metadata
- `redirectTo` hardcoded as `window.location.origin + "/the-oar/"`

### Google Fonts
- Loaded via CSS `@import` in injected `<style>` tag (line 1504)
- Network request at runtime; no local font fallback beyond system fonts

---

## 6. Auth & Session Flow

### Initialization (lines 90–113)
1. On mount: `supabase.auth.getSession()` — if session exists, calls `loadAllData(userId)`
2. Simultaneously subscribes to `onAuthStateChange` — if session present, also calls `loadAllData(userId)`
3. On sign-out: clears all state arrays, sets `authState = "idle"`

### Potential Double-Load
Both `getSession()` and `onAuthStateChange` fire on mount. If a session exists, `loadAllData` will be called twice in quick succession — once from the resolved promise and once from the `SIGNED_IN` auth state change event. This is a known Supabase pattern but can cause flicker or redundant DB queries on load.

### Session Persistence
- `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`
- Session stored in browser (localStorage via Supabase default)
- OAuth redirect back to `/the-oar/` after Google sign-in

### user_id Flow
- `user.id` sourced from `session.user.id` (Supabase auth object)
- Passed to `loadAllData(userId)` and used in all action functions via `user.id` from React state
- All inserts explicitly include `user_id: user.id`

---

## 7. Flags for Downstream Agents

### Quality Flags
- **Double `loadAllData` call on mount** (lines 91–113): Both `getSession` promise and `onAuthStateChange` subscription can trigger `loadAllData` simultaneously, causing redundant Supabase queries
- **Sequential queries in `loadAllData`** (lines 136–158): Five `await` queries fire sequentially; could be parallelized with `Promise.all`
- **`loadAllData` error handling** (lines 216–219): Catch block sets `authState("ready")` without surfacing the error — silent failures
- **`endFast` date bug** (lines 270–275): `date` field hardcoded to `todayStr()` — if user fasts past midnight, the end date will be set to today (next day) but the fast's `date` field was set when the fast started. The `completed` object has `date: todayStr()` which may differ from the original fast's date
- **`updateFastStartTime` no null guard** (line 340): Calls `activeFast.id` with no check — fine at runtime because button only shown when `activeFast` exists, but fragile
- **Row history capped at 15** (line 633): `rows.slice(0, 15)` — no pagination or load-more for users with many sessions
- **`FoodLog` component complexity**: 16 local state variables, two separate edit modals (food + water), handles both food and water editing — likely should be split
- **`calcStreak` function** (lines 48–61): Assumes a single completed fast per day (breaks if user completes two fasts in one day)
- **`settings` never re-fetched**: If another device changes settings, the current session won't reflect them until reload
- **Inconsistent error handling**: Some CRUD operations log errors (`addRow`, `addWater`), others silently ignore Supabase errors (`updateRow`, `deleteRow`, `updateFood`, `deleteFood`, etc.)

### Security Flags
- **USDA API key hardcoded** (line 18): This is a free-tier public API key but it is exposed in the bundle. Separate concern from the Supabase publishable key
- **CORS proxy trust** (lines 895–915): App falls back to `corsproxy.io` and `allorigins.win` — third-party proxies that see all USDA search queries and responses. No sensitive user data is in these calls, but worth noting
- **`user_id` always explicitly set**: Good practice — all inserts include explicit `user_id: user.id`
- **No XSS vectors found**: No `dangerouslySetInnerHTML`, all user input rendered as React text nodes
- **`loadAllData` called with `userId` parameter**: Auth guard is `getSession()` → `loadAllData(userId)`, with RLS as the real enforcement layer

### Privacy Flags
- **Console logs contain `userId`** (line 129): `[TheOar] loadAllData start, userId: [UUID]` logs the user's Supabase UUID to the browser console
- **Health data in console logs** (lines 136–158): All query results (fasting times, food logs, water intake) are logged via `console.log` on load
- **Google Fonts**: Runtime `@import` from `fonts.googleapis.com` transmits user IP to Google on every page load
- **No data deletion UI**: Users have no way to delete their account or purge all their health data
- **USDA search queries**: Sent through third-party CORS proxies — search terms (food names) visible to proxy operators

### Performance Flags
- **Sequential Supabase queries** (lines 136–158): 5 `await` queries in `loadAllData` run one after another; adds significant latency on slow connections
- **No service worker / offline support**: Despite being a PWA with installable icons, there is no service worker — app is completely non-functional offline
- **No web app manifest**: No `manifest.json` found — app cannot meet PWA installability criteria without it (add to home screen prompt won't trigger)
- **Google Fonts at runtime**: CSS `@import` inside a `<style>` tag is render-blocking and adds an extra RTT before fonts load
- **Live timer interval** (line 85): `setInterval` fires every second, calling `setTick` which triggers a root re-render every second — all child components that are passed `tick`-derived props (`fastElapsed`) will re-render at 1Hz
- **No memoization**: No `useMemo` or `useCallback` in use; computed values like `todayCals`, `weekMeters`, `todayFood` are recalculated every render
- **`src/assets/hero.png`**: A PNG asset exists but does not appear to be used in the app
