# Loop-Kickoff-Prompt — Kassieren/Zuzahlung/Rechnungen (Fortsetzung)

Diesen Text im Claude Code Terminal (im Projektordner) einfach einfügen und senden.
Aktualisierte Version: Aufgabe 2 (Preise) ist freigegeben, Aufgabe 7 (Ausfallrechnung)
wird jetzt selbst entworfen statt auf Stefan zu warten, und es gibt eine neue Regel für
externe Quellen (Preis-PDF), damit die nicht unbemerkt veraltet.

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

## Working mode: plan first, then switch to auto

Start this session in Plan Mode. Read CLAUDE.md and the full checklist in
`Podoloji/loop-tasks-kassieren.md`, then write out a clear plan covering how you will
approach the remaining checklist items — task 2 (price centralization) is now unblocked,
task 7 (Ausfallrechnung) is now a self-design task instead of a human task, tasks 8 and 9
follow from there. Do not edit any files or run any commands yet.

Wait for me to approve the plan. Once I approve it, switch out of Plan Mode into
Auto-Accept Edits mode and then execute the full loop below without stopping after each
individual task.

## Objective

Work through the checklist in `Podoloji/loop-tasks-kassieren.md` from top to bottom,
fully autonomously, until every remaining task is either done or genuinely blocked. Do
not stop after each item to ask "should I continue?" — keep going on your own. Only
interrupt me for a real blocker (see "When to stop" below).

## External references must stay fresh — check before you trust them

Some reference files in this repo were built by copying content from an external URL at
a point in time (example: `api-backend/billing/GKV-PODOLOGIE-PREISE-2025-2026.md`, built
10.08.2026 from two GKV-Spitzenverband pages/PDFs, URLs listed at the top of that file).
Before you rely on such a file for a task:

1. Re-fetch the URL(s) listed at the top of the reference file.
2. Compare against what's stored. If the source changed (new price version, new
   Änderungsvereinbarung, updated content), update the markdown table in the reference
   file, update the "abgerufen am" date, and clearly flag in your task summary that the
   source had changed and what changed.
3. If it's unchanged, proceed normally — no need to ask me, just note that you verified it.
4. Going forward, any time you create a new reference file sourced from an external URL,
   store the URL(s) and the fetch date at the top of that file in the same format, so this
   check remains possible later.

This matters most for task 2 (GKV price table) — verify the source is still current
before building the centralized price table from it.

## Per-task process

For each unchecked `[ ]` item that has no unresolved "Zuerst:" dependency:

1. Read the referenced files and enough surrounding code to understand the current
   behavior before changing anything.
2. Plan the smallest correct change that satisfies the task. Prefer editing existing
   templates/routes over rebuilding from scratch.
3. Implement the change.
4. Verify before marking anything done:
   - If a relevant test file exists (e.g. ausfallrechnung.test.js, templates.test.js,
     calculator.test.js), run it.
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

## Task 7 specifically — designing the Ausfallrechnung yourself

There is no example from the practice partner (Stefan) available yet, and I've decided
not to wait for it. Design a correct Ausfallrechnung (no-show/cancellation fee invoice)
yourself, following standard German practice for Heilmittel praxes:

- This is a **private invoice to the patient**, not billed to the GKV — a missed
  appointment is never a GKV-billable service.
- It must only be issued when the practice's cancellation policy (notice period,
  typically 24–48h) was actually violated — check whether such a policy/field already
  exists anywhere in the codebase (booking terms, AGB text) and reuse it; if not, flag
  that as a gap rather than inventing a specific hour count on your own.
- The fee is commonly either a flat fee or based on the value of the missed slot —
  check how `ausfallrechnung.template.js` currently computes/expects the amount.
  Podologie/Physio/etc. treatment services are typically VAT-exempt under §4 Nr. 14
  UStG — do not add VAT unless the existing invoice templates in this codebase do.
- Required invoice basics: invoice number, date, practice name/address, patient
  name/address, description of the missed appointment (date/time/service), amount,
  payment terms/deadline, and — since this is not a GKV document — no HPNR/Kostenträger
  fields need to appear on it.
- There is no legal-de or gkv-302 specialist agent set up in this project yet, and this
  is billing-adjacent even though it's not GKV billing. If anything here feels like a
  real legal judgment call (e.g. whether a specific notice-period wording is compliant),
  don't guess — flag it clearly instead of deciding it yourself.
- Once built, this becomes the baseline for task 8. If a real example from Stefan shows
  up later, it gets compared against this draft, not built from scratch again.

## Task tracking

In addition to updating the markdown checklist, use your own internal todo list
(TodoWrite / task tool) mirroring the same items, so I can see live progress in the
terminal while you work.

## Regulatory caution

Task 2 and task 9 touch Zuzahlung / GKV billing / §302 SGB V rules directly. There is no
legal-de or gkv-302 specialist agent set up yet in this project, so you are the only
check here. If you are not certain a calculation or rule is legally/factually correct,
do not guess — flag it clearly instead of implementing a guess.

## When to stop and ask me (in German, plain and simple)

- A requirement is genuinely ambiguous and getting it wrong would cost real rework.
- Implementing the task would break a hard CLAUDE.md rule (e.g. would require a 13th
  Vercel function, or a new n8n workflow) — stop, explain the conflict, suggest an
  alternative that fits the constraints.
- A task depends on an earlier one that is still open ("Zuerst: X") — skip it for now,
  don't guess ahead.
- An external reference source (see section above) turns out to have changed since it
  was stored — update the file, but flag the change to me clearly rather than silently
  building on top of it.

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
