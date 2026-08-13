/* global chrome */

const PROFILES = [
  { id: "current", label: "Current tab", width: 0, height: 0, mobile: false, checked: true },
  { id: "desktop", label: "Desktop", width: 1440, height: 900, mobile: false, checked: false },
  { id: "laptop", label: "Laptop", width: 1366, height: 768, mobile: false, checked: false },
  { id: "tablet", label: "Tablet", width: 768, height: 1024, mobile: true, checked: false },
  { id: "mobile", label: "Mobile", width: 390, height: 844, mobile: true, checked: false }
];

const elements = {
  siteTitle: document.querySelector("#site-title"),
  siteUrl: document.querySelector("#site-url"),
  pageList: document.querySelector("#page-list"),
  profileList: document.querySelector("#profile-list"),
  capture: document.querySelector("#capture"),
  cancel: document.querySelector("#cancel"),
  dedicated: document.querySelector("#dedicated-window"),
  outputFormat: document.querySelector("#output-format"),
  outputLayout: document.querySelector("#output-layout"),
  restore: document.querySelector("#restore-original"),
  status: document.querySelector("#status"),
  statusText: document.querySelector("#status-text"),
  statusCount: document.querySelector("#status-count"),
  progressBar: document.querySelector("#progress-bar"),
  error: document.querySelector("#error")
};

let activeTab;
let pages = [];

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = false;
}

function renderProfiles() {
  const rows = PROFILES.map((profile) => {
    const label = document.createElement("label");
    label.className = "profile";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = profile.id;
    input.checked = profile.checked;
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const dimensions = document.createElement("span");
    title.textContent = profile.label;
    dimensions.textContent = profile.width ? `${profile.width} × ${profile.height}` : "Detecting…";
    copy.append(title, dimensions);
    label.append(input, copy);
    return label;
  });
  elements.profileList.replaceChildren(...rows);
}

function renderPages() {
  elements.pageList.classList.remove("loading-list");
  const rows = pages.map((page, index) => {
    const path = new URL(page.url).pathname || "/";
    const label = document.createElement("label");
    label.className = "check-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = String(index);
    input.checked = index === 0;
    const copy = document.createElement("span");
    copy.className = "check-copy";
    const title = document.createElement("strong");
    const location = document.createElement("span");
    title.textContent = page.label;
    location.textContent = path;
    copy.append(title, location);
    label.append(input, copy);
    return label;
  });
  elements.pageList.replaceChildren(...rows);
}

async function discoverPages() {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id || !/^https?:/.test(activeTab.url || "")) {
    throw new Error("Open a normal http:// or https:// website before using BrowserSnaps.");
  }

  elements.siteTitle.textContent = activeTab.title || "Untitled page";
  elements.siteUrl.textContent = activeTab.url;

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    func: () => {
      const current = new URL(window.location.href);
      current.hash = "";
      const found = [{ label: document.title || "Current page", url: current.href }];
      const seen = new Set([current.href]);
      const selectors = "nav a[href], [role='navigation'] a[href], header a[href]";

      for (const anchor of document.querySelectorAll(selectors)) {
        try {
          const url = new URL(anchor.href, window.location.href);
          url.hash = "";
          if (!/^https?:$/.test(url.protocol) || url.origin !== current.origin || seen.has(url.href)) continue;
          const label = (anchor.innerText || anchor.getAttribute("aria-label") || anchor.title || url.pathname)
            .replace(/\s+/g, " ")
            .trim();
          if (!label) continue;
          seen.add(url.href);
          found.push({ label: label.slice(0, 100), url: url.href });
          if (found.length >= 100) break;
        } catch (_) {
          // Ignore malformed or non-web links.
        }
      }
      return {
        pages: found,
        viewport: { width: window.innerWidth, height: window.innerHeight }
      };
    }
  });

  pages = result.pages;
  const current = PROFILES.find((profile) => profile.id === "current");
  current.width = result.viewport.width;
  current.height = result.viewport.height;
  renderProfiles();
  renderPages();
}

function selectedPages() {
  return [...elements.pageList.querySelectorAll("input:checked")].map((input) => pages[Number(input.value)]);
}

function selectedProfiles() {
  const selected = new Set([...elements.profileList.querySelectorAll("input:checked")].map((input) => input.value));
  return PROFILES.filter((profile) => selected.has(profile.id));
}

function setRunning(running) {
  elements.capture.hidden = running;
  elements.cancel.hidden = !running;
  elements.status.hidden = !running;
  document.querySelectorAll("input, #select-all, #select-none").forEach((control) => {
    control.disabled = running;
  });
}

function applyStatus(status) {
  if (!status || (!status.running && !status.message)) return;
  setRunning(Boolean(status.running));
  elements.status.hidden = false;
  elements.statusText.textContent = status.message || "Working…";
  const completed = status.completed || 0;
  const total = status.total || 0;
  elements.statusCount.textContent = total ? `${completed}/${total}` : "";
  elements.progressBar.style.width = total ? `${Math.round((completed / total) * 100)}%` : "4%";
  if (status.error) showError(status.message);
}

document.querySelector("#select-all").addEventListener("click", () => {
  elements.pageList.querySelectorAll("input").forEach((input) => { input.checked = true; });
});

document.querySelector("#select-none").addEventListener("click", () => {
  elements.pageList.querySelectorAll("input").forEach((input) => { input.checked = false; });
});

elements.capture.addEventListener("click", async () => {
  elements.error.hidden = true;
  const chosenPages = selectedPages();
  const profiles = selectedProfiles();
  if (!chosenPages.length) return showError("Select at least one page.");
  if (!profiles.length) return showError("Select at least one screen size.");

  setRunning(true);
  applyStatus({ running: true, completed: 0, total: chosenPages.length * profiles.length, message: "Starting capture…" });
  const response = await chrome.runtime.sendMessage({
    type: "START_CAPTURE",
    tabId: activeTab.id,
    options: {
      originalUrl: activeTab.url,
      pages: chosenPages,
      profiles,
      dedicatedWindow: elements.dedicated.checked,
      outputFormat: elements.outputFormat.value,
      outputLayout: elements.outputLayout.value,
      restoreOriginal: elements.restore.checked
    }
  });
  if (!response?.ok) {
    setRunning(false);
    showError(response?.error || "BrowserSnaps could not start the capture.");
    return;
  }
  window.close();
});

elements.cancel.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "CANCEL_CAPTURE", tabId: activeTab.id });
  elements.statusText.textContent = "Cancelling after the current screenshot…";
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CAPTURE_STATUS") applyStatus(message.status);
});

(async () => {
  renderProfiles();
  try {
    await discoverPages();
    const status = await chrome.runtime.sendMessage({ type: "GET_STATUS", tabId: activeTab.id });
    applyStatus(status);
  } catch (error) {
    elements.pageList.classList.remove("loading-list");
    elements.pageList.textContent = "No pages available.";
    elements.capture.disabled = true;
    showError(error.message);
  }
})();
