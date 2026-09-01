# Suspicion patterns

Five shapes worth flagging, all of them findable by reading, plus one check that
comes before all five. Each one below carries the tell — what to look for — and a
real case from this repository, because a pattern with no example gets recognised as
the wrong thing.

None of them is a verdict. Every entry ends with the command that would settle it,
because the skill does not run anything and the reader can.

Entry shape, repeated for all five:

```text
NN  <observation, with file:line>
    <why it is worth a look>
    Verify:  <command or edit>
```

---

## 0 · Before any of the five: names that are assembled at run time

A grep for a literal name answers "does this exact string appear", which is not the
question. A key built from a variable never appears in the source at all, so the
search comes back empty on something used every day.

Real case: a plain search said eight i18n keys had no caller. Four of them —
`toast.light`, `toast.dark`, `lang.en`, `lang.th` — are reached through
``t(`toast.${next}`)`` and ``t(`lang.${next}`)`` in `Layout.tsx:41` and `:52`. The
honest count was four, not eight.

So before reporting any "no caller found", sweep for the assembly sites too:

```powershell
rg "t\(\`" <scope>          # template-literal translation keys
rg "\[\w+\]" <scope>       # lookup tables indexed by a variable: EDGE[kind], MODES[mode]
rg "import\(" <scope>        # dynamic imports, import.meta.glob
```

If any of them can produce the name in question, it has a caller — say so, and drop
the entry. A suspicion the reader disproves in ten seconds costs more than the four
that were real.

---

## 1 · A behaviour no test touches

**Tell** — a behaviour from step 2 that no test body from step 3 reaches. Not "no
test mentions it in its title" — titles lie in both directions.

**Why it matters** — this is the honest half of what people expect from a coverage
number, and the half a percentage hides: a file at 100% line coverage can still have
a behaviour nothing asserts, because executing a line and checking what it did are
different things.

**Wording** — "ไม่พบเทสต์ที่แตะ X" and never "X ไม่ถูกทดสอบ". The scope inventory is
what makes the first sentence checkable; the second one claims something about tests
that were never read.

```text
03  ไม่พบเทสต์ที่แตะ uiStore.ts:52 ตอน dismissToast ได้ id ที่ไม่มีอยู่
    ขา early-return นี้เป็นขาที่ timer ของ toast ที่ถูกเบียดออกวิ่งเข้ามา
    Verify:  ลบ early-return แล้ว npx vitest run tests/unit/src/store
```

---

## 2 · A test that stays true after the code is deleted

**Tell** — the assertion checks an outcome that would hold either way. Read the
assertion, then ask: if the line this test is supposed to defend were removed, would
this expectation still pass? A guard whose only job is to *avoid* doing work is the
classic case, because skipping work and doing redundant work often produce the same
final state.

**Why it matters** — this is the most expensive kind of false confidence: the test
is green, the coverage tool counts the line, and the protection is not there. Only
deleting the line and rerunning distinguishes the two, which is exactly why this is
a suspicion and not a finding.

Real case, proven by deleting it — all four tests stayed green:

```text
frontend/src/store/applyUi.ts
  if (i18n.language !== lang) await i18n.changeLanguage(lang);

the tests assert i18n.language afterwards, which is unchanged either way.
what the guard actually prevents is a redundant changeLanguage re-rendering the
whole app — and nothing asserts that.
```

```text
01  applyUi.ts:24 guard ยังผ่านทั้ง 4 เทสต์ถ้าเอา guard ออก
    เทสต์ยืนยันผลลัพธ์ (ภาษาไม่เปลี่ยน) ซึ่งจริงทั้งสองทาง
    Verify:  ลบเงื่อนไข แล้ว npx vitest run applyUi
```

---

## 3 · No in-scope caller found

**Tell** — an exported symbol, a branch of a union, an enum member, a variant in a
lookup table that nothing inside the scope references.

**Why it matters** — either it is unfinished work, or the caller lives outside the
scope that was read. Both are worth knowing and they are not the same thing, so the
wording never says "dead code".

Real case: `uiStore.ts` defines four toast kinds; the app only ever pushes `info`
(`Layout.tsx:41` and `:50`). `success`, `warning` and `danger` have no caller.

```text
02  ไม่พบผู้เรียก success · warning · danger ใน scope  uiStore.ts:31
    แอปเรียก pushToast("info", ...) อย่างเดียว 2 จุด
    Verify:  rg 'pushToast\("(success|warning|danger)' ทั้งรีโป
```

---

## 4 · A test helper narrower than the production type

**Tell** — compare the two signatures side by side. A helper, factory or fixture
whose parameter type admits fewer cases than the real one means whole variants never
reach any assertion, and nothing fails — the missing cases were never requested.

**Why it matters** — the gap is invisible from either side alone. The production
type looks complete, the tests look thorough, and only holding them next to each
other shows the missing arms. It is also the pattern most worth a picture, since two
fans of arrows with one side short reads instantly.

Real case: `Toasts.tsx` maps four kinds to four left-border classes; the test
helper's parameter is typed `"info" | "danger"`, and no test asserts the class at
all — renaming `border-l-success` to nonsense left tsc at zero errors and all 92
tests green.

```text
04  push() ใน Toasts.test.tsx:22 รับแค่ "info" | "danger" แต่ ToastKind มี 4 ค่า
    และไม่มีเทสต์ไหน assert class ขอบซ้าย  EDGE ใน Toasts.tsx:19 จึงไม่มีใครดัก
    Verify:  แก้ border-l-success เป็นชื่อมั่ว แล้ว npx tsc --noEmit และ npx vitest run
```

---

## 5 · A mock standing where the behaviour under test should be

**Tell** — the test mocks a module, and the assertion depends on the mocked path
rather than on the real one. Follow the assertion backwards: if it only observes
what the mock returned, the production code between the action and the assertion
never ran.

**Why it matters** — the test still proves something (the wiring), just not the
thing its title claims. Without running it, the wiring and the behaviour cannot be
told apart, so this stays a suspicion.

```text
05  Layout.test.tsx:31 mock i18n ไว้ แล้ว assert ข้อความที่ mock คืนมา
    เส้นทางจริง handler → changeLanguage → re-render จึงอาจไม่ได้เดินผ่านเลย
    Verify:  เอา mock ออกชั่วคราว แล้ว npx vitest run Layout
```

---

## What does not belong here

```text
naming · formatting · style           there are linters for those
"this could be faster"                no measurement was taken
"this is a bug"                       nothing was run; that is a claim, not a reading
anything without a Verify line        if there is no way to settle it, it is a preference
```

The last line is the filter. A suspicion the reader cannot check is noise wearing
the shape of a finding.
