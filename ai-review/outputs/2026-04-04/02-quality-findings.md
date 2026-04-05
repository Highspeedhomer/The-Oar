# Quality Findings — The Oar
**Date:** 2026-04-04  
**Version:** 1.1.3  
**Pipeline Phase:** 2 of 6

---

## Findings

---

### [HIGH] Double `loadAllData` call on mount causes redundant DB queries

**Location:** `App.jsx:90–113` — auth `useEffect`  
**Issue:** On mount with an existing session, both `supabase.auth.getSession().then()` (line 91) and `onAuthStateChange` (line 100) fire. Supabase typically emits a `SIGNED_IN` event immediately when a persisted session is detected, meaning `loadAllData(userId)` is called twice within milliseconds of each other.  
**Risk:** 10 extra Supabase queries on every page load. Each call sets `authState("loading")` mid-flight of the first call, potentially causing a loading flicker. With Supabase free-tier rate limits, this doubles query costs at startup. Could also cause a race condition where the second call's state updates partially overwrite the first call's.  
**Suggestion:** Use `onAuthStateChange` as the sole trigger. Remove the `getSession().then()` call and rely entirely on the auth subscription for initial session detection.

---

### [HIGH] `loadAllData` silently swallows errors

**Location:** `App.jsx:216–219` — `catch` block in `loadAllData`  
**Issue:** The catch block sets `authState("ready")` but does not surface the error to the user or update any error state. If any Supabase query fails (network error, RLS policy rejection, etc.), the app appears fully loaded with empty data.  
**Risk:** User sees empty app with no indication of failure. Could cause confusion ("where is all my data?") or silent data loss if the user begins entering new data on top of a failed load.  
**Suggestion:** Set `setError` with a user-facing message in the catch block, e.g. `"Failed to load your data. Please try refreshing."` and display it on screen.

---

### [HIGH] Sequential Supabase queries in `loadAllData` — unnecessary latency

**Location:** `App.jsx:136–158`  
**Issue:** Five Supabase queries (`rows`, `fasts`, `food_logs`, `water`, `settings`) are awaited in sequence. Each query waits for the previous to complete before firing.  
**Risk:** On a mobile connection with 100ms RTT, this adds ~500ms of serial latency to every app load. For a PWA that users open multiple times per day, this is a meaningful UX drag.  
**Suggestion:** Replace with `Promise.all`:
```js
const [rowsRes, fastsRes, foodRes, waterRes, settingsRes] = await Promise.all([
  supabase.from("rows").select("*").eq("user_id", userId).order("date", { ascending: false }),
  supabase.from("fasts").select("*").eq("user_id", userId).order("date", { ascending: false }),
  // ...
]);
```

---

### [HIGH] `endFast` assigns wrong `date` to completed fast

**Location:** `App.jsx:266–282` — `endFast` function  
**Issue:** The `completed` fast object is constructed with `date: todayStr()` (line 272). If the user started a fast the previous day and ends it after midnight, the completed fast record will have today's date — but the active fast was originally stored with yesterday's date when `startFast` was called.  
**Risk:** Fast history will show an incorrect date for any fast that spans midnight. Streak calculation (`calcStreak`) uses `f.date` and could skip a day if the stored date doesn't match what's expected.  
**Suggestion:** Store the original fast's `date` in `activeFast` state when the fast starts, then use `activeFast.date` (or re-fetch from DB) when constructing the completed record.

---

### [MEDIUM] Inconsistent error handling across CRUD operations

**Location:** Multiple functions in `App.jsx`  
**Issue:** Some action functions log Supabase errors (`addRow` line 246, `addWater` line 240, `addFood` line 295, `startFast` line 262), while others ignore errors entirely (`updateRow` line 306, `deleteRow` line 311, `updateFast` line 316, `deleteFast` line 334, `updateFood` line 372, `deleteFood` line 382, `updateWater` line 388, `deleteWater` line 393, `endFast` line 268).  
**Risk:** Failed updates silently succeed from the user's perspective but the database is not updated. User thinks they edited/deleted something but the change wasn't saved.  
**Suggestion:** All mutation functions should check for error and either surface a UI message or at minimum log consistently. Consistent pattern: `if (error) { console.error(...); return; }` before state update.

---

### [MEDIUM] `calcStreak` breaks with multiple fasts per day

**Location:** `App.jsx:48–61`  
**Issue:** The streak algorithm iterates sorted fasts and advances `cur` (expected date) by one day on each matching fast. If a user completes two fasts on the same day, the second one advances `cur` to the day before, potentially breaking the streak count or double-counting.  
**Risk:** Streak counter could give incorrect values for power users. Also, `fasts` is sorted descending by date (string comparison), but if two fasts have the same date, the sort order between them is undefined.  
**Suggestion:** De-duplicate by date before iterating: process at most one fast per calendar day in the streak loop.

---

### [MEDIUM] `FoodLog` component handles two unrelated concerns (food + water editing)

**Location:** `App.jsx:819–1201`  
**Issue:** `FoodLog` manages 16 local state variables, contains modals for editing both food entries and water entries, and handles USDA search + portion selection UI. Food editing and water editing are distinct features merged into one component because the Food screen also displays water.  
**Risk:** Hard to reason about, hard to test, and adding either feature (food favorites, water analytics) means working in an already-crowded function. The `editWater` / `editFood` `modalSaving` state is shared — a save operation on one modal would visually affect the other if triggered concurrently (not normally possible via UI, but fragile).  
**Suggestion:** Extract water editing into a separate `WaterEditModal` component. Extract USDA search into a `FoodSearch` component. This also prepares for future features like saved favorites.

---

### [MEDIUM] `updateFastStartTime` — no guard against `activeFast` being null

**Location:** `App.jsx:339–342`  
**Issue:** `updateFastStartTime` accesses `activeFast.id` directly without checking if `activeFast` is not null. The function is only called from the time input's `onChange` which only renders when `activeFast` is truthy — but this is an implicit coupling.  
**Risk:** If `activeFast` becomes null between renders (race condition with `endFast`), accessing `.id` will throw.  
**Suggestion:** Add a guard: `if (!activeFast) return;` at the top of the function.

---

### [MEDIUM] Row history and food log arbitrarily capped with no pagination

**Location:** `App.jsx:633` (rows: `rows.slice(0, 15)`), food log only shows `todayItems`  
**Issue:** Row history is capped at 15 entries with no load-more. The food log only shows today's entries with no way to view previous days.  
**Risk:** As the app accumulates data, historical data becomes inaccessible via the UI. The data exists in Supabase and is loaded into state, it's just not surfaced.  
**Suggestion:** Add a "Show more" button or date filter to row history. Add a date selector to the food log screen. Alternatively, consider lazy-loading: only fetch recent data on load and fetch more on demand.

---

### [MEDIUM] `settings` state can drift from Supabase state

**Location:** `App.jsx:344–368` — `updateSettings`  
**Issue:** Settings are updated optimistically in local state and also sent to Supabase. If the Supabase upsert fails, the local state is still updated and the user sees the new value — but the DB still has the old value.  
**Risk:** Data drift between app state and database. On next load, settings revert to the old value.  
**Suggestion:** Check for error in `updateSettings` and revert local state if the upsert fails.

---

### [LOW] `todayStr()` called many times per render with no memoization

**Location:** `App.jsx:22–25`, called in multiple computed values and component functions  
**Issue:** `todayStr()` constructs a new `Date()` object on every call. It's called in root-level computed values, in every list filter, and inside `FastTracker` and `FoodLog` child components. The root component re-renders every second due to `tick`.  
**Risk:** Minor — creating a few `Date` objects per second is cheap. But with 1Hz re-renders, this is wasted work.  
**Suggestion:** Memoize `todayStr` result at the top of a daily-stable value (changes only when the date rolls over), or at minimum compute it once per render in the root component and pass it down.

---

### [LOW] `activeFast.startTime` used as both timestamp and display without normalization

**Location:** `App.jsx:171` vs. `App.jsx:263`  
**Issue:** When loading from DB, `activeFast` is set with `startTime: activeFastRow.start_time` (bigint from DB, likely a number). When creating via `startFast`, `setActiveFast({ startTime: data.start_time, ... })` — from the Supabase insert response. These are consistent, but `calcStreak` calls `parseInt(f.startTime)` and `parseInt(f.endTime)` defensively (lines 53–54), suggesting uncertainty about the types.  
**Risk:** If type coercion behaves differently between environments or Supabase driver versions, date math could silently produce NaN.  
**Suggestion:** Normalize timestamps to `Number` at the point of loading (`Number(f.start_time)`) so downstream code can rely on type without defensive `parseInt`.

---

### [LOW] Unused asset: `src/assets/hero.png`

**Location:** `src/assets/hero.png`  
**Issue:** File exists but is not imported anywhere in the source.  
**Risk:** Wasted storage, minor confusion.  
**Suggestion:** Delete the file if unused.

---

### [LOW] `SettingsScreen` `Field` component defined inside the parent function

**Location:** `App.jsx:1294–1308`  
**Issue:** `Field` is defined as a nested function component inside `SettingsScreen`. On every render of `SettingsScreen`, a new function reference is created.  
**Risk:** Minor performance impact; React will remount `Field` components on every settings save because the component reference changes. This could cause input focus to be lost if a `Field` re-mounts mid-type.  
**Suggestion:** Move `Field` outside `SettingsScreen` and pass `saving` and `handleChange` as props, or convert to a plain `<div>` structure.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 4 |
| MEDIUM | 6 |
| LOW | 4 |
| **Total** | **14** |

### Top 3 to Address First

1. **Redundant `loadAllData` on mount** — doubles DB queries on every page load; straightforward to fix by using only `onAuthStateChange`
2. **Silent error swallowing in `loadAllData`** — users see empty app with no feedback on failure; adds an `setError` call
3. **`endFast` date bug** — fasts that span midnight get incorrect dates in history and could break streak calculations
