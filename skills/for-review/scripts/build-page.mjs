#!/usr/bin/env node
// Assemble one for-review page from a manifest, then screenshot it.
//
// Each diagram is written as one self-contained HTML file. A reader who has to
// open seven of them has lost the thing the single page was for, so this inlines
// every SVG into one file with a nav strip, and saves a PNG so the picture can be
// looked at rather than trusted.
//
//   node build-page.mjs <manifest.json>
//
// Manifest:
//   title       string
//   out         output .html path, relative to the manifest
//   focus       optional symbol the Process/Sequence chains were centred on
//   requires    [{ name, status }] — which of the two outside tools actually ran
//   scope       { read: [string], skipped: [{file, reason}], note?: string }
//   sections    [{ id, heading, question, svg }] | [{ id, heading, notDrawn }]
//   suspicions  [{ observed, why, verify }]

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const manifestPath = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  console.error("usage: node build-page.mjs <manifest.json>");
  process.exit(2);
}

const base = dirname(manifestPath);
const m = JSON.parse(readFileSync(manifestPath, "utf8"));
const outPath = resolve(base, m.out);

// The structural half of the skill's self-check, run here rather than ticked by hand.
// A checklist the author grades themselves is the one that passes on the day it
// should not: the first real review shipped a scope list that had quietly collapsed
// eight test files into "components ×4 · i18n ×2".
//
// The banned words are the skill's boundary made mechanical. "coverage" reads as a
// percentage nobody measured; the severity words turn a map into a verdict.
const BANNED = /\b(coverage|blocker|major|nit|ship it)\b|\d+(\.\d+)?%/i;

function fail(problems) {
  if (!problems.length) return;
  console.error(`${manifestPath}: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

const problems = [];

for (const [i, s] of (m.sections ?? []).entries()) {
  const where = `sections[${i}] ${s.id ?? "(no id)"}`;
  if (!s.id) problems.push(`${where}: no id — it is the nav anchor`);
  if (!s.heading) problems.push(`${where}: no heading`);
  if (s.svg && s.notDrawn) problems.push(`${where}: has both svg and notDrawn`);
  if (!s.svg && !s.notDrawn) problems.push(`${where}: has neither svg nor notDrawn`);
  if (s.svg && !s.question) problems.push(`${where}: drawn without its one question`);
}

for (const [i, s] of (m.suspicions ?? []).entries()) {
  for (const field of ["observed", "why", "verify"]) {
    if (!s[field]?.trim()) problems.push(`suspicions[${i}]: no ${field}`);
  }
}

// The two outside tools the skill leans on. Recording which ones answered is what
// lets a reader tell a graph-backed scope from a read-only one, so the field is
// required and every name has to be one of the two -- a free-text list drifts into
// a changelog within two runs.
const REQUIRED_TOOLS = ["code-review-graph", "playwright-core"];
const declared = (m.requires ?? []).map((r) => r?.name);
for (const name of REQUIRED_TOOLS) {
  if (!declared.includes(name)) problems.push(`requires: no entry for ${name}`);
}
for (const [i, r] of (m.requires ?? []).entries()) {
  if (!REQUIRED_TOOLS.includes(r?.name)) problems.push(`requires[${i}]: unknown tool ${r?.name}`);
  if (!r?.status?.trim()) problems.push(`requires[${i}]: no status`);
}

// Every string that reaches the reader, checked in one pass.
const prose = [
  m.title,
  m.focus,
  ...(m.requires ?? []).map((r) => `${r.name} ${r.status}`),
  m.scope?.note,
  ...(m.scope?.read ?? []),
  ...(m.scope?.skipped ?? []).map((s) => `${s.file} ${s.reason}`),
  ...(m.sections ?? []).flatMap((s) => [s.heading, s.question, s.notDrawn]),
  ...(m.suspicions ?? []).flatMap((s) => [s.observed, s.why]),
].filter(Boolean);

for (const line of prose) {
  const hit = BANNED.exec(line);
  if (hit) problems.push(`"${hit[0]}" is a word this skill does not get to use: ${line.slice(0, 60)}`);
}

fail(problems);

const esc = (s) =>
  String(s).replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c],
  );

// A wrapped <svg> carries its own ids. Two of them on one page collide,
// so each section is scoped by wrapping rather than by rewriting the svg -- rewriting
// ids is where a renderer silently loses its markers.
// Takes the <svg> element only, so the source may be either a bare .svg or one of
// the self-contained diagram pages -- slicing to end-of-file would drag
// </body></html> in with it and the page would nest a document inside itself.
function svgBlock(section) {
  const raw = readFileSync(resolve(base, section.svg), "utf8");
  const start = raw.indexOf("<svg");
  const end = raw.lastIndexOf("</svg>");
  if (start < 0 || end < 0) {
    console.error(`no <svg> element in ${section.svg}`);
    process.exit(1);
  }
  const svg = raw.slice(start, end + "</svg>".length);
  return `<div class="fig" id="fig-${esc(section.id)}">${svg}</div>`;
}

const sections = m.sections
  .map((s) => {
    const body = s.notDrawn
      ? `<p class="undrawn">ไม่วาด · ${esc(s.notDrawn)}</p>`
      : `${svgBlock(s)}<p class="q">${esc(s.question)}</p>`;
    return `<section id="${esc(s.id)}"><h2>${esc(s.heading)}</h2>${body}</section>`;
  })
  .join("\n");

const requires = `
<section id="requires"><h2>REQUIRES</h2>
  <ul class="files req">${m.requires
    .map((r) => `<li>${esc(r.name)} <span>${esc(r.status)}</span></li>`)
    .join("")}</ul>
</section>`;

const scope = `
<section id="scope"><h2>SCOPE</h2>
  <p class="note">${esc(m.scope.note ?? `${m.scope.read.length} ไฟล์`)}</p>
  <ul class="files">${m.scope.read.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
  ${
    m.scope.skipped?.length
      ? `<p class="note">ข้ามไป ${m.scope.skipped.length} ไฟล์</p><ul class="files skipped">${m.scope.skipped
          .map((s) => `<li>${esc(s.file)} <span>${esc(s.reason)}</span></li>`)
          .join("")}</ul>`
      : ""
  }
</section>`;

const suspicions = `
<section id="suspicions"><h2>SUSPICIONS</h2>
  <ol class="sus">${m.suspicions
    .map(
      (s) =>
        `<li><p class="obs">${esc(s.observed)}</p><p class="why">${esc(s.why)}</p>` +
        `<p class="verify"><span>Verify</span> <code>${esc(s.verify)}</code></p></li>`,
    )
    .join("")}</ol>
</section>`;

const nav = [
  { id: "requires", label: "Requires" },
  { id: "scope", label: "Scope" },
  ...m.sections.map((s) => ({ id: s.id, label: s.heading })),
  { id: "suspicions", label: "Suspicions" },
]
  .map((n) => `<a href="#${esc(n.id)}">${esc(n.label)}</a>`)
  .join("");

const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(m.title)}</title>
<style>
  :root { --ink:#1a1a1a; --dim:#5b6673; --line:#d8dde3; --paper:#f7f7f5; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--paper); color:var(--ink);
         font:15px/1.6 "Segoe UI",system-ui,sans-serif; }
  nav { position:sticky; top:0; z-index:2; display:flex; flex-wrap:wrap; gap:.25rem 1rem;
        padding:.75rem 2rem; background:var(--paper); border-bottom:1px solid var(--line); }
  nav a { color:var(--dim); text-decoration:none; font-size:13px; }
  nav a:hover { color:var(--ink); }
  main { max-width:72rem; margin:0 auto; padding:2rem; }
  h1 { font-size:1.4rem; margin:0 0 .25rem; }
  h1 + p { margin:0 0 2.5rem; color:var(--dim); font-size:13px; }
  h2 { font-size:.8rem; letter-spacing:.12em; color:var(--dim); font-weight:600;
       margin:3rem 0 1rem; }
  .fig { overflow-x:auto; }
  .fig svg { max-width:100%; height:auto; }
  .q { margin:.5rem 0 0; font-size:13px; color:var(--dim); }
  .undrawn { font-size:13px; color:var(--dim); }
  .note { font-size:13px; color:var(--dim); margin:.25rem 0; }
  ul.files { margin:.5rem 0 1rem; padding-left:1.1rem; font-size:13px; }
  ul.skipped span, ul.req span { color:var(--dim); }
  ol.sus { padding-left:1.4rem; }
  ol.sus li { margin-bottom:1.5rem; }
  .obs { margin:0; }
  .why { margin:.15rem 0; color:var(--dim); font-size:13px; }
  .verify { margin:.35rem 0 0; font-size:13px; }
  .verify span { color:var(--dim); }
  code { font-family:ui-monospace,Consolas,monospace; font-size:12.5px;
         background:#fff; border:1px solid var(--line); padding:.1rem .35rem; }
</style></head>
<body>
<nav>${nav}</nav>
<main>
  <h1>${esc(m.title)}</h1>
  <p>อ่านของที่มีอยู่ ไม่ได้รันอะไร ไม่ได้ตัดสิน${m.focus ? ` · focus <code>${esc(m.focus)}</code>` : ""}</p>
  ${requires}
  ${scope}
  ${sections}
  ${suspicions}
</main>
</body></html>
`;

writeFileSync(outPath, html, "utf8");
console.log(`page: ${outPath}`);

// The screenshot is the point of the whole script: a page that was never looked at
// has only been proofread, and every render pass so far has found something the
// source read past.
try {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(pathToFileURL(outPath).href, { waitUntil: "load" });
  const png = outPath.replace(/\.html$/, ".png");
  await page.screenshot({ path: png, fullPage: true });
  await browser.close();
  console.log(`shot: ${png}`);
} catch (err) {
  // Hard failure, not a warning. A page nobody looked at is the failure mode this
  // script exists to prevent, and a warning at the bottom of a successful run is a
  // warning that gets scrolled past.
  console.error(`no screenshot (${err.message})`);
  // Point at where this script actually lives -- the hint is wrong the moment the
  // skill is installed somewhere other than the repository it was written in.
  console.error(`run: npm install --prefix ${import.meta.dirname}`);
  process.exit(1);
}
