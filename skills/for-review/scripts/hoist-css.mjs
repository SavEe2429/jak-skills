#!/usr/bin/env node
// Move repeated presentation attributes on <text> into CSS classes.
//
//   node hoist-css.mjs <file.html> ...        แก้ไฟล์เดิม
//
// In three hand-authored diagrams, attributes were 69% of the SVG bytes and the text a
// reader actually sees was 19%. `font-family="'Geist Mono', monospace"` alone appeared
// often enough to cost 3,192 bytes across the three.
//
// Two rules make this safe, and both were learned by rendering and diffing:
//
//   1. CSS beats a presentation attribute, always. So a property may go in the base
//      rule only if EVERY text carries the same value -- otherwise the base rule
//      silently overrides the elements that differ. Anything with more than one value
//      gets one class per value instead.
//   2. The font stack must be copied verbatim. Adding one fallback family changed which
//      font served U+2192, and every glyph after it shifted.
//
// Verify a conversion the same way it was verified here: render before and after, and
// diff the PNGs. Anything but zero differing pixels is a bug in this script.

import { readFileSync, writeFileSync } from "node:fs";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node hoist-css.mjs <file.html> ...");
  process.exit(2);
}

// Only these. font-size and letter-spacing vary per element far too much to be worth a
// class each, and every one of them is a chance to hit rule 1.
const PROPS = ["font-family", "fill", "text-anchor", "font-weight"];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const tags = src.match(/<text[^>]*>/g) ?? [];
  if (!tags.length) {
    console.log(`${file}  ไม่มี <text>`);
    continue;
  }

  // Which values appear, and on how many elements.
  const seen = {};
  for (const p of PROPS) {
    seen[p] = new Map();
    for (const t of tags) {
      const m = t.match(new RegExp(`${p}="([^"]*)"`));
      const v = m ? m[1] : null;
      seen[p].set(v, (seen[p].get(v) ?? 0) + 1);
    }
  }

  const base = [];
  const classes = new Map(); // "prop:value" -> class name
  let n = 0;
  for (const p of PROPS) {
    const vals = [...seen[p]].filter(([v]) => v !== null);
    if (!vals.length) continue;
    const missing = seen[p].get(null) ?? 0;
    vals.sort((a, b) => b[1] - a[1]);
    // The most common value can be the base rule only when nothing lacks the attribute
    // -- an element without it would otherwise inherit a value it never asked for.
    const [top] = vals;
    if (missing === 0) {
      base.push(`${p}: ${top[0]};`);
      for (const [v] of vals.slice(1)) classes.set(`${p}:${v}`, `c${n++}`);
    } else {
      for (const [v] of vals) classes.set(`${p}:${v}`, `c${n++}`);
    }
  }

  const rules = [`    svg text { ${base.join(" ")} }`];
  const byClass = new Map();
  for (const [k, c] of classes) {
    const i = k.indexOf(":");
    byClass.set(c, `${k.slice(0, i)}: ${k.slice(i + 1)};`);
  }
  for (const [c, decl] of byClass) rules.push(`    svg .${c} { ${decl} }`);

  let out = src.replace("    svg { width: 100%;", rules.join("\n") + "\n    svg { width: 100%;");

  out = out.replace(/<text[^>]*>/g, (tag) => {
    const cls = [];
    for (const p of PROPS) {
      const m = tag.match(new RegExp(` ${p}="([^"]*)"`));
      if (!m) continue;
      const c = classes.get(`${p}:${m[1]}`);
      if (c) cls.push(c);
      // Dropped either way: a class carries it, or the base rule already says it.
      tag = tag.replace(m[0], "");
    }
    return cls.length ? tag.replace("<text", `<text class="${cls.join(" ")}"`) : tag;
  });

  writeFileSync(file, out, "utf8");
  const cut = Math.round((1 - out.length / src.length) * 100);
  console.log(`${file}  ${src.length} -> ${out.length}  (-${cut}%)  ${byClass.size} class`);
}
