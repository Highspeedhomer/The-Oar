# Runbook — AI Review Pipeline

## When to Run
Run this review before any significant deployment. It takes 5–10 minutes end to end and produces a full findings report in `ai-review/outputs/YYYY-MM-DD/`.

Suggested trigger points:
- Before a production deploy after a feature branch merge
- Before releasing to a new platform (e.g., App Store via Capacitor)
- After significant changes to auth, data handling, or external integrations
- Periodically (monthly) to catch drift even without major changes

---

## Pre-Run Checklist
Complete these before starting the pipeline:

- [ ] You are on the `main` branch (or the branch you intend to deploy)
- [ ] The branch is up to date with remote (`git pull`)
- [ ] The build passes (`npm run build` completes without errors)
- [ ] `ai-review/review-control.md` reflects the current app version and any new focus areas
- [ ] You have a few minutes to review the synthesis report before deploying

---

## How to Run
In your Claude Code session, type:

```
/project:review
```

The pipeline will run all 6 agents sequentially and write outputs to `ai-review/outputs/YYYY-MM-DD/`. When complete, Claude will summarize what was found and tell you the output folder path.

---

## How to Read the Results

Start with `06-synthesis-report.md` — this is the consolidated view.

- **CRITICAL findings** — stop and fix before deploying
- **HIGH findings** — fix before deploying if possible; if not, log as known debt
- **MEDIUM findings** — schedule for the next sprint or iteration
- **LOW findings** — address when convenient or batch with related work

The source reports (01–05) contain full detail for each finding. Use them when you need to understand the full context of something flagged in the synthesis report.

---

## After the Review
1. Commit the output folder to the repo: `git add ai-review/outputs/YYYY-MM-DD/`
2. Address CRITICAL and HIGH findings
3. Deploy when ready: `npm run build && npm run deploy`
4. Optionally note resolved findings in the synthesis report before committing

---

## Adapting for a New Project
To use this pipeline on a different project:

1. Copy the entire `ai-review/` folder into the new project
2. Update `review-control.md` with the new app's identity, stack, context, and known acceptables
3. Copy `.claude/commands/review.md` into the new project's `.claude/commands/` folder
4. Run `/project:review`

The agent prompts are generic — they pull all app-specific context from `review-control.md` and the intake report. No prompt editing should be required for most projects.
