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
      observe("longtask", (entries, seen = { count: 0, total: 0, tasks: [] }) => ({
        count: seen.count + entries.length,
        total: seen.total + entries.reduce((sum, entry) => sum + entry.duration, 0),
        tasks: [...seen.tasks, ...entries.map((entry) => ({ start: entry.startTime, duration: entry.duration }))]
      }))
    ]);

    const supportedTypes = PerformanceObserver.supportedEntryTypes || [];
    const supports = {
      layoutShift: supportedTypes.includes("layout-shift"),
      longTask: supportedTypes.includes("longtask")
    };
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
        tbt: null,
        si: null,
        lcp: lcp ?? null,
        fcp: fcp ?? null,
        cls: cls ?? (supports.layoutShift ? 0 : null),
        ttfb: navigation ? navigation.responseStart : null,
        domContentLoaded: navigation ? navigation.domContentLoadedEventEnd : null,
        load: navigation ? navigation.loadEventEnd : null
      },
      longTasks: longTasks || { count: 0, total: 0, tasks: [] },
      supports,
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

  // Lighthouse measures TBT between FCP and Time to Interactive. TTI needs a trace,
  // so this uses FCP to the load event, which is the closest window observable here.
  function totalBlockingTime(longTasks, fcp, loadTime, supported = true) {
    if (fcp === null || fcp === undefined) return null;
    if (!longTasks?.tasks?.length) return supported ? 0 : null;
    const end = loadTime || Infinity;
    return longTasks.tasks
      .filter((task) => task.start + task.duration > fcp && task.start < end)
      .reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
  }

  const HISTOGRAM_BINS = 16;

  // Histogram intersection: how much of the final frame's colour distribution a frame already shows.
  function similarity(first, second) {
    let matched = 0;
    let total = 0;
    for (let channel = 0; channel < first.length; channel += 1) {
      for (let bin = 0; bin < first[channel].length; bin += 1) {
        matched += Math.min(first[channel][bin], second[channel][bin]);
        total += second[channel][bin];
      }
    }
    return total ? matched / total : 0;
  }

  // Normalised against the first frame so the filmstrip runs 0 to 1, as speedline does.
  function visualProgress(histograms) {
    if (histograms.length < 2) return histograms.map(() => 1);
    const final = histograms.at(-1);
    const base = similarity(histograms[0], final);
    const span = 1 - base;
    return histograms.map((histogram, index) => {
      if (index === histograms.length - 1) return 1;
      if (span <= 0) return index === 0 ? 0 : 1;
      return Math.min(1, Math.max(0, (similarity(histogram, final) - base) / span));
    });
  }

  // Speed Index is the area above the visual-completeness curve.
  function speedIndexFrom(points) {
    if (points.length < 2) return null;
    let index = 0;
    for (let step = 1; step < points.length; step += 1) {
      const elapsed = points[step].time - points[step - 1].time;
      if (elapsed <= 0) continue;
      index += elapsed * (1 - points[step - 1].completeness);
    }
    return index;
  }

  async function histogramFromFrame(data, width = 120) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
    const height = Math.max(1, Math.round((bitmap.height / bitmap.width) * width));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const { data: pixels } = context.getImageData(0, 0, width, height);
    const histogram = [new Uint32Array(HISTOGRAM_BINS), new Uint32Array(HISTOGRAM_BINS), new Uint32Array(HISTOGRAM_BINS)];
    const divisor = 256 / HISTOGRAM_BINS;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      histogram[0][Math.min(HISTOGRAM_BINS - 1, Math.floor(pixels[offset] / divisor))] += 1;
      histogram[1][Math.min(HISTOGRAM_BINS - 1, Math.floor(pixels[offset + 1] / divisor))] += 1;
      histogram[2][Math.min(HISTOGRAM_BINS - 1, Math.floor(pixels[offset + 2] / divisor))] += 1;
    }
    return histogram.map((channel) => [...channel]);
  }

  async function filmstripSpeedIndex(frames) {
    if (!frames?.length || frames.length < 2) return null;
    try {
      const histograms = [];
      for (const frame of frames) histograms.push(await histogramFromFrame(frame.data));
      const progress = visualProgress(histograms);
      return speedIndexFrom(frames.map((frame, index) => ({ time: frame.time, completeness: progress[index] })));
    } catch (_) {
      // Frame decoding is unavailable in this context, so Speed Index is simply absent.
      return null;
    }
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

  async function measure(tabId, network, frames) {
    const report = await chrome.scripting
      .executeScript({ target: { tabId }, func: collectMetrics })
      .then(([injection]) => injection.result);
    if (network) report.network = network;
    report.metrics.tbt = totalBlockingTime(
      report.longTasks,
      report.metrics.fcp,
      report.metrics.load,
      report.supports?.longTask !== false
    );
    report.metrics.si = await filmstripSpeedIndex(frames);
    report.frameCount = frames?.length || 0;
    const { findings, counts } = evaluate(report);
    return { ...report, findings, counts, measuredWith: network ? "devtools" : "performance-api" };
  }

  self.BrowserSnapsPerf = {
    THRESHOLDS,
    WEIGHT_BUDGETS,
    countSeverities,
    evaluate,
    filmstripSpeedIndex,
    formatBytes,
    formatMetric,
    measure,
    metricRows,
    rate,
    similarity,
    speedIndexFrom,
    totalBlockingTime,
    visualProgress,
    weightRows
  };
})();
