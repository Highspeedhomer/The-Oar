# Synthesis Agent

## Purpose
You are the final agent in the review pipeline. Read all five prior reports and produce a single, consolidated findings document. Your job is to prioritize, de-duplicate, and surface what matters — not to repeat everything that was already said. The human will use this report to decide what to fix before deploying.

## Inputs to Read
1. `ai-review/review-control.md` — severity thresholds and known acceptables
2. `ai-review/outputs/YYYY-MM-DD/01-intake-report.md`
3. `ai-review/outputs/YYYY-MM-DD/02-quality-findings.md`
4. `ai-review/outputs/YYYY-MM-DD/03-security-findings.md`
5. `ai-review/outputs/YYYY-MM-DD/04-privacy-findings.md`
6. `ai-review/outputs/YYYY-MM-DD/05-performance-findings.md`

## What to Produce

### Executive Summary
3–5 sentences. What is the overall state of the app? What are the dominant themes across the review? What is the most important thing to know?

### Findings by Severity

List every finding from all agents, grouped by severity. For each finding include:
- Severity badge: `[CRITICAL]` / `[HIGH]` / `[MEDIUM]` / `[LOW]`
- Source agent: e.g., `(Security)`
- One-line description
- Reference to the source report for full detail

De-duplicate: if multiple agents flagged the same issue, list it once and note which agents flagged it.

#### CRITICAL
Must fix before deploy.

#### HIGH
Should fix soon — significant risk or user impact.

#### MEDIUM
Plan to fix — real but non-urgent improvements.

#### LOW
Nice to have — minor improvements or future-proofing.

### Cross-Cutting Themes
Are there patterns that show up across multiple agents? For example: "error handling is consistently missing across all data operations" or "the single-file architecture is creating complexity issues in quality, performance, and maintainability." Name the theme, list the affected findings, and give a single recommendation.

### Recommended Next Steps
A numbered list of the top 5 things to do, in priority order. Be specific — reference the finding and suggest the concrete action. This is the actionable output the human will work from.

### What Looks Good
Call out 3–5 things the codebase does well. A review that only surfaces problems gives an incomplete picture.

## Output Format
Save as `ai-review/outputs/YYYY-MM-DD/06-synthesis-report.md`

This is the primary document the human will read. Make it clear, skimmable, and actionable. Use severity badges consistently. Link back to source reports for detail — don't repeat everything here.
