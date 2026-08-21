/* global chrome, self */

(() => {
  // Google's Core Web Vitals boundaries. Anything past the second number is "poor".
  const THRESHOLDS = {
    lcp: { good: 2_500, poor: 4_000, label: "Largest Contentful Paint", unit: "ms" },
    fcp: { good: 1_800, poor: 3_000, label: "First Contentful Paint", unit: "ms" },
    ttfb: { good: 800, poor: 1_800, label: "Time to First Byte", unit: "ms" },
    cls: { good: 0.1, poor: 0.25, label: "Cumulative Layout Shift", unit: "" },
    domContentLoaded: { good: 2_000, poor: 4_000, label: "DOM Content Loaded", unit: "ms" }
  };

  const WEIGHT_BUDGETS = {
    total: { good: 1_600_000, poor: 3_200_000, label: "Total transferred" },
    script: { good: 500_000, poor: 1_000_000, label: "JavaScript" },
    image: { good: 1_000_000, poor: 2_000_000, label: "Images" },
    stylesheet: { good: 150_000, poor: 400_000, label: "CSS" },
    font: { good: 300_000, poor: 600_000, label: "Fonts" }
  };

  // Runs inside the page after load. Buffered observers recover entries already dispatched.
  async function collectMetrics() {
    const observe = (type, handler) => new Promise((resolve) => {
      let value;
      try {
        const observer = new PerformanceObserver((list) => {
          value = handler(list.getEntries(), value);
        });
        observer.observe({ type, buffered: true });
        requestAnimationFrame(() => requestAnimationFrame(() => {
          observer.disconnect();
          resolve(value);
        }));
      } catch (_) {
        resolve(undefined);
      }
    });

    const [lcp, cls, longTasks] = await Promise.all([
      observe("largest-contentful-paint", (entries) => entries.at(-1)?.startTime),
      observe("layout-shift", (entries, total = 0) => entries
        .filter((entry) => !entry.hadRecentInput)
        .reduce((sum, entry) => sum + entry.value, total)),
      observe("longtask", (entries, seen = { count: 0, total: 0 }) => ({
        count: seen.count + entries.length,
        total: seen.total + entries.reduce((sum, entry) => sum + entry.duration, 0)
      }))
    ]);

    const navigation = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;

    const origin = location.origin;
    const byType = {};
    const thirdParties = new Set();
    let measuredBytes = 0;
    let opaqueResources = 0;
    const slowest = [];

    for (const entry of performance.getEntriesByType("resource")) {
      const kind = entry.initiatorType === "css" || entry.initiatorType === "link"
        ? "stylesheet"
        : ["script", "img", "fetch", "xmlhttprequest", "css"].includes(entry.initiatorType)
          ? (entry.initiatorType === "img" ? "image" : entry.initiatorType === "script" ? "script" : "fetch")
          : "other";
      const bytes = entry.transferSize || 0;
      byType[kind] = byType[kind] || { count: 0, bytes: 0 };
      byType[kind].count += 1;
      byType[kind].bytes += bytes;
      measuredBytes += bytes;
      // Cross-origin responses without Timing-Allow-Origin report zero bytes.
      if (!bytes && entry.decodedBodySize === 0) opaqueResources += 1;
      try {
        const entryOrigin = new URL(entry.name).origin;
        if (entryOrigin !== origin) thirdParties.add(entryOrigin);
      } catch (_) {
        // Non-URL entries carry no origin to attribute.
      }
      slowest.push({ name: entry.name, duration: Math.round(entry.duration) });
    }

    slowest.sort((first, second) => second.duration - first.duration);

    const renderBlocking = [...document.querySelectorAll("head link[rel='stylesheet']")].length
      + [...document.querySelectorAll("head script[src]:not([async]):not([defer]):not([type='module'])")].length;

    return {
      url: location.href.split("#")[0],
      metrics: {
        lcp: lcp ?? null,
        fcp: fcp ?? null,
        cls: cls ?? null,
        ttfb: navigation ? navigation.responseStart : null,
        domContentLoaded: navigation ? navigation.domContentLoadedEventEnd : null,
        load: navigation ? navigation.loadEventEnd : null
      },
      longTasks: longTasks || { count: 0, total: 0 },
      resources: {
        total: performance.getEntriesByType("resource").length,
        byType,
        measuredBytes,
        opaqueResources,
        thirdPartyOrigins: [...thirdParties].slice(0, 12),
        thirdPartyCount: thirdParties.size,
        slowest: slowest.slice(0, 8)
      },
      renderBlocking,
      documentBytes: navigation?.transferSize || 0
    };
  }

  function rate(value, threshold) {
    if (value === null || value === undefined) return "unknown";
    if (value <= threshold.good) return "good";
    return value <= threshold.poor ? "fair" : "poor";
  }

  function formatBytes(bytes) {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
    return `${bytes} B`;
  }

  function formatMetric(key, value) {
    if (value === null || value === undefined) return "not measured";
    return key === "cls" ? value.toFixed(3) : `${Math.round(value)} ms`;
  }

  // Turns raw timings into the same finding shape the SEO audit produces.
  function evaluate(report) {
    const findings = [];
    const totalBytes = report.network?.totalBytes ?? report.resources.measuredBytes;
    const byType = report.network?.byType || report.resources.byType;

    for (const [key, threshold] of Object.entries(THRESHOLDS)) {
      const value = report.metrics[key];
      const verdict = rate(value, threshold);
      if (verdict === "good" || verdict === "unknown") continue;
      findings.push({
        id: `metric-${key}`,
        severity: verdict === "poor" ? "critical" : "warning",
        title: `${threshold.label} is ${verdict === "poor" ? "poor" : "slower than the good threshold"}`,
        detail: `${threshold.label} measured ${formatMetric(key, value)}. Google treats ${formatMetric(key, threshold.good)} or less as good and anything past ${formatMetric(key, threshold.poor)} as poor.`,
        evidence: []
      });
    }

    for (const [key, budget] of Object.entries(WEIGHT_BUDGETS)) {
      const bytes = key === "total" ? totalBytes : byType[key]?.bytes || 0;
      if (!bytes) continue;
      const verdict = rate(bytes, budget);
      if (verdict === "good" || verdict === "unknown") continue;
      findings.push({
        id: `weight-${key}`,
        severity: verdict === "poor" ? "warning" : "notice",
        title: `${budget.label} weighs ${formatBytes(bytes)}`,
        detail: `${budget.label} transferred ${formatBytes(bytes)} on this load. Staying under ${formatBytes(budget.good)} keeps the page usable on a slow connection.`,
        evidence: []
      });
    }

    if (report.longTasks.count > 0) {
      findings.push({
        id: "long-tasks",
        severity: report.longTasks.total > 1_000 ? "warning" : "notice",
        title: `${report.longTasks.count} long task${report.longTasks.count === 1 ? "" : "s"} blocked the main thread`,
        detail: `Tasks over 50 ms held the main thread for ${Math.round(report.longTasks.total)} ms in total, during which the page cannot respond to input.`,
        evidence: []
      });
    }

    if (report.renderBlocking > 4) {
      findings.push({
        id: "render-blocking",
        severity: "notice",
        title: `${report.renderBlocking} render-blocking resources in <head>`,
        detail: "Each blocking stylesheet or synchronous script in the head delays first paint until it is fetched and parsed.",
        evidence: []
      });
    }

    if (report.resources.thirdPartyCount > 8) {
      findings.push({
        id: "third-party-sprawl",
        severity: "notice",
        title: `${report.resources.thirdPartyCount} third-party origins`,
        detail: "Every extra origin costs a DNS lookup, connection, and TLS handshake before its first byte arrives.",
        evidence: report.resources.thirdPartyOrigins
      });
    }

    if (report.network?.uncompressed?.length) {
      findings.push({
        id: "uncompressed-text",
        severity: "warning",
        title: `${report.network.uncompressed.length} text responses sent uncompressed`,
        detail: "These responses carried no content-encoding. Gzip or Brotli typically removes 60 to 80 percent of text payloads.",
        evidence: report.network.uncompressed.slice(0, 8)
      });
    }

    return { findings, counts: countSeverities(findings) };
  }

  function countSeverities(findings) {
    const counts = { critical: 0, warning: 0, notice: 0 };
    for (const finding of findings) counts[finding.severity] += 1;
    return counts;
  }

  // The row set the results viewer renders as the metrics table.
  function metricRows(report) {
    return Object.entries(THRESHOLDS).map(([key, threshold]) => ({
      key,
      label: threshold.label,
      value: formatMetric(key, report.metrics[key]),
      verdict: rate(report.metrics[key], threshold)
    }));
  }

  function weightRows(report) {
    const byType = report.network?.byType || report.resources.byType;
    const totalBytes = report.network?.totalBytes ?? report.resources.measuredBytes;
    const rows = Object.entries(byType)
      .filter(([, group]) => group.count)
      .map(([key, group]) => ({ key, label: key, count: group.count, bytes: formatBytes(group.bytes) }));
    rows.sort((first, second) => second.count - first.count);
    return [{ key: "total", label: "total", count: report.resources.total, bytes: formatBytes(totalBytes) }, ...rows];
  }

  async function measure(tabId, network) {
    const report = await chrome.scripting
      .executeScript({ target: { tabId }, func: collectMetrics })
      .then(([injection]) => injection.result);
    if (network) report.network = network;
    const { findings, counts } = evaluate(report);
    return { ...report, findings, counts, measuredWith: network ? "devtools" : "performance-api" };
  }

  self.BrowserSnapsPerf = {
    THRESHOLDS,
    WEIGHT_BUDGETS,
    countSeverities,
    evaluate,
    formatBytes,
    formatMetric,
    measure,
    metricRows,
    rate,
    weightRows
  };
})();
