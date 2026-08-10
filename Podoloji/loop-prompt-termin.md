# Loop-Kickoff-Prompt — Termin und Kalender

Diesen Text im Claude Code Terminal (im Projektordner) einfügen und senden.

---

```
You are acting as the "builder" agent for the Praxura codebase (a practice-management
system for German Heilmittel praxes — Physio/Ergo/Logopädie/Podologie). Before doing
anything, read CLAUDE.md in the project root and follow it as a hard constraint, not a
suggestion — especially the Vercel 12/12 serverless function limit, rule G8 (no new
cloud dependency: no new Vercel function, no new n8n workflow, no new cloud-only
Supabase feature), the dark-theme CSS variable rule (never hardcode colors like #fff),
the three-language i18n dictionary in dashboard.js (de/en/tr — German is the default
and primary language), the multi-tenant rules (owner_id / RLS, .maybeSingle() instead
of .single() for optional lookups), and the instruction to reuse existing shared modules
(katalog-suche.js, patient-suche.js, calendar-widget.js) instead of rebuilding them.

## Already solved — do not reopen

CLAUDE.md lists issues that are already fixed and must not be "fixed" again: the OAuth
race condition (newOAuthClient() factory), double-booking (the no_overlapping_bookings
EXCLUDE GIST constraint in the database), timezone handling (Intl.DateTimeFormat +
berlinOffsetMin(), DST-safe), the service-role env fallback, and rate limiting on public
routes. This checklist touches booking and scheduling code directly, so be careful not
to weaken or duplicate any of these — read the relevant existing code first.

## Working mode: plan first, then switch to auto

Start this session in Plan Mode. Read CLAUDE.md and the full checklist in
`Podoloji/loop-tasks-termin.md`, then write out a clear plan covering how you will
approach the checklist overall and specifically what you will do for the first eligible
task — which files you'll touch, what the change is, and how you'll verify it. Do not
edit any files or run any commands yet.

Wait for me to approve the plan. Once I approve it, switch out of Plan Mode into
Auto-Accept Edits mode and then execute the full loop below without stopping after each
individual task.

## Objective

Work through the checklist in `Podoloji/loop-tasks-termin.md` from top to bottom, fully
autonomously, until every task is either done or genuinely blocked. Do not stop after
each item to ask "should I continue?" — keep going on your own. Only interrupt me for a
real blocker (see "When to stop" below).

## Per-task process

For each unchecked `[ ]` item that has no unresolved "Zuerst:" dependency:

1. Read the referenced files and enough surrounding code to understand the current
   behavior before changing anything. Several tasks note that backend or i18n pieces may
   already exist — verify what's really missing before building from scratch.
2. Plan the smallest correct change that satisfies the task.
3. Implement the change.
4. Verify before marking anything done:
   - Run any relevant existing tests.
   - For anything touching booking/slot logic, explicitly check it against the
     no_overlapping_bookings constraint and existing overlap-detection logic
     (see the "Already solved" section above) — do not introduce a path that can create
     a double booking.
   - If no test exists but the change is non-trivial, write a small one or at minimum
     manually trace through the logic and state clearly what you checked.
   - If you have the `engineering:code-review` skill available, use it on your own diff
     before considering the task complete. If `engineering:testing-strategy` or
     `engineering:debug` skills are available and relevant, use them too.
   - For anything touching visible UI text, spacing, or the dark theme, and if the
     `design:ux-copy` or `design:accessibility-review` skills are available, use them
     to sanity-check copy and contrast.
5. Update the checklist file: set the box to `[x]` and add one short line underneath
   listing exactly which files changed.
6. Commit the change with git, one commit per completed task, message in German, short
   and specific. IMPORTANT: never run `git push` yourself, and never delegate git push
   to a background process or a sub-agent — per CLAUDE.md this silently hangs on this
   machine (Windows Credential Manager issue). Only `git add` and `git commit`. Leave
   the push for me to run manually in the foreground.
7. Move to the next eligible task automatically.

## Task tracking

In addition to updating the markdown checklist, use your own internal todo list
(TodoWrite / task tool) mirroring the same items, so I can see live progress in the
terminal while you work.

## When to stop and ask me (in German, plain and simple)

- A requirement is genuinely ambiguous and getting it wrong would cost real rework
  (e.g. exactly how "Gegenangebot" should look/behave — task 4 has no existing code to
  anchor on, so confirm the intended UX before building a lot of it).
- Implementing the task would break a hard CLAUDE.md rule (e.g. would require a 13th
  Vercel function, a new n8n workflow, or would touch/weaken one of the "already solved"
  fixes above) — stop, explain the conflict, suggest an alternative that fits the
  constraints.
- Task 10 (per-location working hours) looks like it needs a real schema change — before
  writing a migration, stop and confirm the approach with me, this is bigger than the
  others.
- A task depends on an earlier one that is still open ("Zuerst: X") — skip it for now,
  don't guess ahead.

## Output language

All summaries, status updates, and anything a user would eventually see (UI labels,
toasts, dashboard text, commit messages) must be in German — this is a German product
for German praxis owners. Keep your explanations to me simple and clear, not overly
technical (I'm still learning software engineering).

## When the whole list is done (or only blocked items remain)

Give me one clear final summary in German: what was implemented, which files changed
per task, what's still open and exactly why, and what you need from me to unblock the
rest.
```
