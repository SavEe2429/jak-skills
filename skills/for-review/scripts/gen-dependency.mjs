#!/usr/bin/env node
// Draw the DEPENDENCY view from a spec instead of by hand.
//
//   node gen-dependency.mjs <spec.json> [out.html]
//
// Ranks are rows, nodes spread evenly across each row, and every edge that does not
// need to dodge something is a plain elbow the generator can compute. Only the edges
// that have to route around a box are still authored, and those carry their own `d`.
//
// Spec:
//   title · eyebrow · desc · id · width
//   ranks  [{ label, nodes: [{ id, label, sub?, in?, x?, kin?, muted?, accent? }] }]
//   edges  [{ from, to, port? } | { d, note? }]
//   legend { items, notes }
//
// `in` prints the "n IN" badge. It is a count of in-scope importers, so a node with
// no badge is a node whose fan-in was not established -- leave it off rather than
// printing 0 and implying it was checked.

import { writeFileSync } from "node:fs";
import { badge, box, legend, page, readSpec, MUTED } from "./_shared.mjs";

const spec = readSpec(process.argv);

const NODE_W = 160;
const NODE_H = 56;
const RANK_GAP = 120;
const TOP = 32;
const MARGIN = 40;

const width = spec.width ?? 900;

// --- layout -----------------------------------------------------------------
const byId = new Map();
spec.ranks.forEach((rank, r) => {
  const y = TOP + r * RANK_GAP;
  const n = rank.nodes.length;
  // Even spread across the usable width. An explicit x wins, for the case where a
  // node has to sit under the one that imports it or the elbows cross for no reason.
  const span = width - 2 * MARGIN - NODE_W;
  rank.nodes.forEach((node, i) => {
    node.w ??= NODE_W;
    node.h = NODE_H;
    node.y = y;
    node.x = node.x ?? (n === 1 ? MARGIN + span / 2 : MARGIN + (span * i) / (n - 1));
    node.cx = node.x + node.w / 2;
    node.badge = node.in !== undefined;
    byId.set(node.id ?? (Array.isArray(node.label) ? node.label.join("") : node.label), node);
  });
});

const lastRank = spec.ranks[spec.ranks.length - 1];
const rowsBottom = lastRank.nodes[0].y + NODE_H;
const legendY = rowsBottom + 22;
const height = legendY + 24 + (spec.legend?.notes?.length ?? 0) * 22 + 20;

// --- edges ------------------------------------------------------------------
// Leaving a node, edges fan out along its bottom edge so two of them never run the
// same 20px lane -- the "two connectors indistinguishable" defect, made structural.
const outCount = new Map();
for (const e of spec.edges ?? []) if (e.from) outCount.set(e.from, (outCount.get(e.from) ?? 0) + 1);
const outSeen = new Map();
const blocked = [];

const allNodes = spec.ranks.flatMap((r) => r.nodes);

// "A line runs through a box it is not talking to" is the defect that came back after
// being fixed once, and it is invisible in the SVG source -- the path reads as a
// perfectly ordinary elbow. So the generator checks its own output against every box
// and names the edge it could not route. The fix is to give that edge an explicit `d`;
// routing it automatically would need to know which side is free, which is judgement.
function collisions(d, a, b) {
  const segs = [];
  const pts = d.matchAll(/M([\d.]+),([\d.]+)|V([\d.]+)|H([\d.]+)/g);
  let x = 0;
  let y = 0;
  for (const m of pts) {
    if (m[1] !== undefined) {
      x = +m[1];
      y = +m[2];
    } else if (m[3] !== undefined) {
      segs.push({ x1: x, y1: y, x2: x, y2: +m[3] });
      y = +m[3];
    } else {
      segs.push({ x1: x, y1: y, x2: +m[4], y2: y });
      x = +m[4];
    }
  }
  const hit = [];
  for (const n of allNodes) {
    if (n === a || n === b) continue;
    for (const s of segs) {
      const [lo, hi] = [Math.min(s.x1, s.x2), Math.max(s.x1, s.x2)];
      const [top, bot] = [Math.min(s.y1, s.y2), Math.max(s.y1, s.y2)];
      if (hi > n.x && lo < n.x + n.w && bot > n.y && top < n.y + n.h) hit.push(n);
    }
  }
  return [...new Set(hit)];
}

const edges = (spec.edges ?? []).map((e) => {
  // A hand-routed edge is checked too. It is the one most likely to be wrong: it exists
  // precisely because the automatic route failed, and it was written by counting pixels.
  if (e.d) {
    const through = collisions(e.d, byId.get(e.from), byId.get(e.to));
    if (through.length) blocked.push(`${e.note ?? e.d}  ผ่านกล่อง ${through.map((n) => n.id).join(", ")}`);
    return `<path d="${e.d}" fill="none" stroke="${MUTED}" stroke-width="1" marker-end="url(#${spec.id ?? "fr-dep"}-arrow)"/>`;
  }

  const a = byId.get(e.from);
  const b = byId.get(e.to);
  if (!a || !b) {
    console.error(`edge names a node that is not in any rank: ${e.from} -> ${e.to}`);
    process.exit(1);
  }
  const k = outSeen.get(e.from) ?? 0;
  outSeen.set(e.from, k + 1);
  const total = outCount.get(e.from);
  const sx = a.cx + (k - (total - 1) / 2) * 20;
  const sy = a.y + a.h;
  const tx = e.port ?? b.cx;
  const ty = b.y;
  // Turn just above the target rank, never at the midpoint. A midpoint elbow on an
  // edge that skips a rank runs its horizontal straight through the boxes of the rank
  // it skipped -- the picture still looks plausible, which is what makes it dangerous.
  // Edges that skip more ranks turn slightly higher so their lanes stay apart.
  const skipped = Math.max(0, Math.round((ty - sy) / RANK_GAP));
  const busY = ty - 20 - skipped * 10;
  const d = Math.abs(sx - tx) < 2 ? `M${sx},${sy} V${ty}` : `M${sx},${sy} V${busY} H${tx} V${ty}`;

  const through = collisions(d, a, b);
  if (through.length) {
    blocked.push(`${e.from} -> ${e.to}  ผ่านกล่อง ${through.map((n) => n.id).join(", ")}`);
  }
  return `<path d="${d}" fill="none" stroke="${MUTED}" stroke-width="1" marker-end="url(#${spec.id ?? "fr-dep"}-arrow)"/>`;
});

// --- draw -------------------------------------------------------------------
const labels = spec.ranks.map((r, i) =>
  r.label
    ? `<text x="16" y="${TOP + i * RANK_GAP - 12}" fill="${MUTED}" font-size="8.5" font-family="'Geist Mono', monospace" letter-spacing="0.14em">${r.label}</text>`
    : "",
);

const boxes = spec.ranks.flatMap((r) =>
  r.nodes.map((n) => box(n) + (n.in === undefined ? "" : "\n      " + badge(n, `${n.in} IN`))),
);

const body = [
  labels.filter(Boolean).join("\n      "),
  edges.join("\n      "),
  boxes.join("\n\n      "),
  legend({ x: 16, y: legendY, right: width - 16, ...(spec.legend ?? {}) }),
].join("\n\n      ");

const html = page({
  title: spec.title,
  eyebrow: spec.eyebrow ?? "Dependency graph · for-review",
  desc: spec.desc,
  id: spec.id ?? "fr-dep",
  viewBox: `0 0 ${width} ${height}`,
  minWidth: spec.minWidth ?? 900,
  maxWidth: spec.maxWidth ?? 1100,
  body,
});

const out = process.argv[3] ?? spec.out;
writeFileSync(out, html, "utf8");
console.log(`dependency: ${out}  ${width}x${height}`);

if (blocked.length) {
  console.error(`\n${blocked.length} เส้นลากทะลุกล่องที่ไม่ใช่ปลายทาง — ใส่ "d" ให้เส้นพวกนี้เอง:`);
  for (const b of blocked) console.error(`  ${b}`);
  process.exit(1);
}
