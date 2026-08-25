import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/sync.js", import.meta.url), "utf8");
// No chrome.runtime.id and no document, so only the pure helpers are exported.
const scope = { self: {}, chrome: undefined, document: undefined };
new Function("self", "chrome", "document", source)(scope.self, scope.chrome, scope.document);
const Sync = scope.self.BrowserSnapsSync;

const control = (overrides = {}) => ({
  tag: "a", role: "link", id: "", name: "", testId: "", href: "", text: "", type: "", placeholder: "", path: "",
  ...overrides
});

test("never syncs a password field", () => {
  assert.equal(Sync.isSensitiveField({ type: "password", name: "login" }), true);
  assert.equal(Sync.isSensitiveField({ type: "PASSWORD" }), true);
});

test("never syncs a one-time code or other sensitive autocomplete", () => {
  for (const value of ["one-time-code", "current-password", "new-password", "cc-number", "cc-csc", "cc-exp"]) {
    assert.equal(Sync.isSensitiveField({ type: "text", autocomplete: value }), true, `${value} should be sensitive`);
  }
});

test("catches sensitive fields named without the right autocomplete", () => {
  for (const name of ["otp", "totp", "user_password", "cvv", "card-number", "one_time_code", "security code", "mfa"]) {
    assert.equal(Sync.isSensitiveField({ type: "text", name }), true, `${name} should be sensitive`);
  }
  assert.equal(Sync.isSensitiveField({ type: "text", placeholder: "Enter the one time code" }), true);
});

test("ordinary fields are still synced", () => {
  for (const field of [
    { type: "text", name: "email" },
    { type: "search", name: "q" },
    { type: "text", name: "passenger_name" },
    { type: "text", name: "company", placeholder: "Acme Inc" },
    { type: "textarea", name: "message" }
  ]) {
    assert.equal(Sync.isSensitiveField(field), false, `${field.name} should not be sensitive`);
  }
});

test("derives the role a control plays", () => {
  assert.equal(Sync.roleOf("a"), "link");
  assert.equal(Sync.roleOf("button"), "button");
  assert.equal(Sync.roleOf("input", "submit"), "button");
  assert.equal(Sync.roleOf("input", "checkbox"), "checkbox");
  assert.equal(Sync.roleOf("input", "email"), "textbox");
  assert.equal(Sync.roleOf("textarea"), "textbox");
  assert.equal(Sync.roleOf("div", "", "button"), "button");
});

test("a control never matches one playing a different role", () => {
  const link = control({ text: "about" });
  const field = control({ tag: "input", role: "textbox", text: "about" });
  assert.equal(Sync.score(field, link), 0);
});

test("scores stronger signals above weaker ones", () => {
  const target = control({ testId: "nav-about", id: "about", text: "about", path: "nav:0>a:1" });
  const byTestId = Sync.score(control({ testId: "nav-about", role: "link" }), target);
  const byText = Sync.score(control({ text: "about", role: "link" }), target);
  const byPath = Sync.score(control({ path: "nav:0>a:1", role: "link" }), target);
  assert.ok(byTestId > byText && byText > byPath);
});

test("prefers the visible twin when a menu is collapsed at this size", () => {
  // The About link exists twice: once in a closed mobile drawer, once in the footer.
  const target = control({ href: "https://example.com/about", text: "about" });
  const candidates = [
    { descriptor: control({ href: "https://example.com/about", text: "about" }), visible: false },
    { descriptor: control({ href: "https://example.com/about", text: "about" }), visible: true }
  ];
  assert.equal(Sync.bestMatch(candidates, target).index, 1);
});

test("a confident hidden match still beats a weak visible one", () => {
  const target = control({ testId: "nav-about", href: "https://example.com/about", text: "about" });
  const candidates = [
    { descriptor: control({ text: "about us" }), visible: true },
    { descriptor: control({ testId: "nav-about", href: "https://example.com/about", text: "about" }), visible: false }
  ];
  assert.equal(Sync.bestMatch(candidates, target).index, 1);
});

test("reports no match rather than clicking the wrong control", () => {
  const target = control({ testId: "nav-about", text: "about" });
  const candidates = [
    { descriptor: control({ text: "contact" }), visible: true },
    { descriptor: control({ tag: "button", role: "button", text: "about" }), visible: true }
  ];
  assert.equal(Sync.bestMatch(candidates, target), null);
});

test("matches a partial text label without demanding an exact string", () => {
  const target = control({ tag: "button", role: "button", text: "add to cart" });
  const candidates = [{ descriptor: control({ tag: "button", role: "button", text: "add to cart — $40" }), visible: true }];
  assert.ok(Sync.bestMatch(candidates, target));
});

test("scroll position travels as a ratio so different viewport heights line up", () => {
  // Halfway down a tall page maps to halfway down a short one.
  const ratio = Sync.scrollRatio(1_000, 3_000, 1_000);
  assert.equal(ratio, 0.5);
  assert.equal(Sync.scrollTarget(ratio, 5_000, 800), 2_100);
});

test("a page too short to scroll stays at the top", () => {
  assert.equal(Sync.scrollRatio(0, 600, 800), 0);
  assert.equal(Sync.scrollTarget(0.8, 600, 800), 0);
});

test("scroll ratios are clamped to the page", () => {
  assert.equal(Sync.scrollRatio(9_999, 2_000, 1_000), 1);
  assert.equal(Sync.scrollTarget(2, 2_000, 1_000), 1_000);
  assert.equal(Sync.scrollTarget(-1, 2_000, 1_000), 0);
});
