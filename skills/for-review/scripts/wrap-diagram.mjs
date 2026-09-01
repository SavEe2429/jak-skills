#!/usr/bin/env node
// Wrap an SVG body in the minimal-light diagram template.
//
// Every diagram is a self-contained HTML file carrying role="img", a <title> first
// inside the <svg>, and a <desc>. That boilerplate is ~40 identical lines per diagram;
// authoring it by hand six times is how a slug or an aria-labelledby id ends up copied
// wrong.
// Author the body only, and let this stamp the contract around it.
//
//   node wrap-diagram.mjs <body.svgpart> <out.html>
//
// The body file starts with a header block, then the SVG children:
//
//   #slug     fr-tree
//   #eyebrow  Tree · for-review
//   #title    ในโฟลเดอร์นี้มีอะไรบ้าง
//   #desc     One sentence saying what the diagram shows, not how it looks.
//   #viewbox  0 0 1000 384
//   ---
//   <path .../>

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [bodyPath, outPath] = process.argv.slice(2);
if (!bodyPath || !outPath) {
  console.error("usage: node wrap-diagram.mjs <body.svgpart> <out.html>");
  process.exit(2);
}

const raw = readFileSync(resolve(bodyPath), "utf8");
const [head, ...rest] = raw.split(/^---$/m);
const body = rest.join("---").trim();
const meta = Object.fromEntries(
  head
    .split("\n")
    .filter((l) => l.startsWith("#"))
    .map((l) => {
      const m = /^#(\w+)\s+(.*)$/.exec(l.trim());
      return m ? [m[1], m[2].trim()] : null;
    })
    .filter(Boolean),
);

for (const key of ["slug", "eyebrow", "title", "desc", "viewbox"]) {
  if (!meta[key]) {
    console.error(`missing #${key} in ${bodyPath}`);
    process.exit(1);
  }
}

const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --color-paper:  #f5f5f5;
      --color-ink:    #2d3142;
      --color-muted:  #4f5d75;
      --color-accent: #eb6c36;
      --font-sans:    'Geist', system-ui, sans-serif;
      --font-serif:   'Instrument Serif', serif;
      --font-mono:    'Geist Mono', ui-monospace, monospace;
    }
    body { font-family: var(--font-sans); background: var(--color-paper); color: var(--color-ink);
           min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 3rem 2rem; }
    .frame { max-width: 1200px; width: 100%; }
    .eyebrow { font-family: var(--font-mono); font-size: 0.66rem; font-weight: 500; letter-spacing: 0.18em;
               text-transform: uppercase; color: var(--color-muted); margin-bottom: 0.5rem; }
    h1 { font-family: var(--font-serif); font-size: clamp(1.5rem, 2.4vw + 0.75rem, 2rem); font-weight: 400;
         letter-spacing: -0.02em; line-height: 1.15; margin-bottom: 1.5rem; }
    svg { width: 100%; min-width: 900px; display: block; }
  </style>
</head>
<body>
  <div class="frame">
    <p class="eyebrow">${meta.eyebrow}</p>
    <h1>${meta.title}</h1>

    <svg viewBox="${meta.viewbox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${meta.slug}-title ${meta.slug}-desc">
      <title id="${meta.slug}-title">${meta.title}</title>
      <desc id="${meta.slug}-desc">${meta.desc}</desc>
      <defs>
        <marker id="${meta.slug}-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#4f5d75"/></marker>
        <marker id="${meta.slug}-arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#eb6c36"/></marker>
        <marker id="${meta.slug}-arrow-link" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#2e5aa8"/></marker>
        <marker id="${meta.slug}-arrow-open" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polyline points="0 0, 8 3, 0 6" fill="none" stroke="#4f5d75" stroke-width="1.2"/></marker>
      </defs>

      <rect width="100%" height="100%" fill="#f5f5f5"/>

${body
  .split("\n")
  .map((l) => (l.trim() ? `      ${l}` : l))
  .join("\n")}
    </svg>
  </div>
</body>
</html>
`;

writeFileSync(resolve(outPath), html, "utf8");
console.log(`wrapped: ${outPath}`);
