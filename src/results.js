/* global BrowserSnapsPdf, BrowserSnapsStore, BrowserSnapsZip, OffscreenCanvas, chrome, createImageBitmap */

const elements = {
  captureImage: document.querySelector("#capture-image"),
  captureList: document.querySelector("#capture-list"),
  captureMeta: document.querySelector("#capture-meta"),
  captureTitle: document.querySelector("#capture-title"),
  counter: document.querySelector("#counter"),
  downloadBoth: document.querySelector("#download-both"),
  downloadPdf: document.querySelector("#download-pdf"),
  downloadPng: document.querySelector("#download-png"),
  layout: document.querySelector("#layout"),
  loading: document.querySelector("#loading"),
  next: document.querySelector("#next"),
  previous: document.querySelector("#previous"),
  preview: document.querySelector("#preview"),
  sessionHost: document.querySelector("#session-host"),
  sessionTitle: document.querySelector("#session-title"),
  toast: document.querySelector("#toast"),
  zoomIn: document.querySelector("#zoom-in"),
  zoomOut: document.querySelector("#zoom-out"),
  zoomValue: document.querySelector("#zoom-value")
};

const state = {
  activeIndex: 0,
  cache: new Map(),
  objectUrl: null,
  selected: new Set(),
  session: null,
  zoom: 0
};

function sanitize(value, fallback = "capture") {
  const cleaned = String(value || "")
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return cleaned || fallback;
}

function stamp() {
  return new Date(state.session.createdAt).toISOString().slice(0, 10);
}

function baseName(suffix = "") {
  const parts = ["BrowserSnaps", sanitize(state.session.hostname), stamp()];
  if (suffix) parts.push(sanitize(suffix));
  return parts.join("-");
}

function captureFilename(capture, index) {
  const order = String(index + 1).padStart(2, "0");
  return `${order}-${sanitize(capture.pageLabel)}-${sanitize(capture.profileLabel)}.png`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { elements.toast.hidden = true; }, 5_000);
}

async function getCapture(metadata) {
  if (!state.cache.has(metadata.id)) {
    state.cache.set(metadata.id, BrowserSnapsStore.getCapture(metadata.id));
  }
  return state.cache.get(metadata.id);
}

function applyZoom() {
  const capture = state.session.captures[state.activeIndex];
  if (!capture) return;
  elements.preview.style.width = state.zoom
    ? `${Math.round(capture.width * state.zoom / 100)}px`
    : `min(100%, ${capture.width}px)`;
  elements.zoomValue.textContent = state.zoom ? `${state.zoom}%` : "Fit";
}

async function showCapture(index) {
  const captures = state.session.captures;
  state.activeIndex = (index + captures.length) % captures.length;
  const metadata = captures[state.activeIndex];
  const record = await getCapture(metadata);
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(record.blob);
  elements.captureImage.src = state.objectUrl;
  elements.captureTitle.textContent = `${metadata.pageLabel} · ${metadata.profileLabel}`;
  elements.captureMeta.textContent = `${metadata.width} × ${metadata.height}px · ${metadata.viewport}`;
  elements.counter.textContent = `${state.activeIndex + 1} / ${captures.length}`;
  elements.loading.hidden = true;
  elements.preview.hidden = false;
  applyZoom();
  renderList();
}

function renderList() {
  elements.captureList.innerHTML = "";
  state.session.captures.forEach((capture, index) => {
    const row = document.createElement("div");
    row.className = `capture-item${index === state.activeIndex ? " active" : ""}`;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = state.selected.has(capture.id);
    input.setAttribute("aria-label", "Include in export");
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const details = document.createElement("span");
    title.textContent = capture.pageLabel;
    details.textContent = `${capture.profileLabel} · ${capture.viewport}`;
    copy.append(title, details);
    row.append(input, copy);
    row.addEventListener("click", (event) => {
      if (event.target.matches("input")) return;
      showCapture(index);
    });
    input.addEventListener("change", (event) => {
      if (event.target.checked) state.selected.add(capture.id);
      else state.selected.delete(capture.id);
    });
    elements.captureList.appendChild(row);
  });
}

function selectedMetadata() {
  return state.session.captures.filter((capture) => state.selected.has(capture.id));
}

function groupedCaptures(captures) {
  if (elements.layout.value === "combined") return [{ label: "", captures }];
  const groups = new Map();
  for (const capture of captures) {
    if (!groups.has(capture.profileId)) groups.set(capture.profileId, { label: capture.profileLabel, captures: [] });
    groups.get(capture.profileId).captures.push(capture);
  }
  return [...groups.values()];
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error || new Error("Could not encode the screenshot."));
    reader.readAsDataURL(blob);
  });
}

async function createPdfBlob(captures) {
  const pdfCaptures = [];
  for (const metadata of captures) {
    const capture = await getCapture(metadata);
    const bitmap = await createImageBitmap(capture.blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0);
    bitmap.close();
    const jpeg = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
    pdfCaptures.push({ data: await blobToBase64(jpeg), width: capture.width, height: capture.height });
  }
  return new Blob([BrowserSnapsPdf.createPdf(pdfCaptures)], { type: "application/pdf" });
}

async function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename, saveAs: false });
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function pngFiles(captures, folder = "") {
  const files = [];
  for (const metadata of captures) {
    const index = state.session.captures.findIndex((capture) => capture.id === metadata.id);
    const record = await getCapture(metadata);
    files.push({ name: `${folder}${captureFilename(metadata, index)}`, blob: record.blob });
  }
  return files;
}

async function exportGroup(group, format) {
  const suffix = group.label || "All";
  if (format === "pdf") {
    await downloadBlob(await createPdfBlob(group.captures), `${baseName(suffix)}.pdf`);
    return;
  }

  const images = await pngFiles(group.captures, group.label ? `${sanitize(group.label)}/` : "PNG/");
  if (format === "png" && group.captures.length === 1) {
    await downloadBlob(images[0].blob, `${baseName(suffix)}.png`);
    return;
  }

  const files = [...images];
  if (format === "both") files.unshift({ name: `${baseName(suffix)}.pdf`, blob: await createPdfBlob(group.captures) });
  await downloadBlob(await BrowserSnapsZip.createZip(files), `${baseName(suffix)}.zip`);
}

async function startExport(format) {
  const captures = selectedMetadata();
  if (!captures.length) return showToast("Select at least one capture to export.");
  const buttons = [elements.downloadPdf, elements.downloadPng, elements.downloadBoth];
  buttons.forEach((button) => { button.disabled = true; });
  try {
    showToast("Preparing download…");
    for (const group of groupedCaptures(captures)) await exportGroup(group, format);
    showToast("Download ready.");
  } catch (error) {
    showToast(`Export failed: ${error.message}`);
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

elements.previous.addEventListener("click", () => showCapture(state.activeIndex - 1));
elements.next.addEventListener("click", () => showCapture(state.activeIndex + 1));
elements.zoomOut.addEventListener("click", () => {
  state.zoom = state.zoom === 0 ? 75 : Math.max(25, state.zoom - 25);
  applyZoom();
});
elements.zoomIn.addEventListener("click", () => {
  state.zoom = state.zoom === 0 ? 100 : Math.min(200, state.zoom + 25);
  applyZoom();
});
elements.downloadPdf.addEventListener("click", () => startExport("pdf"));
elements.downloadPng.addEventListener("click", () => startExport("png"));
elements.downloadBoth.addEventListener("click", () => startExport("both"));
document.querySelector("#select-all").addEventListener("click", () => {
  state.session.captures.forEach((capture) => state.selected.add(capture.id));
  renderList();
});
document.querySelector("#select-none").addEventListener("click", () => {
  state.selected.clear();
  renderList();
});

(async () => {
  try {
    const parameters = new URLSearchParams(location.search);
    const errorMessage = parameters.get("error");
    if (errorMessage) throw new Error(`Capture failed: ${errorMessage}`);
    const sessionId = parameters.get("session");
    if (!sessionId) throw new Error("The capture session is missing.");
    state.session = await BrowserSnapsStore.getSession(sessionId);
    if (!state.session?.captures?.length) throw new Error("These capture results have expired.");
    state.session.captures.forEach((capture) => state.selected.add(capture.id));
    elements.sessionTitle.textContent = state.session.title;
    elements.sessionHost.textContent = state.session.hostname;
    elements.layout.value = state.session.outputLayout || "combined";
    [elements.downloadPdf, elements.downloadPng, elements.downloadBoth].forEach((button) => button.classList.remove("primary"));
    elements[state.session.outputFormat === "pdf" ? "downloadPdf" : state.session.outputFormat === "png" ? "downloadPng" : "downloadBoth"].classList.add("primary");
    renderList();
    await showCapture(0);
  } catch (error) {
    elements.loading.textContent = error.message;
  }
})();
