/* global BrowserSnapsStore, OffscreenCanvas, chrome, createImageBitmap, crypto */

const MAX_CANVAS_HEIGHT = 30_000;

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function decodeTile(data) {
  return createImageBitmap(new Blob([decodeBase64(data)], { type: "image/jpeg" }));
}

async function stitchGroup(group, sessionId, index) {
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

  const blob = await canvas.convertToBlob({ type: "image/png" });
  const id = `${sessionId}:${index}`;
  return {
    id,
    sessionId,
    blob,
    width,
    height,
    pageLabel: group.pageLabel,
    pageUrl: group.pageUrl,
    profileId: group.profileId,
    profileLabel: group.profileLabel,
    viewport: group.viewport
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "PROCESS_CAPTURES") return;

  (async () => {
    try {
      const sessionId = crypto.randomUUID();
      const captures = [];
      for (let index = 0; index < (message.groups || []).length; index += 1) {
        captures.push(await stitchGroup(message.groups[index], sessionId, index));
      }

      const session = {
        id: sessionId,
        createdAt: Date.now(),
        hostname: message.session.hostname,
        title: message.session.title,
        outputFormat: message.session.outputFormat,
        outputLayout: message.session.outputLayout,
        captures: captures.map(({ blob, ...capture }) => capture)
      };
      await BrowserSnapsStore.saveSession(session, captures);
      await BrowserSnapsStore.cleanup();
      sendResponse({ ok: true, sessionId });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
  })();

  return true;
});
