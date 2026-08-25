// End-to-end check for synced sessions. Needs a browser, so it is not part of npm test.
//
//   npx http-server -p 8099 docs/sync-fixture &
//   npm run build:store
//   BROWSERSNAPS_EXT=<build with host_permissions> node docs/sync-check.mjs
//
// Two things this script cannot verify in a Playwright-driven browser, both because
// Playwright holds the CDP connection and dispatches some synthetic events:
//   - Exact viewport emulation (chrome.debugger.attach fails: already attached).
//   - selectOption, which dispatches an untrusted event the agent ignores by design;
//     this script uses keyboard input instead, which is trusted.

import { chromium } from "playwright";

const EXT = process.env.BROWSERSNAPS_EXT || "./dist/extension";
const SITE = process.env.BROWSERSNAPS_FIXTURE || "http://127.0.0.1:8099/";

const context = await chromium.launchPersistentContext("", {
  headless: false,
  executablePath: process.env.BROWSERSNAPS_CHROME || undefined,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--no-sandbox"],
  viewport: null
});
let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 20000 });

const origin = context.pages()[0] || await context.newPage();
await origin.goto(SITE, { waitUntil: "load", timeout: 30000 });

await worker.evaluate(async (url) => {
  await startSyncSession(new URL(url).origin, url, [
    { id: "desktop", label: "Desktop", width: 1280, height: 800, mobile: false },
    { id: "mobile", label: "Mobile", width: 390, height: 844, mobile: true }
  ], false);
}, SITE);
await origin.waitForTimeout(4500);

const panes = context.pages().filter((p) => p !== origin);
const sized = [];
for (const pane of panes) sized.push({ pane, width: await pane.evaluate(() => window.innerWidth) });
sized.sort((a, b) => b.width - a.width);
const [desktop, mobile] = sized;
console.log("viewports:", sized.map((s) => s.width).join(" / "));

const read = (page) => page.evaluate(() => ({
  path: location.pathname,
  company: document.querySelector("#company")?.value ?? null,
  password: document.querySelector("#login_password")?.value ?? null,
  otc: document.querySelector("#otc")?.value ?? null,
  plan: document.querySelector("#plan")?.value ?? null,
  terms: document.querySelector("#terms")?.checked ?? null,
  title: document.title
}));

// The About link lives in a nav that is display:none under 600px, and again in the footer.
await desktop.pane.click('nav a[data-testid="nav-about"]');
await origin.waitForTimeout(2500);
console.log("nav    desktop:", (await read(desktop.pane)).path, "| mobile:", (await read(mobile.pane)).path);

await desktop.pane.fill("#company", "Crown Media");
await desktop.pane.fill("#login_password", "hunter2");
await desktop.pane.fill("#otc", "123456");
await origin.waitForTimeout(2000);
const typedMobile = await read(mobile.pane);
console.log("typed  mobile:", JSON.stringify({ company: typedMobile.company, password: typedMobile.password, otc: typedMobile.otc }));

// Playwright's selectOption dispatches an untrusted event, which the agent ignores by
// design, so drive the select with real keyboard input instead.
await desktop.pane.focus("#plan");
await desktop.pane.keyboard.press("ArrowDown");
await desktop.pane.check("#terms");
await desktop.pane.click("#cta");
await origin.waitForTimeout(2000);
const formMobile = await read(mobile.pane);
console.log("form   mobile:", JSON.stringify({ plan: formMobile.plan, terms: formMobile.terms, title: formMobile.title }));

// Now the reverse direction: drive the mobile pane and check the desktop follows.
await mobile.pane.fill("#company", "Reverse");
await origin.waitForTimeout(1800);
console.log("reverse desktop company:", (await read(desktop.pane)).company);

await worker.evaluate(() => stopSyncSession());
await origin.waitForTimeout(1200);
await desktop.pane.fill("#company", "After stop");
await origin.waitForTimeout(1500);
console.log("after stop, mobile company:", (await read(mobile.pane)).company);

await context.close();
