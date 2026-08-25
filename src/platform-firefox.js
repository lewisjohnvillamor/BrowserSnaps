/* global chrome, self */

(() => {
  self.BrowserSnapsPlatform = {
    supportsDeviceMetrics: false,
    supportsNetworkTrace: false,
    supportsFilmstrip: false,
    supportsThrottling: false,
    beginCapture: async () => {},
    endCapture: async () => {},
    ensureProcessor: async () => {},
    captureTabTile: async () => {
      throw new Error("Firefox captures the active visible tab directly.");
    },
    clearDeviceMetrics: async () => {},
    applyThrottling: async () => {},
    clearThrottling: async () => {},
    resetNetworkTrace: async () => {},
    startFilmstrip: async () => {},
    stopFilmstrip: async () => null,
    setDeviceMetrics: async () => {},
    takeNetworkTrace: async () => null
  };
})();
