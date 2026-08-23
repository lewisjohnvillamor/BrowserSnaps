// Records the walkthrough GIF in docs/screenshots by driving the real extension in Chromium.
//
// Two harness accommodations, both disclosed in docs/DEMO_RECORDING.md:
//   1. EXT must point at a build carrying host_permissions. A real toolbar click grants
//      the same access through activeTab, which a scripted run cannot trigger.
//   2. The popup is opened as a tab because Chromium renders the real action popup as
//      browser chrome that Playwright cannot screenshot. Only chrome.tabs.query is
//      shimmed; everything else in the popup runs against the real tab.
//
// context.route serves every browser request through Node's fetch, which is only needed
// where the browser itself has no outbound network. Remove it when running normally.
//
// Usage: BROWSERSNAPS_EXT=... node docs/demo-walkthrough.mjs

import { chromium } from "playwright";
import { PNG } from "pngjs";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;
import fs from "node:fs/promises";

const EXT = process.env.BROWSERSNAPS_EXT || "./dist/extension";
const SITE = "https://portfolio.crownmediasvc.com/";
const OUT = "./docs/screenshots";
const W = 800;
const H = 520;

const frames = [];
let recordingFrom = null;
let timer = null;
let duplicates = 0;
const marks = {};
const mark = (name) => { marks[name] = Math.max(0, frames.length - 1); };

function startRecording(page) {
  recordingFrom = page;
  if (timer) return;
  timer = setInterval(async () => {
    if (!recordingFrom) return;
    try {
      const shot = await recordingFrom.screenshot({ type: "png", timeout: 4000 });
      // Collapse static stretches so the GIF stays small and keeps moving.
      const previous = frames.at(-1);
      if (previous && previous.equals(shot)) {
        if (duplicates >= 2) return;
        duplicates += 1;
      } else {
        duplicates = 0;
      }
      frames.push(shot);
    } catch (_) { /* the page is mid-navigation */ }
  }, 600);
}
const focus = (page) => { recordingFrom = page; };
const stopRecording = () => { clearInterval(timer); timer = null; recordingFrom = null; };

const context = await chromium.launchPersistentContext("", {
  headless: false,
  executablePath: process.env.BROWSERSNAPS_CHROME || undefined,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--no-sandbox"],
  viewport: { width: W, height: H }
});

await context.route("**/*", async (route) => {
  const request = route.request();
  if (!/^https?:/i.test(request.url())) return route.continue().catch(() => {});
  try {
    const response = await fetch(request.url(), {
      method: request.method(),
      headers: request.headers(),
      body: ["GET", "HEAD"].includes(request.method()) ? undefined : request.postDataBuffer(),
      redirect: "follow"
    });
    const body = Buffer.from(await response.arrayBuffer());
    const headers = {};
    for (const [name, value] of response.headers.entries()) {
      if (!["content-encoding", "content-length"].includes(name.toLowerCase())) headers[name] = value;
    }
    await route.fulfill({ status: response.status, headers, body });
  } catch (_) {
    await route.abort().catch(() => {});
  }
});

let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 20000 });
const extensionId = new URL(worker.url()).host;

const site = context.pages()[0] || await context.newPage();
await site.goto(SITE, { waitUntil: "domcontentloaded", timeout: 60000 });
await site.waitForTimeout(3500);
console.log("site:", await site.title());

startRecording(site);
await site.waitForTimeout(2000);
mark("01-site");

// Scene: the popup. Chromium renders the real action popup as browser chrome that
// Playwright cannot screenshot, so it is opened as a tab. Only chrome.tabs.query is
// shimmed to point at the site tab; page discovery, image counting, and the capture
// message all run for real against that tab.
const tabId = await worker.evaluate(async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab.id;
});

const popup = await context.newPage();
await popup.addInitScript((id) => {
  const query = chrome.tabs.query.bind(chrome.tabs);
  chrome.tabs.query = async (info) => (info.active ? [await chrome.tabs.get(id)] : query(info));
}, tabId);
await popup.goto(`chrome-extension://${extensionId}/src/popup.html`);
await popup.waitForTimeout(2500);
focus(popup);
await popup.waitForTimeout(3000);
mark("02-popup");
await popup.locator("#lab-score").check();
await popup.waitForTimeout(1500);
console.log("popup pages:", await popup.locator("#page-list label").count());
console.log("popup images hint:", await popup.locator("#image-count").innerText());
await popup.close();

// Scene: a real capture with the audit and lab score enabled.
focus(site);
await site.bringToFront();
await worker.evaluate((args) => {
  runCapture(args.tabId, {
    originalUrl: args.url,
    pages: [{ label: "Home", url: args.url }],
    profiles: [{ id: "current", label: "Current tab", width: 0, height: 0, mobile: false }],
    dedicatedWindow: false,
    outputFormat: "both",
    outputLayout: "combined",
    restoreOriginal: true,
    labScore: true
  });
}, { tabId, url: SITE });

let status = null;
for (let tick = 0; tick < 150; tick += 1) {
  await site.waitForTimeout(1000);
  status = await worker.evaluate((id) => {
    const job = jobs.get(id) || [...jobs.values()][0];
    return job ? { running: job.running, message: job.message, sessionId: job.sessionId, error: job.error } : null;
  }, tabId).catch(() => null);
  if (status && !status.running) break;
}
console.log("capture:", JSON.stringify(status));

if (!status?.sessionId) {
  stopRecording();
  await context.close();
  throw new Error(`capture did not finish: ${status?.message}`);
}

mark("03-indicator");
await site.waitForTimeout(2500);

// Scene: the results viewer.
const results = await context.newPage();
await results.goto(`chrome-extension://${extensionId}/src/results.html?session=${status.sessionId}`);
await results.waitForTimeout(3000);
focus(results);
await results.waitForTimeout(2500);
mark("04-captures");
await results.locator("#view-audit").click();
await results.waitForTimeout(3000);
mark("05-audit");
for (let step = 0; step < 7; step += 1) {
  await results.mouse.wheel(0, 320);
  await results.waitForTimeout(700);
}
mark("06-audit-scrolled");
await results.waitForTimeout(1500);

const summary = await results.evaluate(() => {
  const report = state.session.audits?.[0];
  return {
    counts: report?.counts,
    findings: report?.findings.slice(0, 8).map((f) => `${f.severity}: ${f.title}`),
    score: report?.lab?.score ? { value: report.lab.score.score, complete: report.lab.score.complete, missing: report.lab.score.missing } : null,
    metrics: report?.lab?.metrics || report?.performance?.metrics,
    tech: report?.technology?.detected.map((t) => `${t.category}/${t.name}${t.version ? " " + t.version : ""} (${t.confidence})`),
    captures: state.session.captures.length
  };
});
console.log("RESULTS", JSON.stringify(summary, null, 2));

stopRecording();
await context.close();

// Encode the frames as an animated GIF.
console.log("frames:", frames.length);
const encoder = GIFEncoder();
for (const buffer of frames) {
  const png = PNG.sync.read(buffer);
  const data = new Uint8ClampedArray(png.data);
  const palette = quantize(data, 256, { format: "rgb565" });
  const indexed = applyPalette(data, palette, "rgb565");
  encoder.writeFrame(indexed, png.width, png.height, { palette, delay: 500 });
}
encoder.finish();
await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(`${OUT}/browser-snaps-walkthrough.gif`, Buffer.from(encoder.bytes()));
console.log("GIF written");

const stillDir = process.env.BROWSERSNAPS_STILLS || "./dist/stills";
await fs.mkdir(stillDir, { recursive: true });
for (const [name, index] of Object.entries(marks)) {
  if (frames[index]) await fs.writeFile(`${stillDir}/${name}.png`, frames[index]);
}
console.log("stills:", JSON.stringify(marks));
