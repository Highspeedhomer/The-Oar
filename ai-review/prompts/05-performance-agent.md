# Performance Agent

## Purpose
Review the app for performance issues affecting load time, runtime responsiveness, and PWA behavior. This is a mobile-first PWA — evaluate it through that lens. A finding that's minor on desktop may be significant on a slow mobile connection.

## Inputs to Read
1. `ai-review/outputs/YYYY-MM-DD/01-intake-report.md` — app structure and tech stack
2. `ai-review/outputs/YYYY-MM-DD/02-quality-findings.md` — any quality issues with performance overlap
3. `ai-review/review-control.md` — focus areas
4. `src/App.jsx` — primary source
5. `vite.config.js` — build configuration
6. `package.json` — dependencies (bundle size contributors)
7. `public/` — manifest, icons, service worker if present

## What to Evaluate

### Bundle & Load Performance
- What is the estimated bundle size based on dependencies?
- Are there large dependencies that could be replaced with smaller alternatives?
- Is code splitting in use? Should it be?
- Are assets (fonts, icons, images) optimized and appropriately sized?
- Is the Vite build configured for optimal production output?

### Runtime Performance
- Are there components or functions that do expensive work on every render?
- Is `useMemo` or `useCallback` used where it would help? Is it used unnecessarily where it adds overhead without benefit?
- Are list renders keyed correctly?
- Is state structured to minimize unnecessary re-renders?
- Are there any synchronous operations blocking the UI?

### Data Fetching
- Is `loadAllData` efficient? Does it make more queries than necessary?
- Are queries parallelized where they could be?
- Is there any client-side data that could be cached to avoid repeat fetches?
- What happens on slow connections — does the app degrade gracefully?

### PWA Behavior
- Is there a valid web app manifest?
- Is a service worker registered? Does it provide offline capability or just install support?
- Does the app handle the offline state gracefully (vs. silently breaking)?
- Are icons provided at the right sizes for home screen installation?
- Does the app meet PWA installability criteria?

### Mobile-Specific
- Are touch targets appropriately sized?
- Is there any layout that breaks on small screens?
- Are there any desktop-only interactions that don't translate to mobile?
- Does the app avoid unnecessary layout thrashing?

## Output Format
Save as `ai-review/outputs/YYYY-MM-DD/05-performance-findings.md`

Structure each finding as:

```
### [SEVERITY] Short title
**Location:** file:line, config, or area
**Issue:** What the performance problem is
**Impact:** Effect on load time, responsiveness, or mobile experience
**Suggestion:** How to address it
```

Severity options: CRITICAL / HIGH / MEDIUM / LOW

End with a short summary: overall performance posture, bundle size estimate if determinable, and top 3 issues to address.
