// Shared skin for the generated diagram types.
//
// Only the parametric diagrams import this. A flowchart or a sequence is authored by
// hand because its layout is a judgement; a tree and a dependency graph are the same
// picture every time with different names in the boxes, and writing those by hand is
// several hundred tokens of coordinate arithmetic per run.

export const PAPER = "#f5f5f5";
export const INK = "#2d3142";
export const MUTED = "#4f5d75";
export const ACCENT = "#eb6c36";

// Kinship tints: "these two boxes overlap, go look". Deliberately not the accent --
// a kinship pair must never read as the flagged one. Three only; a fourth group means
// the picture is carrying more than one question and should be split.
export const KIN = {
  a: { fill: "rgba(58,124,140,0.14)", stroke: "#3a7c8c" },
  b: { fill: "rgba(122,92,160,0.13)", stroke: "#7a5ca0" },
  c: { fill: "rgba(90,130,80,0.13)", stroke: "#5a8250" },
};

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export const text = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" fill="${o.fill ?? INK}" font-size="${o.size ?? 10}"` +
  `${o.weight ? ` font-weight="${o.weight}"` : ""}` +
  ` font-family="${o.mono ? MONO : SANS}"` +
  `${o.anchor ? ` text-anchor="${o.anchor}"` : ""}` +
  `${o.spacing ? ` letter-spacing="${o.spacing}"` : ""}>${esc(s)}</text>`;

// One box. `label` is the name and never gets translated or abbreviated -- the reader
// has the code open beside the page and has to be able to paste it into rg.
export function box(n) {
  const kin = n.kin ? KIN[n.kin] : null;
  const fill = kin ? kin.fill : n.muted ? "rgba(45,49,66,0.05)" : n.accent ? "rgba(235,108,54,0.08)" : "#ffffff";
  const stroke = kin ? kin.stroke : n.accent ? ACCENT : n.muted ? MUTED : INK;
  const w = kin || n.accent ? 1.2 : 1;

  const out = [`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`];
  const cx = n.x + n.w / 2;

  // Centre the whole text block inside whatever vertical room is left, rather than
  // placing each line at a fixed offset. Fixed offsets were wrong twice in one render:
  // a two-line label landed on top of its own sub, and a one-line label landed on top
  // of the badge. Both looked fine in the source.
  const lines = Array.isArray(n.label) ? n.label : [n.label];
  const size = n.labelSize ?? (lines.length > 1 ? 11.5 : 13);
  const subSize = n.subSize ?? 10;

  const top = n.y + (n.badge ? 22 : 6); // the badge owns the top strip
  const bottom = n.y + n.h - 6;
  const lineH = size + 1.5;
  const subH = n.sub ? subSize + 4 : 0;
  const blockH = lines.length * lineH + subH;
  const start = top + (bottom - top - blockH) / 2;

  lines.forEach((l, i) =>
    out.push(text(cx, start + lineH * (i + 1) - 3, l, { size, weight: 600, anchor: "middle" })),
  );
  if (n.sub) {
    out.push(text(cx, start + blockH - 3, n.sub, { size: subSize, mono: true, anchor: "middle" }));
  }
  return out.join("\n      ");
}

// The count badge on a dependency node. Chrome, so it stays muted while the content
// text around it is ink -- that contrast is what keeps the hierarchy readable.
export function badge(n, label) {
  const bx = n.x + n.w - 44;
  return (
    `<rect x="${bx}" y="${n.y + 6}" width="36" height="12" rx="2" fill="none" stroke="rgba(45,49,66,0.40)" stroke-width="0.8"/>\n      ` +
    text(bx + 18, n.y + 15, label, { size: 7.5, fill: MUTED, mono: true, anchor: "middle", spacing: "0.08em" })
  );
}

// A page identical in skin to the hand-authored diagrams, so a generated one and an
// authored one can sit in the same manifest without the reader seeing a seam.
export function page({ title, eyebrow, desc, id, viewBox, minWidth = 900, maxWidth = 1200, body }) {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --color-paper:  ${PAPER};
      --color-ink:    ${INK};
      --color-muted:  ${MUTED};
      --color-accent: ${ACCENT};
      --font-sans:    'Geist', system-ui, sans-serif;
      --font-serif:   'Instrument Serif', serif;
      --font-mono:    'Geist Mono', ui-monospace, monospace;
    }
    body { font-family: var(--font-sans); background: var(--color-paper); color: var(--color-ink);
           min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 3rem 2rem; }
    .frame { max-width: ${maxWidth}px; width: 100%; }
    .eyebrow { font-family: var(--font-mono); font-size: 0.66rem; font-weight: 500; letter-spacing: 0.18em;
               text-transform: uppercase; color: var(--color-muted); margin-bottom: 0.5rem; }
    h1 { font-family: var(--font-serif); font-size: clamp(1.5rem, 2.4vw + 0.75rem, 2rem); font-weight: 400;
         letter-spacing: -0.02em; line-height: 1.15; margin-bottom: 1.5rem; }
    svg { width: 100%; min-width: ${minWidth}px; display: block; }
  </style>
</head>
<body>
  <div class="frame">
    <p class="eyebrow">${esc(eyebrow)}</p>
    <h1>${esc(title)}</h1>

    <svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${id}-title ${id}-desc">
      <title id="${id}-title">${esc(title)}</title>
      <desc id="${id}-desc">${esc(desc)}</desc>
      <defs>
        <marker id="${id}-arrow" markerWidth="7" markerHeight="5.5" refX="6" refY="2.75" orient="auto"><polygon points="0 0, 7 2.75, 0 5.5" fill="${MUTED}"/></marker>
      </defs>

      <rect width="100%" height="100%" fill="${PAPER}"/>

      ${body}
    </svg>
  </div>
</body>
</html>
`;
}

// The footer rule plus a LEGEND row and any number of loose notes under it.
export function legend({ x, y, right, label = "LEGEND", items = [], notes = [] }) {
  const out = [`<line x1="${x}" y1="${y}" x2="${right}" y2="${y}" stroke="rgba(45,49,66,0.10)" stroke-width="0.8"/>`];
  if (items.length) {
    out.push(text(x, y + 20, label, { size: 8.5, fill: MUTED, mono: true, spacing: "0.14em" }));
    let cx = x + 84;
    for (const it of items) {
      out.push(text(cx, y + 20, it.text, { size: 10, mono: true }));
      cx += it.width ?? 340;
    }
  }
  notes.forEach((n, i) => out.push(text(x, y + 42 + i * 22, n, { size: 10, mono: true })));
  return out.join("\n      ");
}

import { readFileSync } from "node:fs";

export function readSpec(argv) {
  if (!argv[2]) {
    console.error("usage: node <generator>.mjs <spec.json> [out.html]");
    process.exit(2);
  }
  return JSON.parse(readFileSync(argv[2], "utf8"));
}
