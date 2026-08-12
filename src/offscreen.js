/* global BrowserSnapsPdf, chrome */

const MAX_CANVAS_HEIGHT = 30_000;

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error || new Error("Could not encode the stitched screenshot."));
    reader.readAsDataURL(blob);
  });
}

async function decodeTile(data) {
  return createImageBitmap(new Blob([decodeBase64(data)], { type: "image/jpeg" }));
}

async function stitchGroup(group) {
  if (!group.tiles?.length) throw new Error("A page capture did not contain any screenshot tiles.");

  const first = await decodeTile(group.tiles[0].data);
  const pixelScale = first.width / group.viewportWidth;
  const width = first.width;
  const height = Math.round(group.documentHeight * pixelScale);
  first.close();

  if (height > MAX_CANVAS_HEIGHT) {
    throw new Error(`This page is too tall to stitch safely (${height}px). Try a taller browser window.`);
  }

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  for (const tile of group.tiles) {
    const bitmap = await decodeTile(tile.data);
    const y = Math.round(tile.y * pixelScale);
    const remaining = Math.max(0, height - y);
    const drawHeight = Math.min(bitmap.height, remaining);
    if (drawHeight > 0) context.drawImage(bitmap, 0, 0, bitmap.width, drawHeight, 0, y, width, drawHeight);
    bitmap.close();
  }

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
  return {
    data: await blobToBase64(blob),
    width,
    height,
    pageLabel: group.pageLabel,
    pageUrl: group.pageUrl,
    profileLabel: group.profileLabel,
    viewport: group.viewport
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "BUILD_PDF") return;

  (async () => {
    try {
      const captures = [];
      for (const group of message.groups || []) captures.push(await stitchGroup(group));
      const bytes = BrowserSnapsPdf.createPdf(captures);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      sendResponse({ ok: true, url });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
  })();

  return true;
});
