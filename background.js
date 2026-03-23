async function sendMessageToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

const STORAGE_KEY = "divRecordOptions";
const PREVIEW_KEY_PREFIX = "previewCapture:";
const DEFAULT_OPTIONS = {
  margin: 8,
  copyToClipboard: false,
  filenamePrefix: "div-record",
  filenameStyle: "human",
  saveAs: true,
  previewBeforeSave: false,
  hideFloatingUi: true,
  batchMode: false,
  exportBatchZip: false
};
const CAPTURE_MIN_INTERVAL_MS = 450;
const CAPTURE_RETRY_DELAYS_MS = [800, 1200, 1800, 2500];
let lastCaptureTimestamp = 0;
const batchExports = new Map();

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeFilename(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildTimestamp() {
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  return iso.slice(0, 19);
}

function buildBatchZipFilename(prefix) {
  const safePrefix = sanitizeFilename(prefix) || "div-record";
  return `${safePrefix}-batch-${buildTimestamp()}.zip`;
}

function buildFilename(metrics, options) {
  const prefix = sanitizeFilename(options.filenamePrefix) || "div-record";
  const host = sanitizeFilename(metrics.hostname) || "page";
  const pageTitle = sanitizeFilename(metrics.pageTitle) || "capture";
  const label = sanitizeFilename(metrics.label) || "element";
  const sequence = Number(options.batchSequence) > 0
    ? `-${String(options.batchSequence).padStart(3, "0")}`
    : "";
  const timestamp = buildTimestamp();
  const style = options.filenameStyle || "human";

  if (style === "short") {
    return `${prefix}${sequence}-${timestamp}.png`;
  }

  if (style === "detailed") {
    return `${prefix}-${host}-${pageTitle}-${label}${sequence}-${timestamp}.png`;
  }

  return `${prefix}-${pageTitle}${sequence}-${timestamp}.png`;
}

function buildAxisStarts(start, size, viewportSize) {
  if (size <= viewportSize) {
    return [Math.round(start)];
  }

  const starts = [];
  const end = start + size;
  let cursor = start;

  while (cursor < end) {
    starts.push(Math.round(cursor));
    cursor += viewportSize;
  }

  const finalStart = Math.round(end - viewportSize);

  if (starts[starts.length - 1] !== finalStart) {
    starts.push(finalStart);
  }

  return Array.from(new Set(starts));
}

async function captureVisibleTab(windowId) {
  return chrome.tabs.captureVisibleTab(windowId, { format: "png" });
}

async function captureVisibleTabSafely(windowId) {
  const now = Date.now();
  const elapsed = now - lastCaptureTimestamp;

  if (elapsed < CAPTURE_MIN_INTERVAL_MS) {
    await wait(CAPTURE_MIN_INTERVAL_MS - elapsed);
  }

  for (let attempt = 0; attempt <= CAPTURE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const dataUrl = await captureVisibleTab(windowId);
      lastCaptureTimestamp = Date.now();
      return dataUrl;
    } catch (error) {
      const message = String(error?.message || error || "");
      const hitQuota = message.includes("MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND");

      if (!hitQuota || attempt === CAPTURE_RETRY_DELAYS_MS.length) {
        throw error;
      }

      await wait(CAPTURE_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw new Error("Falha inesperada ao capturar a aba.");
}

async function loadBitmap(dataUrl) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

async function getStoredOptions() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return {
    ...DEFAULT_OPTIONS,
    ...(stored[STORAGE_KEY] || {})
  };
}

async function stitchCapture(windowId, tabId, metrics) {
  const pixelRatio = metrics.devicePixelRatio || 1;
  const canvasWidth = Math.max(1, Math.round(metrics.width * pixelRatio));
  const canvasHeight = Math.max(1, Math.round(metrics.height * pixelRatio));
  const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
  const context = canvas.getContext("2d");

  const xStarts = buildAxisStarts(metrics.left, metrics.width, metrics.viewportWidth);
  const yStarts = buildAxisStarts(metrics.top, metrics.height, metrics.viewportHeight);
  const totalFrames = xStarts.length * yStarts.length;
  let completedFrames = 0;

  for (const scrollY of yStarts) {
    for (const scrollX of xStarts) {
      await sendMessageToTab(tabId, {
        type: "CAPTURE_PROGRESS",
        payload: {
          current: completedFrames + 1,
          total: totalFrames
        }
      }).catch(() => {});

      const viewport = await sendMessageToTab(tabId, {
        type: "SCROLL_FOR_CAPTURE",
        payload: { x: scrollX, y: scrollY }
      });

      if (!viewport?.ok) {
        throw new Error(viewport?.error || "Falha ao posicionar a pagina para captura.");
      }

      await wait(120);

      const screenshotDataUrl = await captureVisibleTabSafely(windowId);
      const bitmap = await loadBitmap(screenshotDataUrl);

      const viewportLeft = viewport.viewport.left;
      const viewportTop = viewport.viewport.top;
      const viewportRight = viewportLeft + metrics.viewportWidth;
      const viewportBottom = viewportTop + metrics.viewportHeight;

      const overlapLeft = Math.max(metrics.left, viewportLeft);
      const overlapTop = Math.max(metrics.top, viewportTop);
      const overlapRight = Math.min(metrics.left + metrics.width, viewportRight);
      const overlapBottom = Math.min(metrics.top + metrics.height, viewportBottom);
      const overlapWidth = overlapRight - overlapLeft;
      const overlapHeight = overlapBottom - overlapTop;

      if (overlapWidth <= 0 || overlapHeight <= 0) {
        continue;
      }

      const sourceX = Math.round((overlapLeft - viewportLeft) * pixelRatio);
      const sourceY = Math.round((overlapTop - viewportTop) * pixelRatio);
      const sourceWidth = Math.round(overlapWidth * pixelRatio);
      const sourceHeight = Math.round(overlapHeight * pixelRatio);
      const destX = Math.round((overlapLeft - metrics.left) * pixelRatio);
      const destY = Math.round((overlapTop - metrics.top) * pixelRatio);

      context.drawImage(
        bitmap,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        destX,
        destY,
        sourceWidth,
        sourceHeight
      );

      completedFrames += 1;
    }
  }

  const blob = await canvas.convertToBlob({ type: "image/png" });
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Falha ao converter o print final."));
    reader.readAsDataURL(blob);
  });
}

async function maybeCopyToClipboard(tabId, dataUrl, shouldCopy) {
  if (!shouldCopy) {
    return { copied: false };
  }

  try {
    const response = await sendMessageToTab(tabId, {
      type: "COPY_TO_CLIPBOARD",
      payload: { dataUrl }
    });

    return { copied: Boolean(response?.ok) };
  } catch (_error) {
    return { copied: false };
  }
}

function crc32(bytes) {
  let crc = 0 ^ -1;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[index]) & 0xff];
  }

  return (crc ^ -1) >>> 0;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }

  return table;
})();

function concatUint8Arrays(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

async function dataUrlToBytes(dataUrl) {
  const response = await fetch(dataUrl);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function blobToDataUrl(blob) {
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Falha ao converter o ZIP para download."));
    reader.readAsDataURL(blob);
  });
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value, true);
}

function createZipBytes(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = file.bytes;
    const checksum = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, 0);
    writeUint16(localView, 12, 0);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, dataBytes.length);
    writeUint32(localView, 22, dataBytes.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, 0);
    writeUint16(centralView, 14, 0);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, dataBytes.length);
    writeUint32(centralView, 24, dataBytes.length);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + dataBytes.length;
  }

  const centralDirectory = concatUint8Arrays(centralParts);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, files.length);
  writeUint16(endView, 10, files.length);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, offset);
  writeUint16(endView, 20, 0);

  return concatUint8Arrays([...localParts, centralDirectory, endRecord]);
}

async function finalizeBatchExport(batchSessionId, options) {
  const batch = batchExports.get(batchSessionId);

  if (!batch?.files?.length) {
    throw new Error("Nenhuma captura encontrada para exportar o lote.");
  }

  const files = [];

  for (const file of batch.files) {
    files.push({
      name: file.filename,
      bytes: await dataUrlToBytes(file.dataUrl)
    });
  }

  const zipBytes = createZipBytes(files);
  const zipBlob = new Blob([zipBytes], { type: "application/zip" });
  const zipUrl = await blobToDataUrl(zipBlob);
  const zipFilename = buildBatchZipFilename(options.filenamePrefix || batch.filenamePrefix);

  try {
    await chrome.downloads.download({
      url: zipUrl,
      filename: zipFilename,
      saveAs: Boolean(options.saveAs)
    });
  } finally {
    batchExports.delete(batchSessionId);
  }

  return { ok: true, filename: zipFilename };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "FINALIZE_BATCH_EXPORT") {
    return false;
  }

  (async () => {
    try {
      const result = await finalizeBatchExport(message.payload?.batchSessionId, {
        filenamePrefix: message.payload?.filenamePrefix,
        saveAs: message.payload?.saveAs
      });
      sendResponse(result);
    } catch (error) {
      sendResponse({
        ok: false,
        error: error.message || "Falha ao exportar o lote."
      });
    }
  })();

  return true;
});

async function openPreview(finalDataUrl, filename, options) {
  const previewId = crypto.randomUUID();
  const previewKey = `${PREVIEW_KEY_PREFIX}${previewId}`;

  await chrome.storage.session.set({
    [previewKey]: {
      imageDataUrl: finalDataUrl,
      filename,
      saveAs: Boolean(options.saveAs),
      createdAt: Date.now()
    }
  });

  const previewUrl = chrome.runtime.getURL(`preview.html?previewId=${encodeURIComponent(previewId)}`);
  await chrome.tabs.create({ url: previewUrl });
  return previewId;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "CAPTURE_ELEMENT") {
    return false;
  }

  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;

  if (!tabId || !windowId) {
    sendResponse({ ok: false, error: "Aba invalida para captura." });
    return false;
  }

  (async () => {
    try {
      const prepared = await sendMessageToTab(tabId, {
        type: "PREPARE_CAPTURE",
        payload: message.payload
      });

      if (!prepared?.ok) {
        throw new Error(prepared?.error || "Falha ao preparar a captura.");
      }

      const finalDataUrl = await stitchCapture(windowId, tabId, prepared.metrics);
      const filename = buildFilename(prepared.metrics, {
        filenamePrefix: message.payload?.filenamePrefix,
        filenameStyle: message.payload?.filenameStyle,
        batchSequence: message.payload?.batchSequence
      });
      const usePreview = Boolean(message.payload?.previewBeforeSave) && !Boolean(message.payload?.batchMode);
      const exportBatchZip = Boolean(message.payload?.exportBatchZip) && Boolean(message.payload?.batchMode);
      let clipboardResult = { copied: false };

      if (exportBatchZip) {
        const sessionId = message.payload?.batchSessionId;

        if (!sessionId) {
          throw new Error("Sessao do lote ausente para exportacao em ZIP.");
        }

        const batch = batchExports.get(sessionId) || {
          files: [],
          filenamePrefix: message.payload?.filenamePrefix
        };
        batch.files.push({
          filename,
          dataUrl: finalDataUrl
        });
        batchExports.set(sessionId, batch);
      } else if (usePreview) {
        await openPreview(finalDataUrl, filename, {
          saveAs: message.payload?.saveAs
        });
      } else {
        await chrome.downloads.download({
          url: finalDataUrl,
          filename,
          saveAs: Boolean(message.payload?.saveAs)
        });

        clipboardResult = await maybeCopyToClipboard(
          tabId,
          finalDataUrl,
          Boolean(message.payload?.copyToClipboard)
        );
      }

      await sendMessageToTab(tabId, {
        type: "CAPTURE_COMPLETE",
        payload: {
          ...clipboardResult,
          previewOpened: usePreview
        }
      });

      sendResponse({
        ok: true,
        filename,
        copiedToClipboard: clipboardResult.copied,
        previewOpened: usePreview,
        queuedForZip: exportBatchZip
      });
    } catch (error) {
      await sendMessageToTab(tabId, {
        type: "CAPTURE_FAILED",
        error: error.message || "Erro ao capturar a div."
      }).catch(() => {});

      sendResponse({
        ok: false,
        error: error.message || "Erro ao capturar a div."
      });
    }
  })();

  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "start-selection") {
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      return;
    }

    const options = await getStoredOptions();
    await sendMessageToTab(tab.id, {
      type: "START_SELECTION",
      payload: options
    });
  } catch (_error) {
    // Silently ignore restricted pages or tabs without the content script.
  }
});
