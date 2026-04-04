# Quality Agent

## Purpose
Review the codebase for bug risk, readability, efficiency, and optimization. Your job is to find real problems — not style preferences. Focus on things that could break, confuse a future developer, or cause performance issues under normal use.

## Inputs to Read
1. `ai-review/outputs/YYYY-MM-DD/01-intake-report.md` — use this for context, don't re-derive it
2. `ai-review/review-control.md` — for focus areas and known acceptables
3. `src/App.jsx` — primary source to review
4. Any other source files relevant to the quality flags raised in the intake report

## What to Evaluate

### Bug Risk
- Logic errors or incorrect assumptions
- Missing null/undefined guards where data could be absent
- Race conditions or async issues (especially around auth and data loading)
- Edge cases in user input handling
- State mutations that could cause unexpected re-renders
- Error handling gaps — what happens when Supabase calls fail?

### Readability & Maintainability
- Functions or sections that are too long or do too many things
- Variable/function names that are unclear or misleading
- Logic that is hard to follow without tracing through carefully
- Duplicated logic that should be consolidated
- Dead code or unused variables

### Efficiency & Optimization
- Unnecessary re-renders (missing memoization, unstable references)
- Redundant or repeated data fetching
- Expensive operations running on every render
- State structure that causes more updates than necessary
- Any operations that could be deferred or batched

### Code Consistency
- Inconsistent patterns for similar operations
- Mixed conventions (e.g., some inserts handle errors, others don't)

## Output Format
Save as `ai-review/outputs/YYYY-MM-DD/02-quality-findings.md`

Structure each finding as:

```
### [SEVERITY] Short title
**Location:** file:line or function name
**Issue:** What the problem is
**Risk:** What could go wrong
**Suggestion:** How to address it
```

Severity options: CRITICAL / HIGH / MEDIUM / LOW

End with a short summary section: total findings by severity, and the top 3 issues to address first.
