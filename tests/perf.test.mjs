import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/perf.js", import.meta.url), "utf8");
const scope = { self: {}, chrome: { scripting: {} } };
new Function("self", "chrome", source)(scope.self, scope.chrome);
const Perf = scope.self.BrowserSnapsPerf;

function report(overrides = {}) {
  return {
    url: "https://example.com/",
    metrics: { lcp: 1_400, fcp: 900, cls: 0.02, ttfb: 300, domContentLoaded: 1_100, load: 1_800 },
    longTasks: { count: 0, total: 0 },
    resources: {
      total: 24,
      byType: { script: { count: 6, bytes: 180_000 }, image: { count: 10, bytes: 400_000 } },
      measuredBytes: 580_000,
      opaqueResources: 0,
      thirdPartyOrigins: [],
      thirdPartyCount: 2,
      slowest: []
    },
    renderBlocking: 2,
    documentBytes: 18_000,
    ...overrides
  };
}

const ids = (input) => Perf.evaluate(input).findings.map((finding) => finding.id);

test("a fast page produces no findings", () => {
  assert.deepEqual(Perf.evaluate(report()).findings, []);
});

test("rates metrics against Google's good and poor boundaries", () => {
  const lcp = Perf.THRESHOLDS.lcp;
  assert.equal(Perf.rate(lcp.good, lcp), "good");
  assert.equal(Perf.rate(lcp.good + 1, lcp), "fair");
  assert.equal(Perf.rate(lcp.poor, lcp), "fair");
  assert.equal(Perf.rate(lcp.poor + 1, lcp), "poor");
  assert.equal(Perf.rate(null, lcp), "unknown");
});

test("escalates a poor metric to critical and a fair one to warning", () => {
  const fair = Perf.evaluate(report({ metrics: { ...report().metrics, lcp: 3_000 } })).findings;
  assert.equal(fair.find((finding) => finding.id === "metric-lcp").severity, "warning");

  const poor = Perf.evaluate(report({ metrics: { ...report().metrics, lcp: 6_000 } })).findings;
  const finding = poor.find((finding) => finding.id === "metric-lcp");
  assert.equal(finding.severity, "critical");
  assert.match(finding.detail, /6000 ms/);
});

test("does not report metrics the page could not measure", () => {
  const blank = { lcp: null, fcp: null, cls: null, ttfb: null, domContentLoaded: null, load: null };
  assert.deepEqual(ids(report({ metrics: blank })), []);
});

test("formats CLS as a ratio and timings as milliseconds", () => {
  assert.equal(Perf.formatMetric("cls", 0.1234), "0.123");
  assert.equal(Perf.formatMetric("lcp", 2499.6), "2500 ms");
  assert.equal(Perf.formatMetric("lcp", null), "not measured");
});

test("prefers DevTools byte totals over the Performance API when present", () => {
  const withTrace = report({
    network: {
      totalBytes: 4_000_000,
      byType: { script: { count: 6, bytes: 1_200_000 } },
      uncompressed: ["https://example.com/app.js"],
      requestCount: 24
    }
  });

  const findings = Perf.evaluate(withTrace).findings;
  assert.ok(findings.some((finding) => finding.id === "weight-total"));
  assert.match(findings.find((finding) => finding.id === "weight-total").title, /4\.0 MB/);
  assert.ok(findings.some((finding) => finding.id === "weight-script"));

  const uncompressed = findings.find((finding) => finding.id === "uncompressed-text");
  assert.equal(uncompressed.severity, "warning");
  assert.deepEqual(uncompressed.evidence, ["https://example.com/app.js"]);

  // The same totals rendered in the table come from the trace, not the resource entries.
  const total = Perf.weightRows(withTrace).find((row) => row.key === "total");
  assert.equal(total.bytes, "4.0 MB");
});

test("falls back to Performance API totals with no trace", () => {
  const total = Perf.weightRows(report()).find((row) => row.key === "total");
  assert.equal(total.bytes, "580 KB");
});

test("reports long tasks and third-party sprawl", () => {
  const findings = Perf.evaluate(report({
    longTasks: { count: 5, total: 1_400 },
    resources: { ...report().resources, thirdPartyCount: 14, thirdPartyOrigins: ["https://a.example", "https://b.example"] }
  })).findings;

  assert.equal(findings.find((finding) => finding.id === "long-tasks").severity, "warning");
  const sprawl = findings.find((finding) => finding.id === "third-party-sprawl");
  assert.deepEqual(sprawl.evidence, ["https://a.example", "https://b.example"]);
});

test("builds a metric row for every threshold with a verdict", () => {
  const rows = Perf.metricRows(report({ metrics: { ...report().metrics, cls: 0.4 } }));
  assert.deepEqual(rows.map((row) => row.key), ["lcp", "fcp", "ttfb", "cls", "domContentLoaded"]);
  assert.equal(rows.find((row) => row.key === "cls").verdict, "poor");
  assert.equal(rows.find((row) => row.key === "lcp").verdict, "good");
});

test("formats byte sizes across the unit boundaries", () => {
  assert.equal(Perf.formatBytes(900), "900 B");
  assert.equal(Perf.formatBytes(1_500), "2 KB");
  assert.equal(Perf.formatBytes(2_400_000), "2.4 MB");
});
