/* global BrowserSnapsPdf, BrowserSnapsPerf, BrowserSnapsStore, BrowserSnapsZip, OffscreenCanvas, chrome, createImageBitmap */

const elements = {
  auditList: document.querySelector("#audit-list"),
  auditPanel: document.querySelector("#audit-panel"),
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
  sessionKind: document.querySelector("#session-kind"),
  sessionTitle: document.querySelector("#session-title"),
  viewAudit: document.querySelector("#view-audit"),
  viewCaptures: document.querySelector("#view-captures"),
  toast: document.querySelector("#toast"),
  zoomIn: document.querySelector("#zoom-in"),
  zoomOut: document.querySelector("#zoom-out"),
  zoomValue: document.querySelector("#zoom-value")
};

const state = {
  activeIndex: 0,
  view: "captures",
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

function auditReports() {
  return state.session.audits || [];
}

function findingRow(finding) {
  const row = document.createElement("div");
  row.className = "finding";
  row.dataset.severity = finding.severity;
  row.append(Object.assign(document.createElement("span"), { className: "finding-flag" }));

  const copy = document.createElement("div");
  copy.append(Object.assign(document.createElement("strong"), { textContent: finding.title }));
  copy.append(Object.assign(document.createElement("p"), { textContent: finding.detail }));
  if (finding.evidence?.length) {
    const list = document.createElement("ul");
    for (const item of finding.evidence) {
      const entry = document.createElement("li");
      entry.textContent = item;
      entry.title = item;
      list.append(entry);
    }
    copy.append(list);
  }
  row.append(copy);
  return row;
}

function tallies(counts) {
  const wrapper = document.createElement("div");
  wrapper.className = "tallies";
  const labels = { critical: "critical", warning: "warning", notice: "notice" };
  for (const severity of ["critical", "warning", "notice"]) {
    if (!counts[severity]) continue;
    const badge = document.createElement("span");
    badge.className = `tally ${severity}`;
    badge.textContent = `${counts[severity]} ${labels[severity]}`;
    wrapper.append(badge);
  }
  if (!wrapper.childElementCount) {
    const badge = document.createElement("span");
    badge.className = "tally clear";
    badge.textContent = "No issues";
    wrapper.append(badge);
  }
  return wrapper;
}

function metricsBlock(performance) {
  const block = document.createElement("div");
  block.className = "metrics";

  const heading = document.createElement("div");
  heading.className = "metrics-heading";
  heading.append(Object.assign(document.createElement("strong"), { textContent: "Performance" }));
  heading.append(Object.assign(document.createElement("span"), {
    textContent: performance.freshLoad
      ? `measured on a fresh load via ${performance.measuredWith === "devtools" ? "DevTools" : "the Performance API"}`
      : "measured from the load already open in the tab, so caches may flatter it"
  }));
  block.append(heading);

  const grid = document.createElement("div");
  grid.className = "metric-grid";
  for (const row of BrowserSnapsPerf.metricRows(performance)) {
    const cell = document.createElement("div");
    cell.className = "metric";
    cell.dataset.verdict = row.verdict;
    cell.append(Object.assign(document.createElement("span"), { className: "metric-label", textContent: row.label }));
    cell.append(Object.assign(document.createElement("strong"), { textContent: row.value }));
    grid.append(cell);
  }
  block.append(grid);

  const weights = document.createElement("table");
  weights.className = "weights";
  const header = weights.insertRow();
  for (const label of ["Resource", "Requests", "Transferred"]) {
    header.append(Object.assign(document.createElement("th"), { textContent: label }));
  }
  for (const row of BrowserSnapsPerf.weightRows(performance)) {
    const line = weights.insertRow();
    line.insertCell().textContent = row.label;
    line.insertCell().textContent = String(row.count);
    line.insertCell().textContent = row.bytes;
  }
  block.append(weights);

  if (performance.measuredWith !== "devtools" && performance.resources.opaqueResources) {
    block.append(Object.assign(document.createElement("p"), {
      className: "metrics-note",
      textContent: `${performance.resources.opaqueResources} cross-origin responses report no size without Timing-Allow-Origin, so the transferred totals are a floor, not the real weight.`
    }));
  }

  return block;
}

function auditSection(report) {
  const section = document.createElement("section");
  section.className = "audit-page";
  section.id = `audit-${encodeURIComponent(report.pageUrl)}`;

  const header = document.createElement("header");
  const heading = document.createElement("div");
  heading.append(Object.assign(document.createElement("h2"), { textContent: report.pageLabel }));
  const link = document.createElement("a");
  link.href = report.pageUrl;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = report.pageUrl;
  heading.append(link);
  header.append(heading, tallies(reportCounts(report)));
  section.append(header);

  if (report.performance) section.append(metricsBlock(report.performance));

  const findings = [...report.findings, ...(report.performance?.findings || [])];
  if (findings.length) {
    for (const finding of sortBySeverity(findings)) section.append(findingRow(finding));
  } else {
    section.append(Object.assign(document.createElement("p"), {
      className: "audit-clear",
      textContent: "Every check passed on this page."
    }));
  }

  const facts = document.createElement("div");
  facts.className = "audit-facts";
  const summary = [
    `${report.facts.content.wordCount} words`,
    `${report.facts.images.total} images`,
    `${report.facts.links.total} links`,
    `${report.facts.headings.total} headings`
  ];
  if (report.facts.generator) summary.push(`generator: ${report.facts.generator}`);
  if (report.facts.structuredData.types.length) summary.push(`schema: ${report.facts.structuredData.types.join(", ")}`);
  for (const item of summary) facts.append(Object.assign(document.createElement("span"), { textContent: item }));
  section.append(facts);

  return section;
}

function renderAudit() {
  const reports = auditReports();
  const crossPage = state.session.auditCrossPage || [];
  elements.auditPanel.replaceChildren();

  if (crossPage.length) {
    const section = document.createElement("section");
    section.className = "audit-page";
    const header = document.createElement("header");
    header.append(
      Object.assign(document.createElement("h2"), { textContent: "Across the captured pages" }),
      tallies(countSeverities(crossPage))
    );
    section.append(header);
    for (const finding of crossPage) section.append(findingRow(finding));
    elements.auditPanel.append(section);
  }

  for (const report of reports) elements.auditPanel.append(auditSection(report));

  elements.auditList.replaceChildren(...reports.map((report, index) => {
    const row = document.createElement("div");
    row.className = "capture-item";
    const copy = document.createElement("span");
    copy.append(Object.assign(document.createElement("strong"), { textContent: report.pageLabel }));
    const counts = reportCounts(report);
    const total = counts.critical + counts.warning + counts.notice;
    copy.append(Object.assign(document.createElement("span"), {
      textContent: total ? `${total} finding${total === 1 ? "" : "s"}` : "No issues"
    }));
    row.append(document.createElement("span"), copy);
    row.addEventListener("click", () => {
      elements.auditPanel.children[crossPage.length ? index + 1 : index]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return row;
  }));
}

const SEVERITY_ORDER = { critical: 0, warning: 1, notice: 2 };

function sortBySeverity(findings) {
  return [...findings].sort((first, second) => SEVERITY_ORDER[first.severity] - SEVERITY_ORDER[second.severity]);
}

function reportCounts(report) {
  const counts = { ...report.counts };
  for (const severity of Object.keys(counts)) counts[severity] += report.performance?.counts?.[severity] || 0;
  return counts;
}

function countSeverities(findings) {
  const counts = { critical: 0, warning: 0, notice: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

function setView(view) {
  state.view = view;
  const auditing = view === "audit";
  elements.viewAudit.classList.toggle("active", auditing);
  elements.viewCaptures.classList.toggle("active", !auditing);
  elements.auditPanel.hidden = !auditing;
  elements.auditList.hidden = !auditing;
  elements.captureList.hidden = auditing;
  elements.loading.hidden = true;
  elements.preview.hidden = auditing || !state.session.captures.length;
  document.querySelector(".selection-row").hidden = auditing;
  document.querySelector(".toolbar-center").hidden = auditing;
  document.querySelector(".downloads").hidden = auditing;
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

elements.viewCaptures.addEventListener("click", () => setView("captures"));
elements.viewAudit.addEventListener("click", () => setView("audit"));
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
    if (!state.session) throw new Error("These results have expired.");
    const hasCaptures = Boolean(state.session.captures?.length);
    const hasAudit = Boolean(state.session.audits?.length);
    if (!hasCaptures && !hasAudit) throw new Error("These results have expired.");

    elements.sessionTitle.textContent = state.session.title;
    elements.sessionHost.textContent = state.session.hostname;
    elements.sessionKind.textContent = hasCaptures ? "Capture results" : "Page audit";
    elements.viewAudit.hidden = !hasAudit;
    if (hasAudit) renderAudit();

    if (!hasCaptures) {
      setView("audit");
      return;
    }

    state.session.captures.forEach((capture) => state.selected.add(capture.id));
    elements.layout.value = state.session.outputLayout || "combined";
    [elements.downloadPdf, elements.downloadPng, elements.downloadBoth].forEach((button) => button.classList.remove("primary"));
    elements[state.session.outputFormat === "pdf" ? "downloadPdf" : state.session.outputFormat === "png" ? "downloadPng" : "downloadBoth"].classList.add("primary");
    renderList();
    await showCapture(0);
  } catch (error) {
    elements.loading.textContent = error.message;
  }
})();
