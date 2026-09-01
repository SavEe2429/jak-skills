#!/usr/bin/env node
// Draw the TREE view from a spec instead of by hand.
//
//   node gen-tree.mjs <spec.json> [out.html]
//
// A tree is the same picture every run with different names in it: rows by depth,
// leaves side by side, each parent centred over its own children. That is arithmetic,
// and arithmetic written out by hand is where the "child hangs off the wrong parent's
// bus" defect comes from -- the picture still looks right, so nobody catches it.
//
// Spec:
//   title · eyebrow · desc · id      page chrome
//   root  { label, sub?, accent?, kin?, w?, children: [...] }   nested to any depth
//   legend { items: [{text, width?}], notes: [string] }
//
// Per node: label (string or [string] for two lines) · sub · w · kin (a|b|c) ·
// accent · muted. Names are never abbreviated to fit -- widen the node instead.

import { writeFileSync } from "node:fs";
import { box, legend, page, readSpec, MUTED } from "./_shared.mjs";

const spec = readSpec(process.argv);

const ROW_H = 44;
const ROW_GAP = 72; // parent bottom to child top; the bus sits at half of it
const MARGIN = 30;
const LEAF_GAP = 20;
const DEFAULT_W = [160, 160, 140];

// --- layout -----------------------------------------------------------------
// One pass down to place leaves left to right, one pass back up to centre parents.
// Doing it in that order is what guarantees a parent sits over its own children and
// not merely near them.
let cursor = MARGIN;
let maxDepth = 0;

function place(node, depth) {
  maxDepth = Math.max(maxDepth, depth);
  node.h = ROW_H;
  node.y = MARGIN - 6 + depth * (ROW_H + ROW_GAP);
  node.w ??= DEFAULT_W[Math.min(depth, DEFAULT_W.length - 1)];

  if (!node.children?.length) {
    node.x = cursor;
    cursor += node.w + LEAF_GAP;
  } else {
    for (const c of node.children) place(c, depth + 1);
    const first = node.children[0];
    const last = node.children[node.children.length - 1];
    const centre = (first.x + first.w / 2 + (last.x + last.w / 2)) / 2;
    node.x = centre - node.w / 2;
  }
  node.cx = node.x + node.w / 2;
}

place(spec.root, 0);

const contentRight = cursor - LEAF_GAP + MARGIN;
const width = Math.max(spec.width ?? 0, contentRight);
const rowsBottom = MARGIN - 6 + maxDepth * (ROW_H + ROW_GAP) + ROW_H;
const legendY = rowsBottom + 36;
const height = legendY + 24 + (spec.legend?.notes?.length ?? 0) * 22 + 20;

// --- draw -------------------------------------------------------------------
// Connectors first, so a line can never land on top of a box it merely passes.
const edges = [];
const boxes = [];

function draw(node) {
  boxes.push(box(node));
  if (!node.children?.length) return;
  const busY = node.y + node.h + ROW_GAP / 2;
  edges.push(`<path d="M${node.cx},${node.y + node.h} V${busY}" fill="none" stroke="${MUTED}" stroke-width="1"/>`);
  const xs = node.children.map((c) => c.cx);
  edges.push(
    `<path d="M${Math.min(...xs)},${busY} H${Math.max(...xs)}" fill="none" stroke="${MUTED}" stroke-width="1"/>`,
  );
  for (const c of node.children) {
    edges.push(`<path d="M${c.cx},${busY} V${c.y}" fill="none" stroke="${MUTED}" stroke-width="1"/>`);
    draw(c);
  }
}

draw(spec.root);

const body = [
  edges.join("\n      "),
  boxes.join("\n\n      "),
  legend({ x: 16, y: legendY, right: width - 16, ...(spec.legend ?? {}) }),
].join("\n\n      ");

const html = page({
  title: spec.title,
  eyebrow: spec.eyebrow ?? "Tree · for-review",
  desc: spec.desc,
  id: spec.id ?? "fr-tree",
  viewBox: `0 0 ${width} ${height}`,
  minWidth: spec.minWidth ?? 900,
  maxWidth: spec.maxWidth ?? 1300,
  body,
});

const out = process.argv[3] ?? spec.out;
writeFileSync(out, html, "utf8");
console.log(`tree: ${out}  ${width}x${height}`);
