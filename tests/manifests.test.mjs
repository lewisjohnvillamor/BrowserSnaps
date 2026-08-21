import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(name) {
  return JSON.parse(fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8"));
}

const chromeManifest = read("manifest.json");
const firefoxManifest = read("manifest.firefox.json");
const safariManifest = read("manifest.safari.json");

test("all browser manifests use the release version", () => {
  assert.equal(chromeManifest.version, "1.6.0");
  assert.equal(firefoxManifest.version, chromeManifest.version);
  assert.equal(safariManifest.version, chromeManifest.version);
});

test("Chromium declares only the APIs used by its capture adapter", () => {
  assert.deepEqual([...chromeManifest.permissions].sort(), ["activeTab", "debugger", "downloads", "offscreen", "scripting"]);
  assert.equal(chromeManifest.background.service_worker, "src/background.js");
});

test("Firefox excludes unsupported Chrome APIs and declares AMO metadata", () => {
  assert.deepEqual([...firefoxManifest.permissions].sort(), ["activeTab", "downloads", "scripting"]);
  assert.ok(firefoxManifest.background.scripts.includes("src/platform-firefox.js"));
  assert.ok(firefoxManifest.background.scripts.includes("src/indicator.js"));
  assert.ok(firefoxManifest.background.scripts.includes("src/audit.js"));
  assert.equal(firefoxManifest.browser_specific_settings.gecko.id, "browsersnaps@lewisjohnvillamor.github.io");
  assert.deepEqual(firefoxManifest.browser_specific_settings.gecko.data_collection_permissions.required, ["none"]);
});

test("Safari excludes unsupported Chrome APIs and loads its adapter", () => {
  assert.deepEqual([...safariManifest.permissions].sort(), ["activeTab", "downloads", "scripting"]);
  assert.ok(safariManifest.background.scripts.includes("src/platform-safari.js"));
  assert.ok(safariManifest.background.scripts.includes("src/indicator.js"));
  assert.ok(safariManifest.background.scripts.includes("src/audit.js"));
});
