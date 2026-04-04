# AI Review Pipeline

You are running the full AI review pipeline for this project. Execute all 6 phases in sequence. Each phase reads the output of prior phases — do not skip ahead or run phases in parallel.

## Setup

1. Get today's date in YYYY-MM-DD format
2. The output directory for this run is `ai-review/outputs/YYYY-MM-DD/` (substitute the actual date)
3. Read `ai-review/review-control.md` now — you will reference it throughout

---

## Phase 1 — Intake

Read `ai-review/prompts/01-intake-agent.md` for full instructions.

Execute those instructions completely. Write the output to:
`ai-review/outputs/YYYY-MM-DD/01-intake-report.md`

Do not proceed to Phase 2 until this file is written.

---

## Phase 2 — Quality

Read `ai-review/prompts/02-quality-agent.md` for full instructions.

Your inputs are:
- `ai-review/outputs/YYYY-MM-DD/01-intake-report.md`
- `ai-review/review-control.md`
- Source files as directed

Execute those instructions completely. Write the output to:
`ai-review/outputs/YYYY-MM-DD/02-quality-findings.md`

Do not proceed to Phase 3 until this file is written.

---

## Phase 3 — Security

Read `ai-review/prompts/03-security-agent.md` for full instructions.

Your inputs are:
- `ai-review/outputs/YYYY-MM-DD/01-intake-report.md`
- `ai-review/outputs/YYYY-MM-DD/02-quality-findings.md`
- `ai-review/review-control.md`
- Source files as directed

Execute those instructions completely. Write the output to:
`ai-review/outputs/YYYY-MM-DD/03-security-findings.md`

Do not proceed to Phase 4 until this file is written.

---

## Phase 4 — Privacy

Read `ai-review/prompts/04-privacy-agent.md` for full instructions.

Your inputs are:
- `ai-review/outputs/YYYY-MM-DD/01-intake-report.md`
- `ai-review/outputs/YYYY-MM-DD/03-security-findings.md`
- `ai-review/review-control.md`
- Source files as directed

Execute those instructions completely. Write the output to:
`ai-review/outputs/YYYY-MM-DD/04-privacy-findings.md`

Do not proceed to Phase 5 until this file is written.

---

## Phase 5 — Performance

Read `ai-review/prompts/05-performance-agent.md` for full instructions.

Your inputs are:
- `ai-review/outputs/YYYY-MM-DD/01-intake-report.md`
- `ai-review/outputs/YYYY-MM-DD/02-quality-findings.md`
- `ai-review/review-control.md`
- Source files as directed

Execute those instructions completely. Write the output to:
`ai-review/outputs/YYYY-MM-DD/05-performance-findings.md`

Do not proceed to Phase 6 until this file is written.

---

## Phase 6 — Synthesis

Read `ai-review/prompts/06-synthesis-agent.md` for full instructions.

Your inputs are ALL prior outputs:
- `ai-review/outputs/YYYY-MM-DD/01-intake-report.md`
- `ai-review/outputs/YYYY-MM-DD/02-quality-findings.md`
- `ai-review/outputs/YYYY-MM-DD/03-security-findings.md`
- `ai-review/outputs/YYYY-MM-DD/04-privacy-findings.md`
- `ai-review/outputs/YYYY-MM-DD/05-performance-findings.md`
- `ai-review/review-control.md`

Execute those instructions completely. Write the output to:
`ai-review/outputs/YYYY-MM-DD/06-synthesis-report.md`

---

## On Completion

When all 6 phases are complete:

1. Tell the user the review is complete and the output folder path
2. Give a 3–5 sentence verbal summary of the most important findings
3. List any CRITICAL or HIGH findings by name so the user can see them immediately without opening the report
4. Remind the user to commit the output folder: `git add ai-review/outputs/YYYY-MM-DD/`
