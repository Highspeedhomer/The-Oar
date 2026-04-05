# Performance Findings — The Oar
**Date:** 2026-04-04  
**Version:** 1.1.3  
**Pipeline Phase:** 5 of 6

---

## Context

This is a mobile-first PWA evaluated through that lens. The app's target use case is quick daily check-ins: log a meal, start a fast, log water. Load time and responsiveness on mobile matter more than desktop. The single-file architecture (1,513 lines of JSX) and the absence of a service worker are the dominant performance concerns.

---

## Findings

---

### [HIGH] No service worker — app is completely non-functional offline

**Location:** `public/` directory — no service worker found  
**Issue:** Despite being presented as a PWA with installable icons, there is no service worker registered. The app has zero offline capability. Every interaction requires a live network connection to Supabase.  
**Impact:** For a fitness tracker that users open at the gym, on a run, or in areas with poor connectivity, an unavailable network means a blank screen. This is the primary gap between "works on mobile" and "is a real PWA." Users who install the app to their home screen will get a broken experience if they open it without connectivity.  
**Suggestion:** Add a basic service worker (Vite PWA plugin via `vite-plugin-pwa` is the lowest-effort path). At minimum, cache the app shell (HTML, JS, CSS) so the UI loads offline. Supabase data can remain network-only initially, with offline queue support as a future enhancement.

---

### [HIGH] No web app manifest — PWA installability criteria not met

**Location:** `public/` directory — no `manifest.json` or `manifest.webmanifest` found  
**Issue:** The app has no web app manifest. Browser PWA installability requires: a manifest with `name`, `icons`, `start_url`, `display`, and `theme_color`. Without it, browsers will not offer an "Add to Home Screen" prompt and the installed experience won't have a proper app name or icon on the home screen.  
**Impact:** The app cannot be reliably installed as a PWA. iOS Safari and Chrome on Android both require a manifest for the install flow. Icons exist in `/public/` but are not referenced in any manifest.  
**Suggestion:** Create `public/manifest.json`:
```json
{
  "name": "The Oar",
  "short_name": "The Oar",
  "start_url": "/the-oar/",
  "display": "standalone",
  "theme_color": "#0f0f11",
  "background_color": "#09090b",
  "icons": [
    { "src": "/the-oar/the_oar_app_icon.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/the-oar/the_oar_app_icon.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```
Link it in `index.html`: `<link rel="manifest" href="/the-oar/manifest.json">`

---

### [HIGH] `loadAllData` fires 5 sequential Supabase queries — adds ~400-500ms on mobile

**Location:** `App.jsx:136–158`  
**Issue:** Five `await` queries execute in serial. Each round-trip to Supabase on a mobile connection at 100ms RTT adds ~100ms of latency per query. Total: ~500ms serial wait before any data appears.  
**Impact:** Perceived app startup time is significantly extended on mobile. The loading screen shows for a noticeable duration on every app open. For a daily-use fitness tracker, this friction is felt repeatedly.  
**Suggestion:** Parallelize with `Promise.all` — all 5 queries can run simultaneously since they have no interdependencies. This reduces the data fetch time from ~500ms to ~100ms (one RTT).

---

### [MEDIUM] Root component re-renders every second due to live timer

**Location:** `App.jsx:84–87` — `setInterval(() => setTick(n => n + 1), 1000)`  
**Issue:** A 1-second interval updates `tick` state in the root component, causing the entire component tree to re-render once per second. All computed values (`fastElapsed`, `fastPct`, `fastDone`, `todayCals`, etc.) are recalculated. All child components receive new prop references every second.  
**Impact:** On most devices this is imperceptible — React's reconciliation is fast and the component tree is small. But it is unnecessary work when the fast tracker is not visible (user is on Dashboard, Food, etc.) and prevents any memoization from being effective on the timer-derived values.  
**Suggestion:** Two options: (1) Move the timer and elapsed calculation into `FastTracker` only, using a local `useEffect` interval that only runs when `activeFast` exists. This limits the 1Hz re-renders to the Fast screen only. (2) Keep the root timer but wrap expensive computed values and children in `useMemo`/`React.memo`. Option 1 is cleaner.

---

### [MEDIUM] Google Fonts loaded via CSS `@import` — render-blocking with extra RTT

**Location:** `App.jsx:1504` — `@import url('https://fonts.googleapis.com/...')`  
**Issue:** The font is loaded via a CSS `@import` inside a `<style>` tag injected by React, which fires after the JS bundle loads and React renders. This creates a flash of system font, then a re-paint when IBM Plex Sans loads. On slow connections the font may never load.  
**Impact:** Font flash (FOUT) on every page load. Longer time-to-styled-content on slow connections.  
**Suggestion:** Move the `@import` to `index.html` as a `<link rel="preconnect">` + `<link rel="stylesheet">`, which allows the browser to start the font fetch earlier in the page load. Or self-host the font files and include them in the bundle.

---

### [MEDIUM] No memoization of expensive computed values that recalculate every render

**Location:** `App.jsx:222–233` — derived values in root component  
**Issue:** Values like `todayFood`, `todayCals`, `todayProtein`, `weekMeters`, `todayWater` filter and reduce state arrays on every render. With the 1Hz timer trigger, these all execute 60+ times per minute unnecessarily.  
**Impact:** Minor on small datasets; more noticeable as food log and water logs grow. `weekMeters` scans all rows (potentially hundreds of sessions over time) on every render.  
**Suggestion:** Wrap in `useMemo` with appropriate dependencies:
```js
const todayFood = useMemo(() => foodLogs.filter(f => f.date === todayStr()), [foodLogs]);
const todayCals = useMemo(() => todayFood.reduce((s, f) => s + f.calories, 0), [todayFood]);
```

---

### [MEDIUM] Trends screen runs expensive aggregations on every render

**Location:** `App.jsx:1204–1282` — `Trends` component  
**Issue:** `Trends` computes `metersByDay`, `calsByDay`, `fastsByDay`, monthly stats, and all-time totals from the full data arrays on every render. It's re-rendered every second (due to root tick). Many of these aggregations iterate all rows, all fasts, all food logs.  
**Impact:** As data accumulates over months of use, these array scans grow linearly. All-time stats scan all historical data on every 1Hz re-render.  
**Suggestion:** Wrap the entire `Trends` component (or its expensive computations) in `React.memo` / `useMemo`. Better: move the timer out of root as described above, which eliminates the 1Hz re-render issue globally.

---

### [LOW] Bundle includes no code splitting — entire app loaded on first visit

**Location:** `vite.config.js`, `src/App.jsx`  
**Issue:** The entire app (1,513 lines of JSX + Supabase client + all styles) is in one file and one bundle chunk. There is no lazy loading or route-based code splitting.  
**Impact:** Initial JS parse time is slightly higher than necessary. For a ~200KB gzipped bundle (estimated: Supabase SDK ~80KB + React ~45KB + app ~15KB), this is acceptable now. But as the app grows, splitting will become worthwhile.  
**Suggestion:** For now, acceptable. As a future step: lazy-load screens via `React.lazy(() => import('./FoodLog'))`. This would require extracting screens into separate files.

---

### [LOW] PNG icon may not meet all PWA icon size requirements

**Location:** `public/the_oar_app_icon.png`  
**Issue:** The icon PNG exists but its dimensions are unknown without inspecting the file. PWA manifests typically need 192×192 and 512×512 minimum. Some platforms (iOS) require specific maskable icon variants.  
**Impact:** Home screen icon may display incorrectly on some devices.  
**Suggestion:** Verify the PNG dimensions. Provide at minimum a 192×192 and 512×512 version. Add a maskable icon for Android adaptive icon support.

---

### [LOW] `src/assets/hero.png` is bundled but unused

**Location:** `src/assets/hero.png`  
**Issue:** This asset exists in the source tree but is not imported anywhere. Vite will not bundle it unless imported, so it doesn't affect bundle size — but it adds noise and confusion.  
**Impact:** Negligible.  
**Suggestion:** Delete the file.

---

## Summary

**Overall Performance Posture:** Functional but missing the two features that make it a real PWA (manifest + service worker). The sequential query loading and 1Hz root re-renders are the runtime concerns that compound over time.

**Estimated Bundle Size:** ~150-200KB gzipped (Supabase SDK ~80KB gzipped, React + ReactDOM ~45KB gzipped, app code ~15-20KB gzipped). This is reasonable and not a primary concern today.

**Top 3 Issues to Address:**
1. **No web app manifest** — prevents PWA installation; cheap to fix (one JSON file + HTML link tag)
2. **No service worker** — app broken offline; use `vite-plugin-pwa` for a reasonable first implementation
3. **Sequential Supabase queries** — `Promise.all` is a one-line fix with meaningful load time reduction on mobile
