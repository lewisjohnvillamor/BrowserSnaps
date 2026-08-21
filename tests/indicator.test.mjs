import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/indicator.js", import.meta.url), "utf8");

function boot(executeScript) {
  const calls = [];
  const context = {
    self: {},
    chrome: {
      scripting: {
        executeScript: (injection) => {
          calls.push(injection);
          return executeScript(injection);
        }
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { calls, indicator: context.self.BrowserSnapsIndicator };
}

const injects = async () => [{ result: true }];

// Injections are built inside the VM realm, so compare them as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));

test("show renders the indicator on the captured tab and reports success", async () => {
  const { calls, indicator } = boot(injects);
  assert.equal(await indicator.show(7, { phase: "done", message: "Ready", sessionId: "abc" }), true);
  assert.equal(calls.length, 1);
  assert.deepEqual(plain(calls[0].target), { tabId: 7 });
  assert.deepEqual(plain(calls[0].args[0]), {
    phase: "done",
    message: "Ready",
    sessionId: "abc",
    tabId: 7,
    visible: true
  });
});

test("hide asks the page to conceal the indicator before a tile is captured", async () => {
  const { calls, indicator } = boot(injects);
  assert.equal(await indicator.hide(7), true);
  assert.deepEqual(plain(calls[0].args[0]), { visible: false });
});

test("show reports failure on pages that cannot host the indicator", async () => {
  const { indicator } = boot(async () => {
    throw new Error("Cannot access contents of the page.");
  });
  assert.equal(await indicator.show(7, { phase: "done" }), false);
});

test("show reports failure without injecting when the tab is gone", async () => {
  const { calls, indicator } = boot(injects);
  assert.equal(await indicator.show(undefined, { phase: "error" }), false);
  assert.equal(calls.length, 0);
});

test("the injected renderer hides an existing indicator without touching the page", async () => {
  const { calls, indicator } = boot(injects);
  await indicator.hide(7);
  const paint = calls[0].func;
  const applied = [];
  const host = { style: { setProperty: (...args) => applied.push(args) } };
  const sandbox = {
    document: {
      getElementById: (id) => (id === "browsersnaps-indicator" ? host : null)
    }
  };
  vm.createContext(sandbox);
  const result = vm.runInContext(`(${paint.toString()})({ visible: false })`, sandbox);
  assert.equal(result, true);
  assert.deepEqual(plain(applied), [["visibility", "hidden", "important"]]);
});
