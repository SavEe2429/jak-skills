---
description: Map an existing folder or feature — code and tests — onto one HTML page with diagrams and a verify list
argument-hint: <folder|feature> [focus-symbol]
---

Run the `for-review` skill on `$ARGUMENTS` by following
[`skills/for-review/SKILL.md`](../skills/for-review/SKILL.md) exactly. That file is
the source of truth — do not summarise or shortcut its workflow here.

The first argument is the scope: a folder path, or a feature name to resolve to a
file list first. The second argument, if present, is the focus symbol that turns the
Process and Sequence views into a focus chain.

Two things this command must not do, because they are the skill's boundary: run
nothing (no test runner, no build), and judge nothing (no severity, no verdict).
