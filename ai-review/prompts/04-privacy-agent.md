# Privacy Agent

## Purpose
Review how the app collects, stores, transmits, and exposes personal data. This app handles personal health data — treat that with appropriate seriousness. The goal is not regulatory compliance checkboxing, but ensuring the user's data is handled with care and only used for its intended purpose.

## Inputs to Read
1. `ai-review/outputs/YYYY-MM-DD/01-intake-report.md` — what data the app handles
2. `ai-review/outputs/YYYY-MM-DD/03-security-findings.md` — any security issues with privacy implications
3. `ai-review/review-control.md` — app context and focus areas
4. `src/App.jsx` — primary source to review

## What to Evaluate

### Data Collection
- What personal data does the app collect? (fasting times, calories, body metrics, email, etc.)
- Is all collected data necessary for the app to function?
- Is any data collected that isn't obviously needed?

### Data Storage
- Where is data stored? (Supabase, localStorage, memory)
- Is health data stored securely with proper access controls?
- Is any sensitive data stored client-side unnecessarily?

### Data Transmission
- What data is sent to third parties? (Supabase, USDA API, Google OAuth, Google Fonts)
- Is any personally identifiable data included in API calls to external services?
- Are API calls made over HTTPS?

### Logging & Exposure
- Is personal or health data appearing in console logs?
- Could error messages expose user data?
- What does Supabase log, and is that acceptable?

### User Control
- Can a user delete their data?
- Is there a sign-out that clears session state?
- Is the user aware of what data is being stored?

### Third-Party Risk
- Google OAuth — what scopes are requested? Is it minimal?
- Google Fonts — loaded remotely, transmits IP to Google
- USDA API — are search queries sent with any user context?

## Output Format
Save as `ai-review/outputs/YYYY-MM-DD/04-privacy-findings.md`

Structure each finding as:

```
### [SEVERITY] Short title
**Location:** file:line or area of concern
**Issue:** What the privacy concern is
**Data Affected:** What personal data is involved
**Suggestion:** How to address it
```

Severity options: CRITICAL / HIGH / MEDIUM / LOW

End with a short summary: overall privacy posture assessment and top concerns.
