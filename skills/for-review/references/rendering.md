# Rendering

How the six diagrams get made: which are generated, how the authored ones are drawn,
and what the page assembler expects. Read this at step 6, before the first SVG.

**Tree and Dependency are generated, not authored.** Both are the same picture every
run with different names in the boxes — rows, even spread, elbows — so they come from
a spec and a script:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/for-review/scripts/gen-tree.mjs       <spec.json> [out.html]
node ${CLAUDE_PLUGIN_ROOT}/skills/for-review/scripts/gen-dependency.mjs <spec.json> [out.html]
```

Writing a spec costs a fraction of writing the SVG, and it removes the two defects
that come from doing coordinate arithmetic by hand — a child hanging off the wrong
parent's bus, and an elbow whose horizontal runs through the rank it skipped. Both
generators put the spec's `kin` field to work, so a kinship pair is a one-word edit.

The spec fields are documented at the top of each script. Two rules that are not
obvious from them:

```text
label ยาวเกินกล่อง      ขยาย w  ห้ามย่อชื่อ — ชื่อที่ paste ใส่ rg ไม่ได้ แย่กว่าไม่มีป้าย
edge ที่ต้องอ้อม         ใส่ d เองในรายการ edges  ตัวที่เหลือ generator เดินให้
```

The other four views stay hand-authored: a flowchart's shape carries meaning, a
sequence's lifeline order is a judgement, and a generator for those would need the
judgement as input anyway.

**Author the hand-drawn ones with CSS classes, not repeated attributes.** Measured on
three of them, attributes were 69% of the SVG bytes and the text a reader actually sees
was 19% — `font-family="'Geist Mono', monospace"` alone cost 3,192 bytes across three
files. Put the shared values in a `<style>` block and the render is identical:

```bash
# แปลงไฟล์ที่เขียนด้วย attribute ไปแล้ว
node ${CLAUDE_PLUGIN_ROOT}/skills/for-review/scripts/hoist-css.mjs <file.html>
```

Two rules, both learned by rendering and diffing rather than from the spec:

```text
CSS ชนะ presentation attribute เสมอ
    property อยู่ใน base rule ได้เมื่อทุก element มีค่าเดียวกันเท่านั้น
    มีค่าต่างเมื่อไหร่ ต้องแตกเป็น class ต่อค่า ไม่งั้น element ที่ต่างโดนทับเงียบๆ

font stack ลอกมาทั้งพวง ห้ามเติมห้ามตัด
    เติม fallback ตัวเดียว เปลี่ยนว่า glyph ที่ font หลักไม่มี (เช่น →) ไปตกที่ font ไหน
    ความกว้างต่าง ทุกตัวหลังจากนั้นเลื่อน
```

Verify any conversion the way it was verified here: render before and after, diff the
PNGs, and accept nothing but zero differing pixels. Anything else means one of those
two rules was broken.

The rest of this section is about the authored ones: Process, Data flow, Sequence and
Behaviour ↔ Test. The layout rules below are the whole of what an authored diagram has
to obey — node and edge budgets, port and elbow conventions, and the one anti-pattern
per shape that keeps recurring. Read the block for a shape before drawing it.

```text
ทุกรูป
  เส้นเชื่อมเป็นมุมฉาก มุมโค้ง r=8  ห้ามเส้นทแยง
  วาดเส้นก่อน วาดกล่องทีหลัง        ปลายเส้นถูกกล่องบังพอดี
  ป้ายเว้นจากเส้น 6-10px            ป้ายบนเส้นต้องมีพื้นทึบรอง
  เส้นห้ามลอดหลังกล่องที่ไม่ใช่ปลายทาง ถ้าต้องตัดกัน ใช้สะพานข้ามเส้นเดียว
  หลายเส้นออกจากขอบเดียวกัน แยกจุดเกาะห่างกัน >=12px
  กล่องกว้าง 2 ขนาดพอ               ความกว้างมั่วคือภาพอ่านยาก
```

```text
Process (flowchart)
  รูปทรงบอกชนิด สีไม่บอก   วงรี=เริ่ม/จบ · สี่เหลี่ยม rx=6=ขั้นตอน · ข้าวหลามตัด=ตัดสินใจ · จุดทึบ r=4=จุดบรรจบ
  ไหลบนลงล่าง             ข้าวหลามตัดออกได้ <=3 ทาง  Yes ไปขวา No ลงล่าง
  ทุกเส้นออกจากข้าวหลามตัดต้องมีป้าย
  เน้นสีได้ทางเดียว        happy path หรือจุดตัดสินใจที่สำคัญที่สุด ไม่ใช่ทุกจุด
  anti-pattern            ข้าวหลามตัดออก 4 ทาง — ซอยเป็นข้าวหลามตัดซ้อน

Sequence
  actor เป็นกล่องแถวบน  lifeline เส้นประลงล่าง  เวลาไหลบนลงล่าง
  activation bar         สี่เหลี่ยมกว้าง 8 บน lifeline ช่วงที่ actor ถือ control ซ้อนได้ถ้าเรียกซ้อน
  return                 เส้นประ + หัวลูกศรทึบ (ห้ามหัวเปิด)
  self-message           ลูปตัว U ป้ายอยู่ขวาลูป
  แตกทาง                 ใช้กรอบ alt/opt/loop มีป้ายเงื่อนไข ห้ามลอยลูกศร if/else เอง
  งบ                     lifeline <=5 · ลูกศร <=12 · กรอบ 1 · ซ้อนกรอบ 0 ชั้น
  anti-pattern           สองโมดูลคือประโยค ไม่ใช่ภาพ (กฎ 3 โมดูลใน The six questions)

Data flow
  เดินซ้ายไปขวา ขั้นตอนเป็นคอลัมน์ แหล่ง/ปลายทางเป็นแถว
  เส้นหักครั้งเดียว       ออกขอบขวา วิ่งแนวนอนก่อน แล้วค่อยลง/ขึ้นเข้าขอบบน-ล่าง
  ป้ายเฉพาะเส้นที่เน้น    เส้นอื่นไม่ต้องมีป้าย ไม่งั้นภาพเต็มไปด้วยตัวหนังสือ
  ชนิดข้อมูลเป็นชิปในกล่อง ไม่ใช่ป้ายบนเส้น

Behaviour ↔ Test
  พฤติกรรมคอลัมน์ซ้าย เทสต์คอลัมน์ขวา เส้นเชื่อมคือ "เทสต์นี้แตะพฤติกรรมนี้"
  พฤติกรรมที่ไม่มีเส้นออก คือประเด็นของภาพ — เน้นตรงนั้น ที่เดียว
  เรียงพฤติกรรมตามลำดับในโค้ด ไม่ใช่เรียงตามว่ามีเทสต์หรือไม่
```

Over budget on any shape: รวมใบที่เป็นกลุ่มเดียวกันเป็นก้อนเดียวแล้วเขียนจำนวนไว้
(`+6 leaves`) และบอกไว้ใต้ภาพ — ห้ามตัดโหนดทิ้งเงียบๆ. Splitting rules are in
**Budget and splitting**.

Palette and fonts stay whatever the surrounding documents use. Matching a diagram
system's skin matters when the picture ships to a customer; here it ships to one
reader who has the code open beside it.

Author the SVG body only and let the wrapper stamp the accessible contract —
`role="img"`, `<title>` first, `<desc>`, prefixed ids, one self-contained file:

```powershell
node ${CLAUDE_PLUGIN_ROOT}/skills/for-review/scripts/wrap-diagram.mjs <body.svgpart> <out.html>
```

Then assemble and screenshot the page:

```powershell
# one-time
npm install --prefix ${CLAUDE_PLUGIN_ROOT}/skills/for-review/scripts

node ${CLAUDE_PLUGIN_ROOT}/skills/for-review/scripts/build-page.mjs <manifest.json>
```

The script inlines every SVG — from a bare `.svg` or from a self-contained diagram
page — writes the page, and saves a PNG next to it. It also refuses to build a page
that breaks the structural rules, so the checklist below is enforced rather than
self-reported. The manifest is the whole input:

```json
{
  "title":  "shown as the page h1",
  "out":    "01.<slug>.html — relative to the manifest",
  "focus":  "operate() — omit when no focus symbol was given",
  "requires": [
    { "name": "code-review-graph", "status": "พบ · ตรงกับ HEAD" },
    { "name": "playwright-core",   "status": "พบ" }
  ],
  "scope":  {
    "note":    "one line: counts, how many files have a test file and how many do not",
    "read":    ["one entry per directory, naming every file in it"],
    "skipped": [{ "file": "path", "reason": "why it is not source" }]
  },
  "sections": [
    { "id": "tree", "heading": "TREE", "question": "the one question", "svg": "path" },
    { "id": "sequence", "heading": "SEQUENCE", "notDrawn": "why it was not drawn" }
  ],
  "suspicions": [
    { "observed": "with file:line", "why": "why it is worth a look", "verify": "command" }
  ]
}
```

`id` becomes the nav anchor, so keep it short and stable. A section carries either
`svg` or `notDrawn`, never both and never neither. Both `requires` entries are
mandatory and the names are a closed set — a run that skipped the preflight cannot
produce a page.
