# Privacy Findings — The Oar
**Date:** 2026-04-04  
**Version:** 1.1.3  
**Pipeline Phase:** 4 of 6

---

## Context

This app collects personal health data: fasting schedules (start/end times, goal hours), calorie and macro intake (food names + nutrition values), water consumption, and rowing workout data. While it is a single-owner personal app, health data warrants care. The privacy posture is assessed against practical risk given the single-user context, not regulatory frameworks.

---

## Data Inventory

| Data Type | Where Stored | Sensitivity |
|---|---|---|
| Google account (email, name, avatar URL) | Supabase Auth, React state | Medium |
| Supabase user UUID | React state, console logs | Low |
| Fasting times (start/end timestamps, goal hours) | Supabase `fasts` table | High |
| Calorie + macro intake (food name, kcal, protein, fat, carbs) | Supabase `food_logs` table | High |
| Water intake (oz per entry) | Supabase `water` table | Low |
| Rowing sessions (meters, date, notes) | Supabase `rows` table | Low |
| User goals (calorie, macro, water, fasting hours) | Supabase `settings` table | Medium |
| Food search terms | USDA API via CORS proxy | Medium |

---

## Findings

---

### [HIGH] All health data logged to browser console on load

**Location:** `App.jsx:136–158` — `loadAllData` console statements  
**Issue:** On every page load, the entire contents of `rows`, `fasts`, `food_logs`, and `water` tables are printed to the browser console via `console.log`. This includes complete fasting timestamps, food names, calorie counts, and macro data.  
**Data Affected:** All stored health data — fasting history, complete food log, water log, rowing history  
**Suggestion:** Remove or gate all result-content console logs behind a development-only flag. Structural debug logs (`[TheOar] loadAllData start`) are fine to keep. Consider: `if (import.meta.env.DEV) console.log(...)`. The review-control notes these are intentional for debugging and will be cleaned up — flagging here so this is tracked as a priority before treating the app as production health data storage.

---

### [MEDIUM] Google Fonts transmits IP address to Google on every page load

**Location:** `App.jsx:1504` — `@import url('https://fonts.googleapis.com/...')`  
**Issue:** The IBM Plex Sans font is loaded via a CSS `@import` from `fonts.googleapis.com`. Every user page load sends a request to Google's servers, which includes the user's IP address, browser user agent, and referrer.  
**Data Affected:** User IP address, browser fingerprint data transmitted to Google  
**Suggestion:** For maximum privacy, self-host the IBM Plex Sans font files. Alternatively, accept this as a known trade-off (it's a personal app and the user is the developer). Add to review-control known acceptables if accepted. The GDPR-relevant risk is near-zero for a personal single-user app, but it's a pattern to avoid if the app ever becomes multi-user.

---

### [MEDIUM] Food search queries routed through third-party CORS proxies

**Location:** `App.jsx:895–915` — `handleSearch`  
**Issue:** USDA food search queries are sent through `corsproxy.io` and `api.allorigins.win`. While search terms are food names (not directly identifying), patterns like "high-fat breakfast foods" or "NSNG meals" could reveal dietary preferences. The proxy operators receive: the query string, timestamps, the user's IP address.  
**Data Affected:** Food search terms, user IP  
**Suggestion:** Eliminate the CORS proxy by routing USDA calls through a Supabase Edge Function. This is the same fix as the security recommendation — one change addresses both concerns.

---

### [MEDIUM] No data deletion mechanism for users

**Location:** App-wide — no UI or function for data purge  
**Issue:** Users have no way to delete their health data from within the app. The sign-out button clears the session but all data remains in Supabase. There is no "delete my data" feature, no account deletion, and no data export.  
**Data Affected:** All stored health data in all 5 Supabase tables  
**Suggestion:** Add a "Delete all my data" option in Settings, with a confirmation step. This should delete all rows in `rows`, `fasts`, `food_logs`, `water`, and `settings` where `user_id` matches the current user. For a personal app this is lower urgency, but it's good practice and a near-requirement if the app ever becomes multi-user.

---

### [LOW] Google OAuth transmits user identity to Supabase at sign-in

**Location:** `App.jsx:115–122` — `signIn` function  
**Issue:** Google OAuth returns name, email, and avatar URL to Supabase, which stores them in the auth user record. This is expected and necessary. The app uses `user.user_metadata.avatar_url` to display the avatar (line 431). No additional OAuth scopes are requested beyond the default identity scope.  
**Data Affected:** Google account email, display name, profile photo URL  
**Suggestion:** No action needed. The minimal OAuth scope is correct practice. Note for future: if the app ever adds features that require broader Google access (e.g., Google Fit, Calendar), scope creep should be avoided.

---

### [LOW] User's Supabase UUID logged to console

**Location:** `App.jsx:129` — `console.log("[TheOar] loadAllData start, userId:", userId)`  
**Issue:** The user's Supabase UUID is logged to the browser console on every load. While a UUID alone is not directly identifying, it is the primary key for all user data in Supabase.  
**Data Affected:** Supabase user UUID  
**Suggestion:** Remove the userId from this log or replace with a truncated version for debugging: `userId.slice(0,8) + "..."`. Covered by the broader console log cleanup.

---

### [LOW] Avatar URL loaded from Google's CDN

**Location:** `App.jsx:431` — `<img src={user.user_metadata.avatar_url} />`  
**Issue:** The profile avatar is loaded directly from Google's image CDN using the URL provided by OAuth. This is a second outbound request to Google on each session load (the first being Google Fonts). No user content is sent in this request — it's just an image fetch.  
**Data Affected:** User IP, browser fingerprint  
**Suggestion:** Accept as known — it's a standard OAuth pattern. Alternatively, cache the avatar URL in Supabase Storage for full data sovereignty.

---

## Summary

**Overall Privacy Posture:** Acceptable for a personal single-owner app, with one meaningful gap: all health data is printed to the browser console on every load, which is the highest-priority fix. The Supabase storage and RLS setup is sound. Third-party data flows are limited to Supabase (primary), Google (OAuth + Fonts + Avatar), and the CORS proxies (food search only, no PII).

**Top Concerns:**
1. Health data in console logs — clear before treating as production app
2. No data deletion UI — low urgency now, important for future
3. CORS proxy exposure of food search terms and IP — fixable with Edge Function
