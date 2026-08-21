/* global self */

(() => {
  self.BrowserSnapsPlatform = {
    supportsDeviceMetrics: false,
    supportsNetworkTrace: false,
    beginCapture: async () => {},
    endCapture: async () => {},
    ensureProcessor: async () => {},
    captureTabTile: async () => {
      throw new Error("Safari captures the active visible tab directly.");
    },
    clearDeviceMetrics: async () => {},
    resetNetworkTrace: async () => {},
    setDeviceMetrics: async () => {},
    takeNetworkTrace: async () => null
  };
})();
