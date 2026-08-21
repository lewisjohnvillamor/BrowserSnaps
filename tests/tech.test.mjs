import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/tech.js", import.meta.url), "utf8");
const scope = { self: {}, chrome: { scripting: {} } };
new Function("self", "chrome", source)(scope.self, scope.chrome);
const Tech = scope.self.BrowserSnapsTech;

function signals(overrides = {}) {
  return { globals: [], versions: {}, urls: [], markers: [], headers: {}, generator: "", angularVersion: "", ...overrides };
}

const names = (input) => Tech.identify(input).map((entry) => entry.name);

test("a bare page detects nothing", () => {
  assert.deepEqual(Tech.identify(signals()), []);
});

test("identifies a framework from any single signal kind", () => {
  assert.ok(names(signals({ globals: ["__NEXT_DATA__"] })).includes("Next.js"));
  assert.ok(names(signals({ markers: ["#__next"] })).includes("Next.js"));
  assert.ok(names(signals({ urls: ["https://example.com/_next/static/chunk.js"] })).includes("Next.js"));
});

test("raises confidence when independent signals agree", () => {
  const [weak] = Tech.identify(signals({ markers: ["#__next"] }));
  assert.equal(weak.confidence, "likely");

  const [strong] = Tech.identify(signals({
    globals: ["__NEXT_DATA__"],
    markers: ["#__next"],
    urls: ["https://example.com/_next/static/chunk.js"]
  }));
  assert.equal(strong.confidence, "high");
  assert.equal(strong.evidence.length, 3);
});

test("reads versions only where the page states them", () => {
  const [jquery] = Tech.identify(signals({ globals: ["jQuery"], versions: { jQuery: "3.7.1" } }));
  assert.equal(jquery.version, "3.7.1");

  const [angular] = Tech.identify(signals({ markers: ["[ng-version]"], angularVersion: "17.3.0" }));
  assert.equal(angular.name, "Angular");
  assert.equal(angular.version, "17.3.0");

  const [react] = Tech.identify(signals({ globals: ["React"] }));
  assert.equal(react.version, "");
});

test("parses versions out of the generator meta tag", () => {
  const [wordpress] = Tech.identify(signals({ generator: "WordPress 6.5.2" }));
  assert.equal(wordpress.name, "WordPress");
  assert.equal(wordpress.version, "6.5.2");
  assert.match(wordpress.evidence[0], /generator "WordPress 6\.5\.2"/);
});

test("identifies infrastructure from response headers", () => {
  const detected = Tech.identify(signals({
    headers: { "cf-ray": "8a1b2c3d4e5f", server: "cloudflare", "x-powered-by": "PHP/8.2.4" }
  }));
  const found = detected.map((entry) => entry.name);
  assert.ok(found.includes("Cloudflare"));
  assert.ok(found.includes("PHP"));
  assert.equal(detected.find((entry) => entry.name === "Cloudflare").confidence, "high");
  assert.equal(detected.find((entry) => entry.name === "PHP").version, "8.2.4");
});

test("does not attribute a header value that fails its pattern", () => {
  assert.deepEqual(names(signals({ headers: { server: "gws" } })), []);
});

test("groups detections by category in a stable order", () => {
  const groups = Tech.groupByCategory(Tech.identify(signals({
    globals: ["__NEXT_DATA__", "fbq"],
    headers: { "x-vercel-id": "iad1::abc" }
  })));
  assert.deepEqual(groups.map((group) => group.category), ["Analytics", "Framework", "Hosting"]);
  assert.deepEqual(groups.find((group) => group.category === "Framework").items.map((item) => item.name), ["Next.js"]);
});

test("every signature carries a name, a category, and at least one signal", () => {
  for (const signature of Tech.SIGNATURES) {
    assert.ok(signature.name, "signature is missing a name");
    assert.ok(signature.category, `${signature.name} is missing a category`);
    const signalKinds = [signature.globals, signature.selectors, signature.urls, signature.headers, signature.meta]
      .filter(Boolean).length;
    assert.ok(signalKinds > 0, `${signature.name} has no detectable signal`);
  }
});

test("every global a signature relies on is one the collector probes", () => {
  const probed = new Set(Tech.PAGE_GLOBALS);
  for (const signature of Tech.SIGNATURES) {
    for (const name of signature.globals || []) {
      assert.ok(probed.has(name), `${signature.name} relies on window.${name}, which is never collected`);
    }
  }
});

test("signature names are unique", () => {
  const names = Tech.SIGNATURES.map((signature) => signature.name);
  assert.equal(new Set(names).size, names.length);
});
