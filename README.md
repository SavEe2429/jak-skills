# for-review

Read a folder end to end — code and tests together — and get back **one self-contained
HTML page**: what is in the scope, what depends on what, which behaviours the tests
actually touch, and a numbered list of what is worth verifying next.

It reads what exists today. It is not a diff review.

## What it does not do

```text
does not run anything      no test runner, no build, no mutation
does not judge             no blocker/major/nit, no ship/reject, no risk score
does not read a diff       this reads what exists today
```

That boundary is the whole reason the page is usable. The moment a map says "this is
a bug", it becomes a review that has to be argued with instead of a map that can be
used. So the page says `ไม่พบเทสต์ที่แตะ Layout.tsx:41` and never `Layout.tsx:41 ไม่ถูก
ทดสอบ` — the first is a claim about what was read, the second is a claim about every
test everywhere, and only running them earns it.

## Install

```
/plugin marketplace add SavEe2429/for-review
/plugin install for-review
```

Then, once, so the screenshot pass can run:

```bash
npm install --prefix ~/.claude/plugins/cache/for-review/for-review/*/skills/for-review/scripts
```

## Use

```
/for-review src/components          a folder
/for-review "the toast system"      a feature — resolved to a file list first
/for-review src/api operate()       a folder plus a focus symbol
```

The optional second argument changes two of the six diagrams: Process and Sequence
become the call chain that passes through that symbol — one hop up to whoever calls
into it, at most three hops down, and never expanding a third-party package.

## Output

```text
<where you chose>/for-reviews/
   NN.<slug>.html        the page
   NN.<slug>.png         a full-height screenshot of it
   NN.manifest.json      what built it
   NN.diagrams/          one file per diagram, plus the specs
```

Page order: Requires · Scope · six diagram sections · Suspicions.

The folder is always called `for-reviews/`. **Where it sits, you decide** — the first run
asks, and every run after that finds the folder and uses it. Its existence is the stored
answer, so there is no config file to keep in sync. It holds generated files, so you
probably want it in `.gitignore`.

## The six questions

```text
01  What is here?                  Tree             always
02  What depends on what?          Dependency       always
03  What behaviour is tested?      Behaviour ↔ Test always
04  What does it do?               Process          if there is a branch, or on focus
05  What goes in and out?          Data flow        if data is transformed
06  Who calls whom?                Sequence         3+ modules, or on focus
```

Question 03 is the payload; the other five are context for it. A view that is not
drawn is recorded with its reason, because a missing section otherwise reads as an
oversight.

## Requires

| | | |
|---|---|---|
| `code-review-graph` | MCP | accelerates the scope and dead-code passes · degrades to reading |
| `diagram-design` | plugin | its `references/type-*.md` layout rules · degrades to no layout rules |
| `playwright-core` | npm | the screenshot pass · **hard requirement** |

The first two degrade and the degradation is written onto the page, so a reader can
tell a graph-backed run from a read-only one. `playwright-core` does not degrade: every
render pass so far has found a defect that was invisible in the SVG source, and a page
whose diagrams were never looked at has been proofread rather than checked.

## Layout

```text
skills/for-review/SKILL.md                  the workflow
skills/for-review/references/               suspicion patterns
skills/for-review/scripts/gen-tree.mjs      TREE from a spec
skills/for-review/scripts/gen-dependency.mjs  DEPENDENCY from a spec
skills/for-review/scripts/_shared.mjs       the skin both generators emit
skills/for-review/scripts/build-page.mjs    assemble + screenshot, enforces the structural rules
skills/for-review/scripts/shot-svg.mjs      screenshot one diagram at its own size
skills/for-review/scripts/wrap-diagram.mjs  accessible-SVG wrapper
commands/for-review.md                      the slash command
sync.sh                                     pull the skill back out of a working checkout
```

Tree and Dependency are generated from a JSON spec rather than authored: both are the
same picture every run with different names in the boxes, and hand-written coordinate
arithmetic is where "the child hangs off the wrong parent's bus" comes from — a defect
that leaves the picture looking perfectly fine. The other four views stay hand-authored,
because their layout is a judgement a spec would have to carry anyway.

`build-page.mjs` is not a formatter. It refuses to build a page whose manifest breaks
the rules — a drawn diagram without its one question, a suspicion without a verify
command, a banned word like *coverage* or a severity label anywhere in the prose — so
those checks are enforced rather than self-graded.

## License

MIT
