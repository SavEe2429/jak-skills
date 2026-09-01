#!/usr/bin/env node
// Screenshot each diagram at its own size, so a defect is visible.
//
// The assembled page PNG is thousands of pixels tall; a clipped label in one
// diagram is a few pixels there. Accepts a bare .svg or a wrapped .html
// page and always writes <name>.png beside it -- never over the input.

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
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
  console.error("usage: node shot-svg.mjs <file.svg|file.html> ...");
  process.exit(2);
}

const browser = await chromium.launch();
for (const file of files) {
  const isSvg = file.endsWith(".svg");
  // A bare .svg needs a document around it or fullPage screenshots hang; an .html
  // page is already one. The temp file never shares the input's name.
  const target = isSvg ? `${file}.preview.html` : file;
  if (isSvg) {
    writeFileSync(target, `<body style="margin:0;background:#f5f5f5">${readFileSync(file, "utf8")}</body>`);
  }
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  await page.goto(pathToFileURL(target).href, { waitUntil: "networkidle" });
  await page.screenshot({ path: file.replace(/\.(svg|html)$/, ".png"), fullPage: true });
  await page.close();
  if (isSvg) unlinkSync(target);
}
await browser.close();
