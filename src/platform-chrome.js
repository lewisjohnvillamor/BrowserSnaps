/* global chrome, self */

(() => {
  const DEBUGGER_VERSION = "1.3";
  const MIN_COMPRESSIBLE = 1_500;
  const TEXT_TYPES = /^(text\/|application\/(javascript|json|xml|xhtml))/i;
  const TYPE_MAP = {
    Script: "script",
    Image: "image",
    Stylesheet: "stylesheet",
    Font: "font",
    Document: "document",
    XHR: "fetch",
    Fetch: "fetch",
    Media: "media"
  };

  // Lighthouse's mobile "simulated slow 4G" preset, applied rather than simulated.
  const THROTTLING = {
    network: { offline: false, latency: 150, downloadThroughput: 1_638_400 / 8, uploadThroughput: 750_000 / 8 },
    cpuRate: 4
  };
  const MAX_FRAMES = 120;

  // Per-tab request buffers, filled by the DevTools events emitted during a page load.
  const traces = new Map();
  const filmstrips = new Map();
  const sendCommand = (tabId, method, params = {}) => chrome.debugger.sendCommand({ tabId }, method, params);

  function trace(tabId) {
    if (!traces.has(tabId)) traces.set(tabId, new Map());
    return traces.get(tabId);
  }

  chrome.debugger.onEvent.addListener((source, method, params) => {
    const tabId = source.tabId;
    if (!traces.has(tabId)) return;

    if (method === "Network.responseReceived") {
      const headers = {};
      for (const [name, value] of Object.entries(params.response.headers || {})) {
        headers[name.toLowerCase()] = value;
      }
      trace(tabId).set(params.requestId, {
        url: params.response.url,
        type: TYPE_MAP[params.type] || "other",
        mimeType: params.response.mimeType || "",
        encoding: headers["content-encoding"] || "",
        bytes: 0
      });
      return;
    }

    if (method === "Network.loadingFinished") {
      const request = trace(tabId).get(params.requestId);
      if (request) request.bytes = params.encodedDataLength || 0;
    }
  });

  chrome.debugger.onEvent.addListener((source, method, params) => {
    if (method !== "Page.screencastFrame") return;
    const tabId = source.tabId;
    // The frame must be acknowledged or Chrome stops sending them.
    sendCommand(tabId, "Page.screencastFrameAck", { sessionId: params.sessionId }).catch(() => {});
    const strip = filmstrips.get(tabId);
    if (!strip || strip.frames.length >= MAX_FRAMES) return;
    strip.frames.push({ data: params.data, time: params.metadata.timestamp * 1_000 - strip.startedAt });
  });

  function summarize(requests) {
    const byType = {};
    const uncompressed = [];
    let totalBytes = 0;

    for (const request of requests) {
      byType[request.type] = byType[request.type] || { count: 0, bytes: 0 };
      byType[request.type].count += 1;
      byType[request.type].bytes += request.bytes;
      totalBytes += request.bytes;
      if (!request.encoding && request.bytes >= MIN_COMPRESSIBLE && TEXT_TYPES.test(request.mimeType)) {
        uncompressed.push(request.url);
      }
    }

    return { totalBytes, byType, uncompressed, requestCount: requests.length };
  }

  self.BrowserSnapsPlatform = {
    supportsDeviceMetrics: true,
    supportsNetworkTrace: true,
    async beginCapture(tabId) {
      await chrome.debugger.attach({ tabId }, DEBUGGER_VERSION);
      await sendCommand(tabId, "Page.enable");
      await sendCommand(tabId, "Network.enable").catch(() => {});
      traces.set(tabId, new Map());
    },
    captureTabTile: async (tabId) => {
      const screenshot = await sendCommand(tabId, "Page.captureScreenshot", {
        format: "jpeg",
        quality: 90,
        fromSurface: true,
        captureBeyondViewport: false
      });
      return screenshot.data;
    },
    clearDeviceMetrics: (tabId) => sendCommand(tabId, "Emulation.clearDeviceMetricsOverride"),
    async endCapture(tabId) {
      await sendCommand(tabId, "Emulation.clearDeviceMetricsOverride").catch(() => {});
      await chrome.debugger.detach({ tabId }).catch(() => {});
      traces.delete(tabId);
      filmstrips.delete(tabId);
    },
    async ensureProcessor() {
      if (await chrome.offscreen.hasDocument()) return;
      await chrome.offscreen.createDocument({
        url: "src/offscreen.html",
        reasons: ["BLOBS"],
        justification: "Stitch viewport tiles and store local capture results."
      });
    },
    resetNetworkTrace: async (tabId) => {
      if (traces.has(tabId)) traces.set(tabId, new Map());
    },
    supportsFilmstrip: true,
    supportsThrottling: true,
    async applyThrottling(tabId) {
      await sendCommand(tabId, "Network.emulateNetworkConditions", THROTTLING.network);
      await sendCommand(tabId, "Emulation.setCPUThrottlingRate", { rate: THROTTLING.cpuRate });
    },
    async clearThrottling(tabId) {
      await sendCommand(tabId, "Network.emulateNetworkConditions", {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1
      }).catch(() => {});
      await sendCommand(tabId, "Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => {});
    },
    async startFilmstrip(tabId) {
      const startedAt = await sendCommand(tabId, "Runtime.evaluate", { expression: "performance.timeOrigin + performance.now()", returnByValue: true })
        .then((result) => result?.result?.value)
        .catch(() => Date.now());
      filmstrips.set(tabId, { frames: [], startedAt: startedAt || Date.now() });
      await sendCommand(tabId, "Page.startScreencast", {
        format: "jpeg",
        quality: 40,
        maxWidth: 480,
        maxHeight: 480,
        everyNthFrame: 1
      }).catch(() => {});
    },
    async stopFilmstrip(tabId) {
      await sendCommand(tabId, "Page.stopScreencast").catch(() => {});
      const strip = filmstrips.get(tabId);
      filmstrips.delete(tabId);
      if (!strip) return null;
      // Frames captured before navigation carry negative offsets and are not part of the load.
      return strip.frames.filter((frame) => frame.time >= 0);
    },
    setDeviceMetrics: (tabId, metrics) => sendCommand(tabId, "Emulation.setDeviceMetricsOverride", metrics),
    takeNetworkTrace: async (tabId) => {
      if (!traces.has(tabId)) return null;
      return summarize([...trace(tabId).values()]);
    }
  };
})();
