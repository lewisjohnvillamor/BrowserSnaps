import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const background = fs.readFileSync(new URL("../src/background.js", import.meta.url), "utf8");

function boot(platformFile) {
  const listeners = [];
  const context = {
    URL,
    console,
    self: {},
    setTimeout,
    clearTimeout,
    chrome: {
      runtime: {
        onMessage: { addListener: (listener) => listeners.push(listener) },
        sendMessage: async () => {}
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL(`../src/${platformFile}`, import.meta.url), "utf8"), context);
  vm.runInContext(fs.readFileSync(new URL("../src/indicator.js", import.meta.url), "utf8"), context);
  vm.runInContext(background, context);
  return { context, listeners };
}

test("Chromium service worker starts with the DevTools platform adapter", () => {
  const { context, listeners } = boot("platform-chrome.js");
  assert.equal(context.self.BrowserSnapsPlatform.supportsDeviceMetrics, true);
  assert.equal(typeof context.self.BrowserSnapsIndicator.show, "function");
  assert.equal(listeners.length, 1);
});

test("Firefox background page starts with the visible-tab platform adapter", () => {
  const { context, listeners } = boot("platform-firefox.js");
  assert.equal(context.self.BrowserSnapsPlatform.supportsDeviceMetrics, false);
  assert.equal(listeners.length, 1);
});

test("Safari background page starts with the visible-tab platform adapter", () => {
  const { context, listeners } = boot("platform-safari.js");
  assert.equal(context.self.BrowserSnapsPlatform.supportsDeviceMetrics, false);
  assert.equal(listeners.length, 1);
});
