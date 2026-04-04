# Review Control

## App Identity
- **Name:** The Oar
- **Type:** Progressive Web App (PWA)
- **Version:** 1.1.3
- **Environment:** Production — GitHub Pages
- **Repo:** https://github.com/Highspeedhomer/the-oar
- **Live URL:** https://highspeedhomer.github.io/the-oar/

## Tech Stack
- React 19 + Vite 8
- Supabase (Postgres, Auth, RLS)
- Google OAuth via Supabase
- IBM Plex Sans (Google Fonts)
- gh-pages for deployment

## App Context
Personal fitness tracker handling: rowing meters, intermittent fasting, food/calorie logging, and water intake.
Single-owner personal app — data is stored per user_id in Supabase with RLS policies.
No payment processing. No public user accounts. No admin roles.

## Agents
Enable or disable individual review phases by changing true/false.

- intake: true
- quality: true
- security: true
- privacy: true
- performance: true
- synthesis: true

## Focus Areas
Tell the agents what to pay special attention to for this app.

- This app handles personal health data (fasting times, calories, body metrics) — treat with care
- Single large file architecture (src/App.jsx) — evaluate complexity and readability honestly
- PWA deployed to GitHub Pages — evaluate offline behavior, caching, and installability
- All inserts use client-generated `id: Date.now()` — flag any concurrency or collision risk
- USDA FoodData Central API integration — evaluate error handling and mobile behavior
- Auth relies on Supabase Google OAuth with session persistence — review the full auth flow

## Known Acceptable (Do Not Flag)
These are intentional decisions — agents should note them but not flag as issues.

- Supabase publishable key committed to source: this is a publishable key, not a secret
- `[TheOar]` prefixed console.log statements: intentional debug logging, will be cleaned up later
- No test suite: known gap, out of scope for this review cycle

## Severity Threshold
- **CRITICAL** — Must fix before deploy. Security vulnerability, data loss risk, or broken core flow.
- **HIGH** — Should fix soon. Significant bug risk, user-facing breakage, or meaningful security concern.
- **MEDIUM** — Plan to fix. Quality or performance improvement with real but non-urgent impact.
- **LOW** — Nice to have. Minor improvements, style, or future-proofing.
