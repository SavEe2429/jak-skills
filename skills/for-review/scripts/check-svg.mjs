#!/usr/bin/env node
// Measure a diagram instead of looking at it.
//
//   node check-svg.mjs <file.html> ...
//
// The screenshot pass exists because every render so far hid a defect that reads fine
// in the source. But every defect it actually caught was geometric -- a label over a
// label, a label past its box edge, a line through a box it is not talking to, two
// connectors in one lane. All four are arithmetic on bounding boxes.
//
// So the browser still runs; it just returns numbers rather than an image. Looking at
// one diagram costs ~1,400 image tokens. This costs one line per violation, and zero
// when the diagram is clean.
//
// It does not replace looking entirely: it cannot judge whether the picture answers its
// question, whether a label is honest, or whether the layout reads in five seconds.
// Those stay human. It replaces the mechanical half, which is the half that recurred.

import { pathToFileURL } from "node:url";
// The browser is an optional install, so say so plainly instead of letting a bare
// ERR_MODULE_NOT_FOUND stack be the first thing a new user of this package sees.
const { chromium } = await import("playwright-core").catch(() => {
  console.error("ต้องติดตั้ง playwright-core ก่อน:");
  console.error(`  npm install --prefix ${import.meta.dirname}`);
  process.exit(2);
});

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node check-svg.mjs <file.html> ...");
  process.exit(2);
}

const LANE = 8; // two parallel connectors closer than this read as one line

const browser = await chromium.launch();
let total = 0;

for (const file of files) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });

  const problems = await page.evaluate((LANE) => {
    const svg = document.querySelector("svg");
    if (!svg) return ["ไม่มี <svg> ในไฟล์"];
    const out = [];
    const bb = (el) => {
      const b = el.getBBox();
      return { x: b.x, y: b.y, w: b.width, h: b.height, el };
    };
    const overlap = (a, b) =>
      a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

    const texts = [...svg.querySelectorAll("text")].filter((t) => t.textContent.trim()).map(bb);
    const shapes = [...svg.querySelectorAll("rect, polygon, ellipse")]
      .map(bb)
      .filter((s) => s.w < svg.viewBox.baseVal.width * 0.95); // drop the paper backdrop

    // 1. two labels on top of each other. getBBox includes the font's ascent and
    //    descent, so two stacked lines of one label always overlap by a few pixels --
    //    calibrated against five diagrams already checked by eye, a real collision
    //    buries more than half of the shorter label.
    const span = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1);
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i];
        const b = texts[j];
        if (!overlap(a, b)) continue;
        const vy = span(a.y, a.y + a.h, b.y, b.y + b.h) / Math.min(a.h, b.h);
        const vx = span(a.x, a.x + a.w, b.x, b.x + b.w) / Math.min(a.w, b.w);
        if (vy < 0.55 || vx < 0.3) continue;
        out.push(
          `ป้ายทับป้าย: "${a.el.textContent.trim().slice(0, 28)}" กับ ` +
            `"${b.el.textContent.trim().slice(0, 28)}"`,
        );
      }
    }

    // 2. a label wider than the box it sits in. Only the box that contains the label's
    //    centre counts -- a label floating on the paper has no box to overflow.
    for (const t of texts) {
      const cx = t.x + t.w / 2;
      const cy = t.y + t.h / 2;
      const host = shapes.find((s) => cx > s.x && cx < s.x + s.w && cy > s.y && cy < s.y + s.h);
      if (!host) continue;
      if (t.x < host.x - 1 || t.x + t.w > host.x + host.w + 1) {
        out.push(
          `ป้ายล้นกล่อง: "${t.el.textContent.trim().slice(0, 36)}" ` +
            `กว้าง ${t.w.toFixed(0)} กล่องกว้าง ${host.w.toFixed(0)}`,
        );
      }
    }

    // 3. a connector crossing a box. Endpoints are excluded by dropping any box the
    //    path starts or ends inside, which is what "talking to" means here.
    const segs = [];
    for (const p of svg.querySelectorAll("path")) {
      const d = p.getAttribute("d") ?? "";
      let x = 0;
      let y = 0;
      const own = [];
      for (const m of d.matchAll(/M\s*([\d.-]+)[, ]([\d.-]+)|V\s*([\d.-]+)|H\s*([\d.-]+)/g)) {
        if (m[1] !== undefined) {
          x = +m[1];
          y = +m[2];
        } else if (m[3] !== undefined) {
          own.push({ x1: x, y1: y, x2: x, y2: +m[3] });
          y = +m[3];
        } else {
          own.push({ x1: x, y1: y, x2: +m[4], y2: y });
          x = +m[4];
        }
      }
      if (!own.length) continue;
      const ends = [
        { x: own[0].x1, y: own[0].y1 },
        { x: own[own.length - 1].x2, y: own[own.length - 1].y2 },
      ];
      for (const s of shapes) {
        const touches = ends.some(
          (e) => e.x > s.x - 3 && e.x < s.x + s.w + 3 && e.y > s.y - 3 && e.y < s.y + s.h + 3,
        );
        if (touches) continue;
        for (const g of own) {
          const lo = Math.min(g.x1, g.x2);
          const hi = Math.max(g.x1, g.x2);
          const top = Math.min(g.y1, g.y2);
          const bot = Math.max(g.y1, g.y2);
          if (hi > s.x + 1 && lo < s.x + s.w - 1 && bot > s.y + 1 && top < s.y + s.h - 1) {
            out.push(`เส้นทะลุกล่อง: ${d.slice(0, 34)} ผ่านกล่องที่ (${s.x.toFixed(0)},${s.y.toFixed(0)})`);
            break;
          }
        }
      }
      segs.push(...own);
    }

    // 4. two connectors running in the same lane, which read as one line
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const a = segs[i];
        const b = segs[j];
        const aVert = a.x1 === a.x2;
        if (aVert !== (b.x1 === b.x2)) continue;
        const gap = aVert ? Math.abs(a.x1 - b.x1) : Math.abs(a.y1 - b.y1);
        if (gap === 0 || gap >= LANE) continue;
        const ovl = aVert
          ? Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2)) -
            Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2))
          : Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2)) -
            Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2));
        if (ovl > 40) {
          out.push(
            `เส้นสองเส้นห่างกันแค่ ${gap.toFixed(0)}px ยาวซ้อนกัน ${ovl.toFixed(0)}px — อ่านเป็นเส้นเดียว`,
          );
        }
      }
    }

    return [...new Set(out)];
  }, LANE);

  await page.close();
  total += problems.length;
  if (problems.length) {
    console.log(`\n${file}  ${problems.length} จุด`);
    for (const p of problems) console.log(`  ${p}`);
  }
}

await browser.close();
if (!total) console.log(`${files.length} ผัง · ไม่พบปัญหาเชิงเรขาคณิต`);
process.exit(total ? 1 : 0);
