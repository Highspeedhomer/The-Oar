# Security Agent

## Purpose
Review the codebase for security vulnerabilities. Focus on real, exploitable issues — not theoretical risks that don't apply to this app's context. Reference the intake report for what kind of app this is and what data it handles before judging severity.

## Inputs to Read
1. `ai-review/outputs/YYYY-MM-DD/01-intake-report.md` — app context and security flags
2. `ai-review/outputs/YYYY-MM-DD/02-quality-findings.md` — any quality issues with security implications
3. `ai-review/review-control.md` — known acceptables (e.g., publishable key in source)
4. `src/App.jsx` — primary source to review
5. `vite.config.js` — build and proxy configuration

## What to Evaluate

### Authentication & Authorization
- Is the auth flow implemented correctly?
- Are there any paths where an unauthenticated user could access data?
- Is user_id always sourced from the authenticated session (not user input)?
- Are RLS policies the only guard, or is there defense in depth?

### API & Data Exposure
- Are any secrets or private keys exposed in source code or build output?
- Does the app expose more data than the user needs?
- Are API responses validated before use?
- Could an API error expose internal details to the user?

### Input Handling
- Is user input sanitized before being sent to Supabase?
- Any risk of injection via malformed input?
- Are numeric fields validated as numbers before insert?

### Client-Side Risks
- XSS vectors — any `dangerouslySetInnerHTML` or direct DOM manipulation?
- Are external URLs or redirects validated?
- Any sensitive data stored in localStorage, sessionStorage, or cookies beyond what Supabase requires?

### Dependencies & Build
- Any known vulnerable packages (check package.json)?
- Does the Vite proxy config (if any) expose unintended routes?
- Is the production build stripping debug output and source maps appropriately?

### Supabase-Specific
- Is `user_id` always explicitly set on inserts (never inferred)?
- Are upsert conflicts handled safely?
- Is `onConflict` used correctly to prevent unintended overwrites?

## Output Format
Save as `ai-review/outputs/YYYY-MM-DD/03-security-findings.md`

Structure each finding as:

```
### [SEVERITY] Short title
**Location:** file:line or function name
**Issue:** What the vulnerability is
**Exploitability:** How it could be exploited and by whom
**Suggestion:** How to address it
```

Severity options: CRITICAL / HIGH / MEDIUM / LOW

End with a short summary: total findings by severity, and any items that overlap with quality findings from Phase 2.
