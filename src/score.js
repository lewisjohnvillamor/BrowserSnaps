/* global self */

(() => {
  // Ported from Lighthouse (Apache-2.0): shared/statistics.js, core/config/default-config.js,
  // and core/audits/metrics/*.js. Values pinned from source so our numbers match theirs.
  const WEIGHTS = { fcp: 10, si: 10, lcp: 25, tbt: 30, cls: 25 };

  const CURVES = {
    mobile: {
      fcp: { p10: 1_800, median: 3_000 },
      si: { p10: 3_387, median: 5_800 },
      lcp: { p10: 2_500, median: 4_000 },
      tbt: { p10: 200, median: 600 },
      cls: { p10: 0.1, median: 0.25 }
    },
    desktop: {
      fcp: { p10: 934, median: 1_600 },
      si: { p10: 1_311, median: 2_300 },
      lcp: { p10: 1_200, median: 2_400 },
      tbt: { p10: 150, median: 350 },
      cls: { p10: 0.1, median: 0.25 }
    }
  };

  const LABELS = {
    fcp: "First Contentful Paint",
    si: "Speed Index",
    lcp: "Largest Contentful Paint",
    tbt: "Total Blocking Time",
    cls: "Cumulative Layout Shift"
  };

  const MIN_PASSING_SCORE = 0.9;
  const MAX_AVERAGE_SCORE = 0.899999999999999911182158029987476766109466552734375;
  const MIN_AVERAGE_SCORE = 0.5;
  const MAX_FAILING_SCORE = 0.499999999999999944488848768742172978818416595458984375;
  const INVERSE_ERFC_ONE_FIFTH = 0.9061938024368232;

  // Abramowitz and Stegun 7.1.26, the same approximation Lighthouse uses.
  function erf(value) {
    const sign = Math.sign(value);
    const x = Math.abs(value);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))));
    return sign * (1 - y * Math.exp(-x * x));
  }

  function logNormalScore({ median, p10 }, value) {
    if (median <= 0 || p10 <= 0 || p10 >= median) throw new Error("Invalid scoring curve.");
    if (value <= 0) return 1;

    const xLogRatio = Math.log(Math.max(Number.MIN_VALUE, value / median));
    const p10LogRatio = -Math.log(Math.max(Number.MIN_VALUE, p10 / median));
    const standardized = xLogRatio * INVERSE_ERFC_ONE_FIFTH / p10LogRatio;
    const percentile = (1 - erf(standardized)) / 2;

    if (value <= p10) return Math.max(MIN_PASSING_SCORE, Math.min(1, percentile));
    if (value <= median) return Math.max(MIN_AVERAGE_SCORE, Math.min(MAX_AVERAGE_SCORE, percentile));
    return Math.max(0, Math.min(MAX_FAILING_SCORE, percentile));
  }

  function band(score) {
    if (score >= 0.9) return "good";
    return score >= 0.5 ? "fair" : "poor";
  }

  // Metrics that could not be measured are excluded and their weight is redistributed,
  // which is reported so the number is never passed off as a full Lighthouse score.
  function computeScore(metrics, formFactor = "mobile") {
    const curves = CURVES[formFactor] || CURVES.mobile;
    const rows = [];
    let weighted = 0;
    let available = 0;
    const missing = [];

    for (const [key, weight] of Object.entries(WEIGHTS)) {
      const value = metrics[key];
      if (value === null || value === undefined || Number.isNaN(value)) {
        missing.push(key);
        rows.push({ key, label: LABELS[key], weight, value: null, score: null, band: "unknown" });
        continue;
      }
      const score = logNormalScore(curves[key], value);
      weighted += score * weight;
      available += weight;
      rows.push({ key, label: LABELS[key], weight, value, score, band: band(score) });
    }

    if (!available) return { score: null, rows, missing, coverage: 0, formFactor, complete: false };

    const score = Math.round((weighted / available) * 100);
    return {
      score,
      rows,
      missing,
      coverage: available / 100,
      formFactor,
      complete: missing.length === 0
    };
  }

  self.BrowserSnapsScore = { CURVES, LABELS, WEIGHTS, band, computeScore, erf, logNormalScore };
})();
