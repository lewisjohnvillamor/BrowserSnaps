/* global BrowserSnapsPdf, chrome */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "BUILD_PDF") return;

  try {
    const bytes = BrowserSnapsPdf.createPdf(message.captures);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    sendResponse({ ok: true, url });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }
});
