# Loop-Kickoff-Prompt — Kassieren/Zuzahlung/Rechnungen

Diesen Text im Claude Code Terminal (im Projektordner) einfach einfügen und senden.
Er ist bewusst auf Englisch geschrieben (Claude arbeitet damit zuverlässiger),
das Ergebnis (UI-Texte, Zusammenfassungen) kommt trotzdem auf Deutsch raus —
das steht explizit im Prompt drin.

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
approach the checklist overall and specifically what you will do for the first eligible
task — which files you'll touch, what the change is, and how you'll verify it. Do not
edit any files or run any commands yet.

Wait for me to approve the plan. Once I approve it, switch out of Plan Mode into
Auto-Accept Edits mode and then execute the full loop below without stopping after each
individual task.

## Objective

Work through the checklist in `Podoloji/loop-tasks-kassieren.md` from top to bottom,
fully autonomously, until every task is either done or genuinely blocked. Do not stop
after each item to ask "should I continue?" — keep going on your own. Only interrupt
me for a real blocker (see "When to stop" below).

## Per-task process

For each unchecked `[ ]` item that has no unresolved "Zuerst:" dependency:

1. Read the referenced files and enough surrounding code to understand the current
   behavior before changing anything.
2. Plan the smallest correct change that satisfies the task. Prefer editing existing
   templates/routes (this codebase already has zuzahlungsrechnung.template.js,
   ausfallrechnung.template.js, mahnung.template.js, mahnwesen.routes.js etc. — check
   whether the task is really "build from scratch" or "finish/fix what's there").
3. Implement the change.
4. Verify before marking anything done:
   - If a relevant test file exists (e.g. ausfallrechnung.test.js, templates.test.js),
     run it.
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
6. Commit the change with git, one commit per completed task, message in German,
   short and specific (e.g. "Kassieren: Zahlart-Auswahl und Druck-Schritt ergänzt").
   IMPORTANT: never run `git push` yourself, and never delegate git push to a
   background process or a sub-agent — per CLAUDE.md this silently hangs on this
   machine (Windows Credential Manager issue). Only `git add` and `git commit`.
   Leave the push for me to run manually in the foreground.
7. Move to the next eligible task automatically.

## Task tracking

In addition to updating the markdown checklist, use your own internal todo list
(TodoWrite / task tool) mirroring the same items, so I can see live progress in the
terminal while you work.

## Regulatory caution

Tasks 2, 3, 8, 9, 10 touch Zuzahlung / GKV billing / §302 SGB V rules. There is no
legal-de or gkv-302 specialist agent set up yet in this project, so you are the only
check here. If you are not certain a calculation or rule is legally/factually correct,
do not guess — flag it clearly instead of implementing a guess.

## When to stop and ask me (in German, plain and simple)

- The task is a human task, not a coding task (example: task 7, "get the Ausfallrechnung
  template from Stefan") — skip it, tell me clearly what you need from me.
- A requirement is genuinely ambiguous and getting it wrong would cost real rework.
- Implementing the task would break a hard CLAUDE.md rule (e.g. would require a 13th
  Vercel function, or a new n8n workflow) — stop, explain the conflict, suggest an
  alternative that fits the constraints.
- A task depends on an earlier one that is still open — skip it for now, don't guess
  ahead.

## Output language

All summaries, status updates, and anything a user would eventually see (UI labels,
toasts, dashboard text, commit messages) must be in German — this is a German product
for German praxis owners. Keep your explanations to me simple and clear, not overly
technical (I'm still learning software engineering).

## When the whole list is done (or only blocked/human items remain)

Give me one clear final summary in German: what was implemented, which files changed
per task, what's still open and exactly why, and what you need from me to unblock the
rest.
```

---

**Tipp:** Für die nächste Liste (Termin/Kalender) kannst du diesen Prompt kopieren und
nur den Dateinamen `Podoloji/loop-tasks-kassieren.md` durch die neue Liste ersetzen —
der Rest bleibt gleich.
