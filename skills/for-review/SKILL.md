---
name: for-review
description: Read an existing folder or feature end to end — code and tests together — and produce one self-contained HTML page that answers six questions with diagrams, then lists what a human should go verify. Use this whenever the user wants to understand code that already exists ("what does the frontend do", "แต่ละไฟล์ทำอะไร", "map this feature", "อธิบายโครงส่วนนี้ให้หน่อย"), wants to see what their tests actually cover, asks what would break or lose coverage if something changed, or asks for a diagram of a folder, component, module or test suite. Use it for the code that is already there, not for a diff — /diff-review reviews a diff, this one reviews what exists.
---

# for-review

The goal is not to judge the code. The goal is to make the existing code and tests
understandable at a glance, then surface what should be verified next.

## What this skill does not do

```text
does not run anything      no test runner, no build, no mutation
does not judge             no blocker/major/nit, no ship/reject, no risk score
does not read a diff       /diff-review owns that; this reads what exists today
```

These three are the whole boundary. A reader trusts this page precisely because it
never claims more than reading can support — the moment it says "this is a bug", it
becomes a review that has to be argued with instead of a map that can be used.

## Requires

Two outside things. Check both before step 0, and write the result of that
check onto the page — a reader has to know which half of the method actually ran.

```text
code-review-graph   MCP    ขั้น 1-4 พิงมัน  ·  ไม่มี = อ่านล้วน ช้าลง แต่ยังเดินได้
playwright-core     npm    check-svg.mjs + shot-svg.mjs  ·  ไม่มี = ข้ามขั้น 7 ไม่ได้
```

```text
preflight — ทั้งสองอย่าง
  code-review-graph   เรียกเครื่องมือ list_graph_stats  (MCP ไม่ใช่คำสั่งเชลล์)
  playwright-core     npm ls --prefix <scripts> playwright-core
```

Paths below are written for a checkout of this skill. Installed as a plugin they are
`${CLAUDE_PLUGIN_ROOT}/skills/for-review/scripts` instead — `$env:CLAUDE_PLUGIN_ROOT`
in PowerShell — and if that variable is not set, the scripts sit beside this file.

Only `playwright-core` is hard. The screenshot pass at step 7 has found a defect on
every run so far, and a page whose diagrams were never looked at is a page that has
been proofread instead of checked — so a missing browser stops the run, it does not
degrade it. `npm install --prefix ${CLAUDE_PLUGIN_ROOT}/skills/for-review/scripts` fixes it.

`code-review-graph` degrades, and the degradation is recorded:

```text
REQUIRES
  code-review-graph  ไม่ตอบ — สโคปและ dead-code มาจากการอ่านล้วน
  playwright-core    พบ
```

## Input

```text
/for-review src/components          a folder
/for-review frontend/src/store      a folder
/for-review "the toast system"      a feature — resolve it to a file list first
/for-review src/api operate()       a folder + a focus symbol
```

The second argument is optional and changes only two diagrams. Give it a function,
method or class name and the Process and Sequence views become the **whole call chain
that passes through it** — see *Focus chain* below. Leave it out and those two views
fall back to their default rule.

## Workflow

Run in order. Steps 0-4 are the expensive half and they are the half that makes the
rest true.

### 0. Refresh the graph

`code-review-graph` holds a parsed structure of the repository, and steps 1-4 lean on
it. A stale graph is worse than no graph: it produces a picture that is wrong in
exactly the way a reader cannot detect, because a graph-derived diagram looks as
finished as a read-derived one.

```text
list_graph_stats            เทียบ last-updated + commit กับ HEAD ปัจจุบัน
ไม่ตรง                       build_or_update_graph ก่อน แล้วเทียบซ้ำ
เครื่องมือเรียกไม่ได้           ข้ามไปทำแบบอ่านล้วน แล้วบันทึกไว้บนหน้าเว็บ
```

The last line matters. The graph is an accelerator, not a dependency — when it is
unavailable the skill still runs, it just costs what it used to.

### 1. Pin the scope, and show it

List every file the target contains, then read it in two tiers.

```text
โครง        get_architecture_overview + list_communities   ร่างรายชื่อและจัดกลุ่ม
ชั้นเต็ม     อ่านทั้งไฟล์
              ไฟล์ที่กราฟชี้ในขั้น 2  ·  ไฟล์ที่กราฟมองไม่เห็น (ดูหัวข้อล่าง)
              ไฟล์ที่ผังจะวาดถึงพฤติกรรมข้างใน
ชั้นบาง      อ่านจาก file_summary ของกราฟ  ที่เหลือทั้งหมด
```

**No diagram before the scope is complete.** A diagram drawn after reading four of
seven files is not 4/7 right — it is confidently wrong in a way the reader cannot
see, because the picture looks just as finished either way. Draw only after:

- every scoped file has been covered at one of the two tiers
- the file inventory is written into the page, **with the two tiers kept apart** —
  never one merged "อ่านแล้ว N ไฟล์" count, because a full read and a summary read
  do not support the same sentence
- files deliberately left out are named, with the reason

Files with no test are **in scope**, not skipped. A file nobody tested is the thing
the reader most needs to see; it shows up later as a row with an empty right-hand
side. The only things worth excluding are artifacts that are not source at all —
snapshots, generated output, lockfiles — and each one gets named.

```text
SCOPE
  อ่านแล้ว  7 ไฟล์      3 มีเทสต์คู่  ·  4 ไม่มี
  ข้ามไป   1 ไฟล์
    __snapshots__/Layout.snap    ผลลัพธ์ที่เครื่องสร้าง ไม่ใช่ source
```

### 2. Inventory the behaviours

Per file, list what it does as B1..Bn, each with `file:line`. A behaviour is
something the code decides or performs — a branch, a guard, a write, a call out, a
returned shape. Not "renders JSX".

Then run the reverse pass: for every name the scope declares, look for something that
uses it. Reading a file top to bottom tells you what it offers; only this tells you
whether anyone took it. On the first real review this pass produced four of the eight
suspicions, and none of them were visible while reading the files themselves.

The graph runs this pass mechanically — `query dead-code` over the scope. **Its output
is a candidate list, never a section of the page.** Measured on this repository it
returned 54 items of which roughly 20 survived; the rest are these four classes, and
each one is live code the parser cannot see a caller for:

```text
สมาชิก enum                    ถูกเลือกด้วยค่า ไม่ใช่ด้วยชื่อ
ฟิลด์ของโมเดล pydantic          ตัวตรวจอ่านมันผ่านสคีมา
ตัวที่ผูกผ่าน Protocol หรือ ABC   ผู้เรียกเรียกผ่านชื่อฐาน
export ที่ผู้เรียกประกอบคีย์ตอนรัน   t(`toast.${next}`) · EDGE[kind]
```

Each surviving candidate gets confirmed by reading — open the declaration, open the
place the graph says nothing calls it from, and cite both as `file:line`. A candidate
that reaches the page without that step is the graph's claim, not this review's.

Then check what the graph structurally cannot answer (the list further down), which
still costs a `rg`:

```powershell
# an i18n key, a constant, a config field that no code reads
rg "<key>" <scope>

# a runtime dependency in package.json that nothing imports
rg "<package>|<its main export>" <scope>
```

A miss here is suspicion pattern 3, and the wording matters: "no in-scope caller
found", never "dead code" — the caller may sit in the half of the repository this
review did not read.

### 3. Inventory the tests

T1..Tn with `file:line`. Take the title as a claim, not as evidence — what the test
actually touches is what its body does.

`query tests_for <module>` lists tests per module without opening every test file. Two
things about it, both measured:

```text
ต้องใส่ชื่อเต็ม     <abspath>/file.py::ClassName   ชื่อเปล่าตอบ ambiguous ทุกครั้ง
ศูนย์ = ผู้ต้องสงสัย  ไม่ใช่คำตอบ
```

The second line is the important one. On the first real run `tests_for` answered **0**
for four classes; three of them had a test file that instantiates them by name. A zero
here is a place to go look, and the look is cheap:

```powershell
ls tests/**/test_<module>.py ; rg "\b<ClassName>\b" tests <src>/**/tests
```

Only after that does the zero become a sentence on the page. One of the four — a
387-line class with no test file of its own — survived that check. The other three
did not, and reporting them would have been three false claims in one section.

### 4. Map B to T

For each behaviour, find the tests whose body reaches it. Reaching it means the test
executes that line or asserts something only true when that line ran. A test that
asserts an outcome which would still hold with the behaviour deleted has not covered
it — that is suspicion pattern 2, not a mapping.

**The graph stops at the file boundary here.** `tests_for` answers "which tests reach
this module"; the column that says a *behaviour* is untouched needs the test body
read. So: use the graph to pick which test files to open, then open them. A row on the
page claiming a behaviour has no test, sourced only from a module-level count, is a
sentence the evidence does not carry.

### 5. Choose the diagrams

Write the diagram's one question first. If the question is hard to write, the
diagram has no job — leave it out and record why.

If a focus symbol was given, Process and Sequence are both drawn and both use the
**Focus chain** rule below rather than their default condition.

### 6. Draw

Settle where the output goes **before** writing the first file — see **Output**. The
diagrams land in that folder too, so asking afterwards means moving files that the
manifest already points at.

Read `references/rendering.md` before drawing — the layout rules for the shape you
are about to draw are there, along with the generators for Tree and Dependency.

### 7. Measure every diagram, then look at what is left

Two passes, in this order. The first is free and catches more than the second.

```powershell
# มาตรวัด — เบราว์เซอร์คืนตัวเลข ไม่ใช่ภาพ  ผังสะอาด = เอาต์พุตบรรทัดเดียว
node ${CLAUDE_PLUGIN_ROOT}/skills/for-review/scripts/check-svg.mjs <dir>/*.html

# แล้วค่อยเปิดดู เฉพาะใบที่ผ่านมาตรวัดแล้ว
node ${CLAUDE_PLUGIN_ROOT}/skills/for-review/scripts/shot-svg.mjs <dir>/*.html
```

`check-svg.mjs` reads every element's `getBBox()` and does the arithmetic for the four
defects that recur: a label on a label, a label past its box edge, a connector through
a box it is not talking to, two connectors in one lane. Measured on this repository it
found a pair of horizontals 6px apart that had already survived two screenshot passes —
6px is one line once the image is scaled down, so the eye cannot win that one.

Looking still happens, and it is not optional. It answers what no measurement can:
does the picture answer its question in five seconds, is the label honest, does the
emphasis land where the meaning is. It just no longer carries the mechanical half.

Reading one diagram PNG costs about 1,400 image tokens; the whole pass was measured at
8,468 for five diagrams and the assembled page. Running the measure first means a
defect is fixed before any of that is spent, rather than after.

Then check each PNG against the list in **Recurring defects** below. A diagram you
have not looked at has been proofread, not checked.

### 8. Write the suspicions

Read `references/suspicion.md` before writing this section. Each entry says what was
observed, and hands over the command that would settle it.

### 9. Self-check

Both layers below. A failed line is a fix, not a footnote.

## What the graph cannot see

The graph parses declarations and call sites. Four kinds of finding sit outside that,
and all four came out of the last two runs by reading. **The full-read tier in step 1
exists for these** — cut it and the page keeps its diagrams and loses its findings.

```text
เมธอดที่สร้างตอนรัน        เมธอดที่ไลบรารีผูกให้ตอน import เช่น transition ของ state machine
                        กราฟไม่เห็นทั้งตัวประกาศและผู้เรียก
ฟิลด์คอนฟิกที่ไม่มีใครอ่าน    ฟิลด์ที่มีอยู่ทั้งในไฟล์คอนฟิกและในโมเดล
                        แต่ไม่มีโค้ดไหนหยิบไปใช้  รอบแรกเจอสามตัว
กฎในเอกสารขัดกับโค้ด       CLAUDE.md ห้าม print() แต่ซอร์สมี 55 จุด
                        เอกสารไม่ได้อยู่ในกราฟ
สัญญาที่ประกาศไว้ล่วงหน้า    exception ที่ประกาศแล้วไม่มีจุด raise
                        กราฟนับเป็น dead แต่เหตุผลว่าทำไมต้องอ่านถึงจะรู้
```

Rule of thumb: the graph answers *what connects to what*. Anything about intent,
about a name crossing from data into code, or about a document disagreeing with the
code, is still a reading job.

## Evidence rule

This governs every diagram and every sentence, so it is stated once here rather than
repeated per section.

For every node, edge and claim, know where it came from:

```text
อ่านเจอ    ชี้ file:line ได้
อนุมาน     บอกได้ว่าอนุมานจากอะไร
```

Two labels, not three. A confidence percentage invites the reader to do arithmetic
on a guess.

The graph does not add a third label, it sorts into these two:

```text
ผลจากกราฟที่มี file:line ติดมา        อ่านเจอ   — ตำแหน่งตรวจย้อนได้
ผลจากกราฟที่ไม่มี เช่น ยอดรวม ชุมชน    อนุมาน จากกราฟ
```

Which means a graph result that is going to be stated as fact gets its `file:line`
opened. That is the whole cost the graph did not remove, and it is the cost that keeps
the page checkable.

The wording follows from it, and this distinction is the whole reason the page can
be trusted without a test run:

```text
เขียนได้     "ไม่พบเทสต์ที่แตะ Layout.tsx:41"
เขียนไม่ได้   "Layout.tsx:41 ไม่ถูกทดสอบ"
```

The second sentence is a claim about all tests everywhere. Only running them earns
it. The first is a claim about what was read, and the scope inventory is what makes
it checkable.

## The six questions

Diagram choice is deterministic. Three are always drawn because the reader always
has those questions; three are drawn only when the code has that shape.

```text
01  What is here?                  Tree             always
02  What depends on what?          Dependency       always
03  What behaviour is tested?      Behaviour ↔ Test always
04  What does it do?               Process          if there is a branch
05  What goes in and out?          Data flow        if data is transformed
06  Who calls whom?                Sequence         if a call chain crosses 3+ modules
```

A focus symbol, when one is given (`/for-review <scope> <symbol>`), overrides the condition on
04 and 06 — both are drawn, and both are drawn as the focus chain. The condition
column only decides whether to draw them when no focus was named.

**Question 03 is the payload.** The other five are context for it. It is the one
that answers what the reader came for, so it never gets cut for space.

Never print the word *coverage* on the page. The reader will hear "percentage of
lines executed", which is a measurement this skill did not take. The heading is
`BEHAVIOUR ↔ TEST` and the question under it is "พฤติกรรมไหนมีเทสต์แตะ".

Some notes per view:

- **Dependency** — draw what is inside the scope. An external package appears only
  when it explains a scoped node (`Layout.tsx → i18next` earns its box; i18next's
  own dependencies do not). Without this rule the graph grows until it is the
  repository.
- **Process** — a branch means `if`, `switch`, a guard, a loop, an error path. A
  straight line A → B → C is already covered by data flow or sequence.
- **Sequence** — two modules is a sentence, not a picture.

A view that is not drawn is recorded, because a missing section otherwise reads as
an oversight:

```text
SEQUENCE
  ไม่วาด  call chain อยู่ใน 2 โมดูล
```

## Focus chain

Default Process and Sequence answer "what happens inside this scope". With a focus
symbol they answer a different and more useful question: **what is the whole path of
execution that this symbol sits on?**

Given `operate()`, the picture is not `operate()` alone and not its callees alone. It
is the spine it sits on:

```text
add()  →  operate()  →  wayA()
          ^^^^^^^^^  จุดโฟกัส ทำให้เด่น ไม่ใช่ตัดที่นี่
```

Build it in two directions from the symbol. The two directions stop on **different**
rules, and the asymmetry is the point:

```text
ขึ้น    หยุดที่ไฟล์แรกนอกไฟล์เป้าหมายที่เรียกเข้ามา — 1 hop ไม่ต่อขึ้นไปอีก
ลง     ไล่ต่อไปเรื่อยๆ — มากสุด 3 hop หรือสุดฟังก์ชันของเราเอง แล้วแต่อะไรมาก่อน
```

Downward is capped at three because a fourth hop has never once changed what the
reader does next, and the diagram pays for it in width every time. If the chain is
still going at hop three, the last node gets `…` after its name — the reader then
knows the picture was cut rather than that the code ended:

```text
operate() → wayA() → encode() → write() …
                                       ยังต่อ แต่ตัดที่นี่
```

**Upward stops at one hop out of the file.** Chase callers to the true root and every
frontend chain ends at `index.html` and every task ends at `app.py` — a node that is
the same on every diagram carries no information, and the four hops of framework
plumbing before it are noise the reader already knows. The first caller outside the
target file is the answer to "ใครใช้ของชิ้นนี้", which is the question that was asked.

```text
เขียนได้     Nav.tsx → t() → i18n.ts
เขียนไม่ได้   index.html → main.tsx → App.tsx → Layout.tsx → Nav.tsx → t() → i18n.ts
```

If several files call in at that one hop, draw them all — they are siblings at the same
level, not a chain, and the focus node is the point they converge on.

**Only files this repository writes.** The chain stops at the boundary of code we own —
a call into a third-party package, a framework, or the standard library is drawn as
**one terminal node with the package name on it**, never expanded. Follow a library
inward and the picture stops being about our code within two hops; that boundary node
is the honest answer, because "we hand it to the driver here" is the whole thing the
reader needed to know.

```text
วาด        ไฟล์ที่อยู่ใน repo นี้ — source + tests
ปลายทาง    ทุกอย่างใน node_modules · site-packages · vendor · stdlib
```

Two more rules that keep the chain a chain:

```text
กิ่งที่ไม่ผ่านจุดโฟกัส        ไม่วาด — add() เรียก log() ด้วย แต่ log() ไม่อยู่บนเส้น
ตัดเพราะชนเพดาน 3 hop      ใส่ … ท้ายชื่อ node สุดท้าย ไม่ใช่ปล่อยให้ดูเหมือนจบ
```

`get_flow` / `traverse_graph` / `get_impact_radius` from the graph give the raw
edge list for both directions cheaply. As everywhere else, an edge that reaches the
page gets its `file:line` opened first — the graph misses runtime-bound and
dynamically-imported calls, and a chain with a silent gap in the middle is worse than
one drawn shorter and labelled.

The heading says which mode it is in, so a reader never has to guess why the picture
is shaped this way:

```text
PROCESS · focus operate()      add() → operate() → wayA()
SEQUENCE · focus operate()     ไลฟ์ไลน์ = โมดูลของทั้งเส้น ไม่ใช่แค่ที่อยู่ใกล้จุดโฟกัส
```

## Kinship colour

When two nodes in the same picture do work that overlaps — two tests asserting the
same thing, two helpers with one job between them, a wrapper and the thing it wraps —
give them a **shared tint** and nothing else.

```text
สีเดียวกัน = "สองอันนี้ทับกัน ไปดูเอง"
ไม่มีป้าย   ไม่มีลูกศร  ไม่มีคำว่า duplicate หรือ redundant
```

The rule is deliberate. Saying *which* one is redundant is a judgement, and this skill
does not make judgements — but showing that two boxes rhyme is an observation, and the
reader can settle it in thirty seconds once they know where to look. The colour points;
the reader decides.

How to apply it:

```text
จับคู่     ชื่อคล้ายกัน  ·  ยิงใส่เป้าหมายเดียวกันในตาราง B ↔ T  ·  export คู่กัน
ทาสี      พื้นอ่อนสีเดียวกันบนทุกกล่องในกลุ่ม  ขอบเดิม ตัวอักษรเดิม
หลายกลุ่ม  แต่ละกลุ่มคนละสี  เกินสามกลุ่มในภาพเดียวแปลว่าภาพควรถูกแยก
LEGEND    หนึ่งบรรทัด: "พื้นสีเดียวกัน = ทำงานทับกัน"  ไม่ขยายความ
```

The tint sits underneath the existing palette rather than replacing it: keep the
document's accent for whatever the accent already means in that picture, and pick the
kinship tints from the remaining low-saturation range so a kinship pair never reads as
"this is the flagged one".

The Behaviour ↔ Test table is where this earns the most — two tests landing on one
behaviour row is exactly the shape that a shared tint makes visible and a column of
`file:line` does not.

## Budget and splitting

A folder always exceeds one picture. The default is fixed so the decision is not
re-litigated per diagram:

```text
เกิน 9 node ที่มีความหมาย
   1  วาดภาพรวมระดับไฟล์ 1 ใบ
   2  วาดภาพย่อย 1 ใบต่อไฟล์ที่ต้องขยาย
```

Never shrink the font to fit. Splitting keeps one question per diagram; shrinking
keeps the count down and makes both pictures useless.

**Uncapped mode.** The user can ask for one picture with everything in it. Then draw
it, and hold two things:

```text
ขนาดภาพขยายได้ ตัวอักษรห้ามเล็กลง        ป้ายยังต้องอ่านออกที่ 100%
เขียนจำนวน node จริงไว้ใต้ภาพ            คนอ่านจะได้รู้ว่ากำลังดูภาพเกินงบอยู่
```

Uncapped trades "answers its question in five seconds" for "shows every relation at
once". Both are legitimate; only one of them is the default, and the picture should
say which one it is.

## Suspicions

The page ends with a numbered list. No severity, no ranking — ordering by "how bad"
is a judgement this skill does not have the evidence to make.

Each entry has three lines:

```text
NN  <what was observed, with file:line>
    <why it is worth a look>
    Verify:  <the exact command or edit the reader can run>
```

The five patterns and how to recognise each by reading live in
`references/suspicion.md`. Read it at step 8. Wording stays neutral there too —
"no in-scope caller found for X" rather than "dead code", because a caller may sit
outside the scope that was read.

## Output

One self-contained HTML page. The reader opens one file, not seven.

```text
<ที่ผู้ใช้เลือก>/for-reviews/
   NN.<slug>.html        หน้าเว็บ  ·  NN นับต่อจากที่มีอยู่ในโฟลเดอร์
   NN.<slug>.png         ภาพหน้าเต็ม  build-page.mjs เขียนให้เอง
   NN.manifest.json      อินพุตของ build-page.mjs
   NN.diagrams/          ผังทีละใบ + spec ของใบที่ generate
```

The folder is always called `for-reviews/`. Where it sits is the user's call, asked
once and never again:

```powershell
# ก่อนเขียนไฟล์แรก — หาโฟลเดอร์ก่อน
ls -d for-reviews */for-reviews 2>$null
```

```text
เจอ        ใช้อันนั้น ไม่ต้องถาม — การที่มันมีอยู่คือคำตอบที่ผู้ใช้เคยให้ไว้แล้ว
เจอหลายอัน  ถามว่าจะเอาอันไหน
ไม่เจอ      ถามว่าจะวางไว้ที่ไหน แล้วสร้างตรงนั้น
```

Asking costs one turn. Guessing costs a folder in the wrong place that the user finds
later, and a second copy the next time someone runs it from a different assumption.

When asking, offer what the repository actually has rather than a blank prompt — a
scratch or notes folder if one exists (`docs/notes/`, `.scratch/`, `notes/`), and the
repository root otherwise. Say in the same breath that it holds generated files and
usually belongs in `.gitignore`.

**No config file.** The folder's existence is the stored answer; a config file would be
a second place for that answer to live and a second place for it to go stale. One flat
folder and one number series, so `ls for-reviews/` is the index too.

Page order, top to bottom:

```text
nav        Scope · Tree · Dependency · Behaviour ↔ Test · Process · Data · Sequence · Suspicions
SCOPE      the inventory from step 1 — read, skipped, counts
diagrams   each with its question directly underneath, or its not-drawn reason
SUSPICIONS the numbered list
```

Prose on the page is Thai, short, and subordinate to the pictures — a caption's job
is to say what the picture cannot, not to restate it.

**Identifiers are never translated.** A path, a module, a class, a function, a config
key, a test name — it appears exactly as it does in the repository, in every heading,
box label, zone label and group title:

```text
เขียนได้     src/store/   ·   useApiResource()   ·   PROFILE_NOT_FOUND
เขียนไม่ได้   ที่เก็บสถานะ    ·   ฮุคดึงข้อมูล         ·   ไม่พบโปรไฟล์
```

A translated name cannot be pasted into `rg`, and the reader has the code open beside
the page — a label they cannot search for is worse than no label. Thai carries the
sentence about the name; the name itself stays verbatim.

## Rendering

Read `references/rendering.md` at step 6, before drawing anything. It carries the
layout rules per shape, the generator specs, the CSS-class rule for authored SVG, and
the manifest schema — none of it is guessable, and every rule in it was learned by
rendering something and diffing the result.

The four scripts, in the order a run uses them:

```text
gen-tree.mjs · gen-dependency.mjs   สองภาพนี้ generate จาก spec ไม่ต้องเขียน SVG เอง
wrap-diagram.mjs                    หุ้ม body ที่เขียนเองด้วยสัญญา accessible-SVG
hoist-css.mjs                       ยุบ attribute ซ้ำเป็น CSS class
build-page.mjs                      ประกอบหน้า + PNG และบังคับกฎโครงสร้าง
```

## Recurring defects

Check every PNG against this list at step 7. All of these were found by looking, in
runs where the source read as correct; three of them recurred after being fixed once,
which is why they are written down rather than remembered.

```text
เส้นลากทะลุกล่องที่ไม่ใช่ปลายทาง
    เกิดสองรอบติดกัน แก้แล้วใส่กลับมาใหม่ อ้อมข้างล่างหรือข้างบนเสมอ
    ถ้าอ้อมไม่ได้จริงๆ ให้ใช้เส้นประ แปลว่า "แค่ผ่าน ไม่ได้คุยด้วย"

ป้ายจมอยู่ใต้กล่อง
    เพราะวาดป้ายก่อนกล่องตามลำดับที่ถูก ป้ายจึงต้องอยู่บนพื้นที่ว่างเท่านั้น
    ป้ายที่อยู่ "ใน" กล่องพอดีคือ badge ไม่ใช่ปัญหา ป้ายที่คร่อมขอบคือปัญหา

ลูกศรไม่ถึงกล่อง หรือจบตรงมุมพอดี
    หยุดก่อน 16px แล้วลอยอยู่กลางอากาศ อ่านซอร์สไม่มีทางเห็น
    ตรวจว่าปลายทางของ path ตรงกับขอบกล่องจริง ไม่ใช่ขอบ zone

กล่อง note โปร่งแสง
    fill แบบ rgba ปล่อยให้เส้น lifeline ทะลุขึ้นมาบนตัวหนังสือ ใช้สีทึบ

ลูกของ subtree ต่อเข้า bus ของพ่อผิดตัว
    ผังยังดูสวย แต่ความหมายผิด กล่องแม่ต้องอยู่กึ่งกลางของ bus ลูกเสมอ

โซ่ยาวเกินความกว้างภาพ
    ปลายขวาโดนตัดเงียบๆ ไม่มี error ให้เห็น ย่อป้ายหรือหักเป็นสองแถว
```

## Self-check

**Structural** — about the information. `build-page.mjs` enforces the last four and
exits 1 with the offending entry named, so these four are checked, not remembered:

```text
[ ] preflight ran, and both tools' status is on the page
[ ] focus chain climbs exactly one hop out of the target file, never to an entry point
[ ] focus chain descends at most three hops, and a cut chain ends in …
[ ] focus chain, if a symbol was given, stops at the boundary of code we own
[ ] kinship tint used where two nodes overlap, and its legend says nothing more
[ ] output folder found, or asked for, before the first file was written
[ ] graph freshness checked against HEAD, or its absence recorded on the page
[ ] every scoped file listed at one of the two tiers, and the tiers kept apart
[ ] skipped files named with a reason
[ ] every dead-code candidate confirmed by reading before it reached the page
[ ] every claim traceable to file:line, or labelled อนุมาน

enforced by the script
[ ] both requires entries present, named from the closed set, with a status
[ ] every drawn diagram has its one question
[ ] every undrawn view has its reason
[ ] every suspicion has observed, why, and a verify command
[ ] no severity word, no verdict, no percentage anywhere on the page
```

**Visual** — about the pictures, answered by looking at each PNG from step 7:

```text
[ ] check-svg.mjs ran and reported nothing, on every diagram
[ ] every defect in Recurring defects checked for, on every diagram
[ ] nothing clipped at the right edge
[ ] labels legible, Thai included
[ ] each picture answers its question in about five seconds
```

The last line is the real gate. If answering the question needs the caption, the
picture failed and a table would have been more honest.
