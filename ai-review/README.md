# AI Review Pipeline

A multi-agent code review system designed to run before deployment. Produces structured findings across quality, security, privacy, and performance — each phase feeding context to the next.

## Quick Start

### Before you run
1. Make sure you're on the branch you intend to deploy
2. Open `ai-review/review-control.md` and confirm the app version, focus areas, and known acceptables are up to date
3. Confirm the build passes: `npm run build`

### Run the review
In your Claude Code session, type:

```
/project:review
```

The pipeline runs all 6 agents sequentially — expect it to take 5–10 minutes. Each phase writes its output before the next begins.

### When it's done
Claude will give you a verbal summary of any CRITICAL or HIGH findings immediately. For the full report, start here:

```
ai-review/outputs/YYYY-MM-DD/06-synthesis-report.md
```

Open the numbered source reports (01–05) only if you need the full detail behind a specific finding.

When you're satisfied, commit the output folder:

```
git add ai-review/outputs/YYYY-MM-DD/
git commit -m "Add review output YYYY-MM-DD"
```

## Structure

```
ai-review/
  review-control.md       # You own this — configure per project before running
  runbook.md              # When to run, pre-flight checklist, how to read results
  prompts/                # Agent instructions (generic — don't edit per project)
    01-intake-agent.md    # Reads codebase, builds context for all downstream agents
    02-quality-agent.md   # Bug risk, readability, efficiency, optimization
    03-security-agent.md  # Auth, input handling, data exposure, dependencies
    04-privacy-agent.md   # Personal data handling, transmission, logging, user control
    05-performance-agent.md # Bundle size, render performance, PWA behavior, mobile
    06-synthesis-agent.md # Consolidates all findings, prioritizes, recommends next steps
  outputs/
    YYYY-MM-DD/           # One folder per run, committed to repo as a record
```

## Pipeline Flow

```
review-control.md
      │
      ▼
01 Intake ──► 02 Quality ──► 03 Security ──► 04 Privacy ──► 05 Performance
                                                                    │
                                                                    ▼
                                                            06 Synthesis
                                                         (reads all prior)
```

Each agent reads the outputs of prior agents so findings build on each other rather than repeating work.

## Using on a New Project

The agent prompts are fully generic — they pull all app-specific context from `review-control.md` and the intake report. You should not need to edit any prompt files.

**Steps:**

1. Copy the `ai-review/` folder into the root of the new project
2. Copy `.claude/commands/review.md` into the new project at `.claude/commands/review.md` (create the folder if it doesn't exist)
3. Open `ai-review/review-control.md` and replace all fields with the new project's details:
   - App identity (name, version, type, URL)
   - Tech stack
   - App context (what it does, who uses it, what data it handles)
   - Enable/disable agents as needed
   - Focus areas specific to that app
   - Known acceptables (intentional decisions that shouldn't be flagged)
4. Delete any old output folders from `ai-review/outputs/` so they don't carry over
5. Run `/project:review`

That's it. The only file you edit between projects is `review-control.md`.

## Severity Levels

| Level | Meaning |
|---|---|
| CRITICAL | Must fix before deploy |
| HIGH | Should fix before deploy |
| MEDIUM | Plan to fix — real but non-urgent |
| LOW | Nice to have |
