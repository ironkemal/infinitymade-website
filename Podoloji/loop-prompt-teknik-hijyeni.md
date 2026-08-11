# Loop-Kickoff-Prompt — Technische Schulden & Site-Hygiene

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
and primary language), and the instruction to reuse existing shared modules instead of
rebuilding them.

## Working mode: plan first, then switch to auto

Start this session in Plan Mode. Read CLAUDE.md and the full checklist in
`Podoloji/loop-tasks-teknik-hijyeni.md`, then write out a clear plan for each of the 7
items — two of them (1 and 3) are investigation tasks without a guaranteed fix, the
checklist file explains what's already been ruled out for each so you don't repeat that
research. Do not edit any files or run any commands yet.

Wait for me to approve the plan. Once I approve it, switch out of Plan Mode into
Auto-Accept Edits mode and then execute the full loop below without stopping after each
individual task.

## Objective

Work through the checklist in `Podoloji/loop-tasks-teknik-hijyeni.md` top to bottom,
fully autonomously, until every task is either done, honestly marked as "trap set,
waiting for a recurrence" (task 1), or genuinely blocked. Do not stop after each item to
ask "should I continue?" — keep going on your own. Only interrupt me for a real blocker.

## Per-task process

For each unchecked `[ ]` item:

1. Read the referenced files/areas and enough surrounding code to understand the current
   behavior before changing anything. For tasks 1 and 3, read the "already ruled out"
   notes in the checklist first so you don't redo research that's already done.
2. Plan the smallest correct change that satisfies the task.
3. Implement the change.
4. Verify before marking anything done:
   - If a relevant test exists, run it.
   - If you have the `engineering:code-review` skill available, use it on your own diff.
     If `engineering:debug` is available and relevant (especially for tasks 1, 3, 4),
     use it too.
   - For task 4 (UTF-8), actually check file encoding and response headers, don't just
     assume the `<meta charset>` tag is sufficient.
   - For task 6 (404 page), match the existing visual style from index.html (fonts,
     colors, dark-theme CSS variables) — don't hardcode colors.
5. Update the checklist file: set the box to `[x]` and add one short line underneath
   listing exactly which files changed. For task 1, mark it done as "trap set" and be
   explicit that the root cause is still unknown — don't claim it's fixed.
6. Commit the change with git, one commit per completed task, message in German, short
   and specific. IMPORTANT: never run `git push` yourself, and never delegate git push
   to a background process or a sub-agent — per CLAUDE.md this silently hangs on this
   machine (Windows Credential Manager issue). Only `git add` and `git commit`. Leave
   the push for me to run manually in the foreground.
7. Move to the next task automatically.

## When to stop and ask me (in German, plain and simple)

- Task 2 (dead WhatsApp/Twilio card): if after a thorough search you genuinely can't
  find a live settings card to remove (only backend leftovers with no UI), say so
  clearly rather than removing something unrelated just to have done something.
- Task 3 (Google Kalender label): if after checking the OAuth routes you still can't
  identify where the reported mislabeling actually is, don't guess — flag it and ask me
  for a screenshot or more detail from the meeting instead of changing a label that
  might be correct.
- Implementing a task would break a hard CLAUDE.md rule — stop, explain, suggest an
  alternative.
- Anything genuinely ambiguous where a wrong guess costs real rework.

## Output language

All summaries, status updates, and anything a user would eventually see (UI text,
commit messages) must be in German. Keep your explanations to me simple and clear, not
overly technical (I'm still learning software engineering).

## Save progress when you're done — required, not optional

Once the checklist is fully worked through (done, trap-set, or genuinely blocked items
only remain), follow the project's own convention in `fortschritte/REGELN.md`:

1. Determine today's date.
2. Check whether `fortschritte/<today>.md` already exists. If it does, **append** to it
   — do not overwrite it, do not create a second file for the same day. If it doesn't
   exist yet, create it using the template in `fortschritte/REGELN.md`.
3. Write the entry covering: what was worked on (this checklist, one/two sentences of
   context), what was done (per task: what, why, which files), what's still open or
   blocked and why (be honest — task 1 not having a root cause yet belongs here, not
   hidden), and a short commit list.
4. Follow the rule explicitly: don't write "tested" for anything you only read the code
   for — mark it as unverified if it wasn't actually run/clicked through.

This step is part of finishing the loop, not a separate ask — do it automatically at
the end without waiting for me to request it.

## When the whole list is done

Give me one clear final summary in German in the chat too (in addition to the
fortschritte file): what was implemented, what's still open and why, and what you need
from me to unblock the rest.
```
