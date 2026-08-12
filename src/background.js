/* global chrome */

const DEBUGGER_VERSION = "1.3";
const MAX_CAPTURE_HEIGHT = 12_000;
const jobs = new Map();

function sendCommand(tabId, method, params = {}) {
  return chrome.debugger.sendCommand({ tabId }, method, params);
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function updateBadge(tabId, text, color = "#2563eb") {
  chrome.action.setBadgeBackgroundColor({ tabId, color });
  chrome.action.setBadgeText({ tabId, text });
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
  if (currentUrl.href === targetUrl.href) {
    await chrome.tabs.reload(tabId);
  } else {
    await chrome.tabs.update(tabId, { url });
  }
  await loaded;
}

async function preparePage(tabId) {
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

      await Promise.race([
        document.fonts?.ready || Promise.resolve(),
        delay(5_000)
      ]);
      await waitForImages(8_000);

      let position = 0;
      let previousHeight = 0;
      let unchanged = 0;

      for (let step = 0; step < 300; step += 1) {
        const pageHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight || 0
        );
        position = Math.min(position + Math.max(400, Math.floor(window.innerHeight * 0.8)), pageHeight);
        window.scrollTo(0, position);
        await delay(180);

        const updatedHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight || 0
        );
        unchanged = updatedHeight === previousHeight ? unchanged + 1 : 0;
        previousHeight = updatedHeight;
        if (position >= updatedHeight && unchanged >= 2) break;
      }

      window.scrollTo(0, 0);
      await waitForImages(5_000);
      await delay(750);
      return {
        width: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
        height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0)
      };
    }
  });
  return result;
}

async function applyProfile(tabId, profile) {
  await sendCommand(tabId, "Emulation.setDeviceMetricsOverride", {
    width: profile.width,
    height: profile.height,
    deviceScaleFactor: 1,
    mobile: Boolean(profile.mobile),
    screenWidth: profile.width,
    screenHeight: profile.height
  });
}

async function capturePage(tabId, profile, page) {
  await preparePage(tabId);

  const metrics = await sendCommand(tabId, "Page.getLayoutMetrics");
  const size = metrics.cssContentSize || metrics.contentSize;
  const width = profile.width;
  const fullHeight = Math.max(1, Math.ceil(size.height));
  const segmentHeight = MAX_CAPTURE_HEIGHT;
  const segmentCount = Math.ceil(fullHeight / segmentHeight);
  const captures = [];

  for (let part = 0; part < segmentCount; part += 1) {
    const y = part * segmentHeight;
    const height = Math.min(segmentHeight, fullHeight - y);
    const screenshot = await sendCommand(tabId, "Page.captureScreenshot", {
      format: "jpeg",
      quality: 88,
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { x: 0, y, width, height, scale: 1 }
    });
    captures.push({
      data: screenshot.data,
      width,
      height,
      pageLabel: page.label,
      pageUrl: page.url,
      profileLabel: profile.label,
      viewport: `${profile.width} x ${profile.height}`,
      offsetY: y,
      documentHeight: fullHeight
    });
  }

  return captures;
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
    justification: "Assemble captured screenshots into a local PDF download."
  });
}

async function buildPdfUrl(captures) {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({ type: "BUILD_PDF", captures });
  if (!response?.ok) throw new Error(response?.error || "The PDF could not be created.");
  return response.url;
}

async function runCapture(tabId, options) {
  const originalUrl = options.originalUrl;
  const originalZoom = await chrome.tabs.getZoom(tabId);
  const [{ result: originalScroll }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({ x: window.scrollX, y: window.scrollY })
  });
  const captures = [];
  const total = options.pages.length * options.profiles.length;
  let completed = 0;

  jobs.set(tabId, {
    running: true,
    cancelled: false,
    completed: 0,
    total,
    message: "Connecting to the active tab…"
  });
  updateBadge(tabId, "0%", "#2563eb");

  try {
    await chrome.tabs.setZoom(tabId, 1);
    await chrome.debugger.attach({ tabId }, DEBUGGER_VERSION);
    await sendCommand(tabId, "Page.enable");

    for (const page of options.pages) {
      if (jobs.get(tabId)?.cancelled) throw new Error("Capture cancelled.");
      for (const profile of options.profiles) {
        if (jobs.get(tabId)?.cancelled) throw new Error("Capture cancelled.");
        publishStatus(tabId, { message: `Loading ${page.label} · ${profile.label}…` });
        await applyProfile(tabId, profile);
        await loadPage(tabId, page.url);
        await pause(500);
        publishStatus(tabId, { message: `Capturing ${page.label} · ${profile.label}…` });
        captures.push(...await capturePage(tabId, profile, page));
        completed += 1;
        const percentage = Math.round((completed / total) * 100);
        updateBadge(tabId, `${percentage}%`, "#2563eb");
        publishStatus(tabId, { completed, message: `Captured ${completed} of ${total}` });
      }
    }

    publishStatus(tabId, { message: "Building PDF…" });
    const objectUrl = await buildPdfUrl(captures);
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

  if (message.type === "GET_STATUS") {
    sendResponse(jobs.get(message.tabId) || { running: false });
  }
});
