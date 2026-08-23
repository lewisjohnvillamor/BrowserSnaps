import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function load(file, extra = {}) {
  const scope = { self: {}, chrome: { scripting: {} }, ...extra };
  new Function("self", "chrome", fs.readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"))(scope.self, scope.chrome);
  return scope.self;
}

const Score = load("score.js").BrowserSnapsScore;
const Perf = load("perf.js").BrowserSnapsPerf;

test("every scoring curve puts p10 at 0.90 and the median at 0.50", () => {
  for (const formFactor of ["mobile", "desktop"]) {
    for (const [key, curve] of Object.entries(Score.CURVES[formFactor])) {
      assert.equal(
        Number(Score.logNormalScore(curve, curve.p10).toFixed(4)), 0.9,
        `${formFactor} ${key} p10 should score 0.90`
      );
      assert.equal(
        Number(Score.logNormalScore(curve, curve.median).toFixed(4)), 0.5,
        `${formFactor} ${key} median should score 0.50`
      );
    }
  }
});

test("the weights match Lighthouse's performance category and total 100", () => {
  assert.deepEqual(Score.WEIGHTS, { fcp: 10, si: 10, lcp: 25, tbt: 30, cls: 25 });
  assert.equal(Object.values(Score.WEIGHTS).reduce((sum, weight) => sum + weight, 0), 100);
});

test("scores fall monotonically as a metric worsens", () => {
  const curve = Score.CURVES.mobile.lcp;
  const points = [500, 1_500, 2_500, 3_200, 4_000, 6_000, 12_000].map((value) => Score.logNormalScore(curve, value));
  for (let index = 1; index < points.length; index += 1) {
    assert.ok(points[index] <= points[index - 1], `score rose from ${points[index - 1]} to ${points[index]}`);
  }
  // Lighthouse's erf is a polynomial approximation, so a very fast metric lands just under 1.
  assert.ok(points[0] > 0.999 && points[0] <= 1);
});

test("a fast page scores 100 and a slow one scores badly", () => {
  assert.equal(Score.computeScore({ fcp: 700, si: 1_100, lcp: 900, tbt: 20, cls: 0.01 }).score, 100);
  assert.ok(Score.computeScore({ fcp: 5_000, si: 9_000, lcp: 7_000, tbt: 1_500, cls: 0.4 }).score < 25);
});

test("mobile and desktop curves grade the same measurements differently", () => {
  const metrics = { fcp: 1_500, si: 2_000, lcp: 2_000, tbt: 180, cls: 0.05 };
  const mobile = Score.computeScore(metrics, "mobile").score;
  const desktop = Score.computeScore(metrics, "desktop").score;
  assert.ok(mobile > desktop, "the desktop curve should be stricter for identical numbers");
});

test("an unmeasurable metric is excluded and the partial coverage is reported", () => {
  const partial = Score.computeScore({ fcp: 700, si: null, lcp: 900, tbt: 20, cls: 0.01 });
  assert.deepEqual(partial.missing, ["si"]);
  assert.equal(partial.complete, false);
  assert.equal(partial.coverage, 0.9);
  assert.equal(partial.rows.find((row) => row.key === "si").band, "unknown");
});

test("a report with nothing measurable has no score at all", () => {
  const empty = Score.computeScore({ fcp: null, si: null, lcp: null, tbt: null, cls: null });
  assert.equal(empty.score, null);
  assert.equal(empty.coverage, 0);
});

test("total blocking time counts only the part of each task past 50ms after FCP", () => {
  const longTasks = {
    tasks: [
      { start: 100, duration: 200 },  // before FCP, ignored
      { start: 900, duration: 120 },  // 70ms blocking
      { start: 1_200, duration: 60 }, // 10ms blocking
      { start: 1_500, duration: 40 }  // under the 50ms floor
    ]
  };
  assert.equal(Perf.totalBlockingTime(longTasks, 800, 3_000), 80);
  assert.equal(Perf.totalBlockingTime(longTasks, null, 3_000), null);
});

test("a page with no long tasks blocks for zero, but an unsupported browser measures nothing", () => {
  // An observer that never fires means the page was clean, not that the metric is missing.
  assert.equal(Perf.totalBlockingTime({ tasks: [] }, 800, 3_000, true), 0);
  assert.equal(Perf.totalBlockingTime({ tasks: [] }, 800, 3_000, false), null);
});

test("visual progress runs from 0 on the first frame to 1 on the last", () => {
  const blank = [[10, 0], [10, 0], [10, 0]];
  const half = [[5, 5], [5, 5], [5, 5]];
  const done = [[0, 10], [0, 10], [0, 10]];
  const progress = Perf.visualProgress([blank, half, done]);
  assert.equal(progress[0], 0);
  assert.equal(progress.at(-1), 1);
  assert.ok(progress[1] > 0 && progress[1] < 1);
});

test("speed index is the area above the completeness curve", () => {
  // Fully painted at t=0 leaves no area above the curve.
  assert.equal(Perf.speedIndexFrom([{ time: 0, completeness: 1 }, { time: 1_000, completeness: 1 }]), 0);
  // Blank until t=1000 then complete: 1000ms of fully incomplete time.
  assert.equal(Perf.speedIndexFrom([{ time: 0, completeness: 0 }, { time: 1_000, completeness: 1 }]), 1_000);
  // Half painted for the first second, complete after: 500ms of missing area.
  assert.equal(
    Perf.speedIndexFrom([{ time: 0, completeness: 0.5 }, { time: 1_000, completeness: 1 }]),
    500
  );
  assert.equal(Perf.speedIndexFrom([{ time: 0, completeness: 0 }]), null);
});

test("histogram similarity is 1 against itself and 0 against a disjoint frame", () => {
  const a = [[10, 0], [10, 0], [10, 0]];
  const b = [[0, 10], [0, 10], [0, 10]];
  assert.equal(Perf.similarity(a, a), 1);
  assert.equal(Perf.similarity(a, b), 0);
});
