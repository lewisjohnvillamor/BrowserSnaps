/* global chrome, self */

(() => {
  const DEBUGGER_VERSION = "1.3";
  const sendCommand = (tabId, method, params = {}) => chrome.debugger.sendCommand({ tabId }, method, params);

  self.BrowserSnapsPlatform = {
    supportsDeviceMetrics: true,
    async beginCapture(tabId) {
      await chrome.debugger.attach({ tabId }, DEBUGGER_VERSION);
      await sendCommand(tabId, "Page.enable");
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
    },
    async ensureProcessor() {
      if (await chrome.offscreen.hasDocument()) return;
      await chrome.offscreen.createDocument({
        url: "src/offscreen.html",
        reasons: ["BLOBS"],
        justification: "Stitch viewport tiles and store local capture results."
      });
    },
    setDeviceMetrics: (tabId, metrics) => sendCommand(tabId, "Emulation.setDeviceMetricsOverride", metrics)
  };
})();
