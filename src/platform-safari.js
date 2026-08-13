/* global self */

(() => {
  self.BrowserSnapsPlatform = {
    supportsDeviceMetrics: false,
    beginCapture: async () => {},
    endCapture: async () => {},
    ensureProcessor: async () => {},
    captureTabTile: async () => {
      throw new Error("Safari captures the active visible tab directly.");
    },
    clearDeviceMetrics: async () => {},
    setDeviceMetrics: async () => {}
  };
})();
