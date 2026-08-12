/* global chrome */

const DEBUGGER_VERSION = "1.3";
const TILE_OVERLAP = 80;
const TILE_DELAY = 450;
const jobs = new Map();

function sendCommand(tabId, method, params = {}) {
  return chrome.debugger.sendCommand({ tabId }, method, params);
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function updateBadge(tabId, value, color = "#2563eb") {
  chrome.action.setBadgeBackgroundColor({ tabId, color });
  chrome.action.setBadgeText({ tabId, text: value });
}

function publishStatus(tabId, update) {
  const job = jobs.get(tabId);
  if (!job) return;
  Object.assign(job, update);
  chrome.runtime.sendMessage({ type: "CAPTURE_STATUS", status: job }).catch(() => {});
}

function waitForTab(tabId, expectedUrl, timeout = 45_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("The page took too long to load.")), timeout);

    function finish(error) {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      if (error) reject(error);
      else resolve();
    }

    function listener(updatedTabId, changeInfo, tab) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      if (expectedUrl && tab.url && new URL(tab.url).origin !== new URL(expectedUrl).origin) return;
      finish();
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function loadPage(tabId, url) {
  const tab = await chrome.tabs.get(tabId);
  const currentUrl = new URL(tab.url);
  const targetUrl = new URL(url);
  currentUrl.hash = "";
  targetUrl.hash = "";
  const loaded = waitForTab(tabId, url);
  if (currentUrl.href === targetUrl.href) await chrome.tabs.reload(tabId);
  else await chrome.tabs.update(tabId, { url });
  await loaded;
}

async function applyProfile(tabId, profile, originalZoom) {
  if (profile.id === "current") {
    await sendCommand(tabId, "Emulation.clearDeviceMetricsOverride").catch(() => {});
    await chrome.tabs.setZoom(tabId, originalZoom);
    return;
  }

  await chrome.tabs.setZoom(tabId, 1);
  await sendCommand(tabId, "Emulation.setDeviceMetricsOverride", {
    width: profile.width,
    height: profile.height,
    deviceScaleFactor: 1,
    mobile: Boolean(profile.mobile),
    screenWidth: profile.width,
    screenHeight: profile.height
  });
}

async function stabilizePage(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
      const waitForImages = async (timeout) => {
        const pending = [...document.images]
          .filter((image) => !image.complete)
          .map((image) => new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          }));
        await Promise.race([Promise.all(pending), delay(timeout)]);
      };

      window.scrollTo(0, 0);
      await Promise.race([document.fonts?.ready || Promise.resolve(), delay(5_000)]);
      await waitForImages(8_000);

      const style = document.createElement("style");
      style.id = "browsersnaps-capture-style";
      style.textContent = `
        html { scroll-behavior: auto !important; }
        html, body { scrollbar-width: none !important; }
        ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
        *, *::before, *::after {
          animation-delay: 0s !important;
          animation-duration: 0s !important;
          animation-iteration-count: 1 !important;
          transition-delay: 0s !important;
          transition-duration: 0s !important;
          caret-color: transparent !important;
        }
      `;
      document.documentElement.appendChild(style);

      const documentHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight || 0
      );

      for (const element of document.querySelectorAll("body *")) {
        const computed = getComputedStyle(element);
        if (computed.position !== "fixed" && computed.position !== "sticky") continue;
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        element.__browserSnapsStyle = element.getAttribute("style");
        element.dataset.browserSnapsPositioned = "true";

        if (computed.position === "sticky") {
          element.style.setProperty("position", "relative", "important");
          element.style.setProperty("top", "auto", "important");
          element.style.setProperty("bottom", "auto", "important");
          continue;
        }

        const anchoredToBottom = computed.bottom !== "auto" && rect.top > window.innerHeight / 2;
        const top = anchoredToBottom
          ? documentHeight - (window.innerHeight - rect.bottom) - rect.height
          : rect.top + window.scrollY;
        element.style.setProperty("position", "absolute", "important");
        element.style.setProperty("top", `${Math.max(0, top)}px`, "important");
        element.style.setProperty("bottom", "auto", "important");
        element.style.setProperty("left", `${rect.left + window.scrollX}px`, "important");
        element.style.setProperty("right", "auto", "important");
        element.style.setProperty("width", `${rect.width}px`, "important");
        element.style.setProperty("height", `${rect.height}px`, "important");
      }

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        documentHeight: Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight || 0
        )
      };
    }
  });
  return result;
}

async function settleAt(tabId, requestedY) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [requestedY, TILE_DELAY],
    func: async (y, tileDelay) => {
      const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await delay(tileDelay);

      const pending = [...document.images]
        .filter((image) => !image.complete)
        .map((image) => new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        }));
      await Promise.race([Promise.all(pending), delay(2_500)]);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
        documentHeight: Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight || 0
        )
      };
    }
  });
  return result;
}

async function restorePageStyles(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      document.querySelector("#browsersnaps-capture-style")?.remove();
      for (const element of document.querySelectorAll("[data-browser-snaps-positioned]")) {
        if (element.__browserSnapsStyle === null) element.removeAttribute("style");
        else element.setAttribute("style", element.__browserSnapsStyle);
        delete element.__browserSnapsStyle;
        delete element.dataset.browserSnapsPositioned;
      }
      window.scrollTo(0, 0);
    }
  }).catch(() => {});
}

async function captureVisibleTile(tabId, windowId, currentProfile) {
  if (currentProfile) {
    const [active] = await chrome.tabs.query({ active: true, windowId });
    if (active?.id !== tabId) {
      throw new Error("Keep the page tab active until BrowserSnaps finishes capturing it.");
    }
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 90 });
    return dataUrl.slice(dataUrl.indexOf(",") + 1);
  }
  const screenshot = await sendCommand(tabId, "Page.captureScreenshot", {
    format: "jpeg",
    quality: 90,
    fromSurface: true,
    captureBeyondViewport: false
  });
  return screenshot.data;
}

async function capturePage(tabId, windowId, profile, page) {
  const metrics = await stabilizePage(tabId);
  const tiles = [];
  const step = Math.max(1, metrics.height - TILE_OVERLAP);
  let requestedY = 0;
  let documentHeight = metrics.documentHeight;
  let index = 0;

  while (true) {
    if (jobs.get(tabId)?.cancelled) throw new Error("Capture cancelled.");
    const estimatedTiles = Math.max(index + 1, Math.ceil((documentHeight - metrics.height) / step) + 1);
    publishStatus(tabId, {
      message: `Capturing ${page.label} · ${profile.label} · tile ${index + 1}/${estimatedTiles}`
    });
    const settled = await settleAt(tabId, requestedY);
    documentHeight = Math.max(documentHeight, settled.documentHeight);
    const data = await captureVisibleTile(tabId, windowId, profile.id === "current");
    tiles.push({ data, y: settled.y });
    if (profile.id === "current") await pause(100);

    const maxScroll = Math.max(0, documentHeight - settled.height);
    if (settled.y >= maxScroll) break;
    const nextY = Math.min(maxScroll, settled.y + step);
    if (nextY <= settled.y) break;
    requestedY = nextY;
    index += 1;
  }

  await restorePageStyles(tabId);
  return {
    pageLabel: page.label,
    pageUrl: page.url,
    profileLabel: profile.label,
    viewport: `${metrics.width} x ${metrics.height}`,
    viewportWidth: metrics.width,
    viewportHeight: metrics.height,
    documentHeight,
    tiles
  };
}

function safeFilename(hostname) {
  const date = new Date().toISOString().replace(/[:.]/g, "-");
  return `BrowserSnaps-${hostname.replace(/[^a-z0-9.-]/gi, "-")}-${date}.pdf`;
}

async function ensureOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: "src/offscreen.html",
    reasons: ["BLOBS"],
    justification: "Stitch viewport tiles and assemble the local PDF download."
  });
}

async function buildPdfUrl(groups) {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({ type: "BUILD_PDF", groups });
  if (!response?.ok) throw new Error(response?.error || "The PDF could not be created.");
  return response.url;
}

async function runCapture(tabId, options) {
  const originalUrl = options.originalUrl;
  const originalZoom = await chrome.tabs.getZoom(tabId);
  const originalTab = await chrome.tabs.get(tabId);
  const [{ result: originalScroll }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({ x: window.scrollX, y: window.scrollY })
  });
  const groups = [];
  const total = options.pages.length * options.profiles.length;
  let completed = 0;

  jobs.set(tabId, { running: true, cancelled: false, completed: 0, total, message: "Preparing capture…" });
  updateBadge(tabId, "0%", "#2563eb");

  try {
    await pause(500);
    await chrome.debugger.attach({ tabId }, DEBUGGER_VERSION);
    await sendCommand(tabId, "Page.enable");

    for (const page of options.pages) {
      for (const profile of options.profiles) {
        if (jobs.get(tabId)?.cancelled) throw new Error("Capture cancelled.");
        publishStatus(tabId, { message: `Loading ${page.label} · ${profile.label}…` });
        await applyProfile(tabId, profile, originalZoom);
        await loadPage(tabId, page.url);
        await pause(750);
        groups.push(await capturePage(tabId, originalTab.windowId, profile, page));
        completed += 1;
        updateBadge(tabId, `${Math.round((completed / total) * 100)}%`, "#2563eb");
        publishStatus(tabId, { completed, message: `Captured ${completed} of ${total}` });
      }
    }

    publishStatus(tabId, { message: "Stitching pages and building PDF…" });
    const objectUrl = await buildPdfUrl(groups);
    await chrome.downloads.download({
      url: objectUrl,
      filename: safeFilename(new URL(originalUrl).hostname),
      saveAs: true
    });

    updateBadge(tabId, "✓", "#16a34a");
    publishStatus(tabId, {
      running: false,
      completed: total,
      message: `Done — ${total} page view${total === 1 ? "" : "s"} saved.`
    });
  } catch (error) {
    const cancelled = jobs.get(tabId)?.cancelled;
    updateBadge(tabId, "!", cancelled ? "#64748b" : "#dc2626");
    publishStatus(tabId, {
      running: false,
      error: true,
      message: cancelled ? "Capture cancelled." : error.message
    });
  } finally {
    await restorePageStyles(tabId);
    await sendCommand(tabId, "Emulation.clearDeviceMetricsOverride").catch(() => {});
    await chrome.debugger.detach({ tabId }).catch(() => {});
    await chrome.tabs.setZoom(tabId, originalZoom).catch(() => {});
    if (options.restoreOriginal && originalUrl) {
      await loadPage(tabId, originalUrl).catch(() => {});
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (scroll) => window.scrollTo(scroll.x, scroll.y),
        args: [originalScroll]
      }).catch(() => {});
    }
    setTimeout(() => updateBadge(tabId, ""), 8_000);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_CAPTURE") {
    const { tabId, options } = message;
    if (jobs.get(tabId)?.running) {
      sendResponse({ ok: false, error: "A capture is already running in this tab." });
      return;
    }
    runCapture(tabId, options);
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "CANCEL_CAPTURE") {
    const job = jobs.get(message.tabId);
    if (job) job.cancelled = true;
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "GET_STATUS") sendResponse(jobs.get(message.tabId) || { running: false });
});
