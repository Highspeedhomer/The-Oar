# Security Findings — The Oar
**Date:** 2026-04-04  
**Version:** 1.1.3  
**Pipeline Phase:** 3 of 6

---

## Context

This is a single-owner personal health app with no public registration, no payment processing, and no admin roles. The primary attack surface is: the authenticated user's own data (protected by Supabase RLS), the USDA API integration (public API, no user data), and the OAuth flow. Many findings that would be HIGH in a multi-user SaaS are lower here because there is no meaningful attacker profile beyond a curious browser user.

---

## Findings

---

### [HIGH] USDA API key exposed in client bundle

**Location:** `App.jsx:18` — `const USDA_API_KEY = "Q5xkAB5PaG0SF5MfY815LWi3V3iYuvyKUDiURCxF"`  
**Issue:** The USDA FoodData Central API key is hardcoded in the source file and will be included verbatim in the production JavaScript bundle, which is publicly downloadable via GitHub Pages.  
**Exploitability:** Anyone can view the deployed JS bundle (or the GitHub repo, which is public) and extract this API key. The USDA FoodData Central API offers a free tier with rate limits (~1000 requests/hour/key per their docs). A malicious actor could use this key to exhaust the rate limit, causing food search to fail for the app owner. Since this is a free government API with a publicly accessible key tier, the practical impact is limited — but the rate limit exhaustion risk is real.  
**Suggestion:** Move the API key to a Supabase Edge Function or proxy endpoint. The USDA call should be server-side: app calls `/api/usda-search?q=chicken`, the edge function adds the API key and calls USDA, returns results. This also eliminates the CORS proxy dependency. Alternatively, register a new key and accept the exposure as a low-impact risk (document it in review-control known acceptables).

---

### [MEDIUM] CORS proxy introduces a trusted third-party in the food search path

**Location:** `App.jsx:895–915` — `handleSearch`  
**Issue:** When the USDA API returns CORS errors on mobile (which it does), the app falls back to two third-party CORS proxies: `corsproxy.io` and `api.allorigins.win`. All USDA API requests (including the API key) are routed through these external services.  
**Exploitability:** The proxy operators can see: (a) the USDA API key, and (b) all food search queries. No directly identifiable health data is in these requests (just food names like "chicken breast"), but search patterns over time could reveal dietary habits. Neither proxy is operated by a trusted party and there is no SLA or privacy commitment. Either proxy could log, sell, or modify responses.  
**Suggestion:** Eliminate the CORS proxy dependency by proxying USDA calls through a Supabase Edge Function. This is the correct long-term fix for both this issue and the API key exposure above.

---

### [MEDIUM] No production source map configuration — bundle exposes full source

**Location:** `vite.config.js`  
**Issue:** The Vite config has no explicit `build.sourcemap` setting, which defaults to `false` for production builds — this is correct. However, the bundle is deployed to a public GitHub Pages URL, and since the repo is public, the full source is anyway readable. The lack of minification configuration is not verified.  
**Exploitability:** Low for this app since the source is already public on GitHub. But the compiled bundle includes all hardcoded values (Supabase URL, API key) in cleartext.  
**Suggestion:** No action needed for the source map concern specifically given the public repo. The hardcoded credential concern is covered by the API key finding above.

---

### [MEDIUM] `loadAllData` error path sets auth state to "ready" on any exception

**Location:** `App.jsx:216–219`  
**Issue:** If `loadAllData` throws (e.g., network error, RLS rejection), the catch block silently sets auth state to ready. This means a user whose session is technically valid but whose DB queries are all failing will see an empty app that appears fully loaded.  
**Exploitability:** Not a direct security vulnerability — Supabase RLS still enforces authorization. But an attacker who can induce DB errors (e.g., by revoking RLS policies) would cause data to silently disappear rather than surfacing a clear auth error. More practically: if a user's session token is stale and all queries 403, they see an empty app with no re-auth prompt.  
**Suggestion:** Detect auth errors specifically (HTTP 401/403 from Supabase) and trigger re-auth. This overlaps with the quality finding in Phase 2.

---

### [LOW] `user_id` sourced from React state, not re-validated on each operation

**Location:** `App.jsx:236–395` — all action functions use `user.id`  
**Issue:** Action functions (`addWater`, `addRow`, `startFast`, etc.) read `user.id` from React state (`const [user, setUser] = useState(null)`). If `user` state becomes stale (session expires but state hasn't cleared), an operation could be attempted with a stale user ID.  
**Exploitability:** Supabase RLS enforces the actual authenticated user's ID — so even with a stale `user` state, Supabase will reject operations that don't match the current auth context. The worst case is a failed insert, not a data leak. Low exploitability.  
**Suggestion:** For operations that mutate data, consider reading `user.id` fresh from `supabase.auth.getUser()` rather than from stale React state. Or rely on Supabase RLS as the authority (acceptable given the personal app context).

---

### [LOW] OAuth `redirectTo` hardcodes `/the-oar/` path suffix

**Location:** `App.jsx:120` — `window.location.origin + "/the-oar/"`  
**Issue:** The redirect URL is constructed by concatenating `window.location.origin` (which is safe — it's the current domain) with the hardcoded path. Since the app only runs on `highspeedhomer.github.io`, this is fine in practice.  
**Exploitability:** No exploitability — `window.location.origin` cannot be manipulated by an attacker in a standard browser context. Supabase also validates the redirect URL against the allowlist configured in the Supabase dashboard.  
**Suggestion:** No action needed. Note: ensure the Supabase OAuth redirect URL allowlist is kept tight (only `https://highspeedhomer.github.io/the-oar/` and optionally localhost).

---

### [LOW] No XSS vectors found — React rendering is safe

**Location:** Entire `App.jsx`  
**Issue:** Review found no use of `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or other XSS-prone patterns. All user input (food names, notes, meters) is rendered as React text content, which is auto-escaped.  
**Exploitability:** None identified.  
**Suggestion:** Maintain this — never introduce `dangerouslySetInnerHTML`.

---

### [LOW] Console logs contain user UUID and all health data on load

**Location:** `App.jsx:129, 136–158` — `loadAllData` console statements  
**Issue:** The app logs `userId`, all row data, all fast data, all food logs, and all water logs to the browser console on every load. Per review-control, `[TheOar]` prefixed console logs are intentional for debugging.  
**Exploitability:** Browser console contents are not accessible to external attackers (no XSS vectors exist). However, they could be visible to someone with physical access to an unlocked device with DevTools open. More relevantly, if any browser extension monitors console output (some analytics/monitoring tools do), this data could be inadvertently captured.  
**Suggestion:** Remove or gate the data-content logs behind a `DEBUG` flag before treating this as production-ready. Keeping structural logs (`[TheOar] loadAllData start`) is fine; logging full query results is unnecessary after debugging is complete.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 4 |
| **Total** | **8** |

### Overlaps with Quality Findings (Phase 2)
- **`loadAllData` silent error handling** — flagged as HIGH in quality (silent failures) and MEDIUM here (auth error detection). Same root issue; fix once.
- **Console logging of health data** — flagged LOW here; overlaps with Privacy Phase 4.
