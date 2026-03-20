async function sendMessageToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

const STORAGE_KEY = "divRecordOptions";
const DEFAULT_OPTIONS = {
  margin: 8,
  copyToClipboard: false,
  filenamePrefix: "div-record",
  saveAs: true,
  hideFloatingUi: true,
  batchMode: false
};
const CAPTURE_MIN_INTERVAL_MS = 450;
const CAPTURE_RETRY_DELAYS_MS = [800, 1200, 1800, 2500];
let lastCaptureTimestamp = 0;

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

function buildFilename(metrics, options) {
  const prefix = sanitizeFilename(options.filenamePrefix) || "div-record";
  const host = sanitizeFilename(metrics.hostname) || "page";
  const pageTitle = sanitizeFilename(metrics.pageTitle) || "capture";
  const label = sanitizeFilename(metrics.label) || "element";
  const sequence = Number(options.batchSequence) > 0
    ? `-${String(options.batchSequence).padStart(3, "0")}`
    : "";

  return `${prefix}-${host}-${pageTitle}-${label}${sequence}-${Date.now()}.png`;
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
        batchSequence: message.payload?.batchSequence
      });

      await chrome.downloads.download({
        url: finalDataUrl,
        filename,
        saveAs: Boolean(message.payload?.saveAs)
      });

      const clipboardResult = await maybeCopyToClipboard(
        tabId,
        finalDataUrl,
        Boolean(message.payload?.copyToClipboard)
      );

      await sendMessageToTab(tabId, {
        type: "CAPTURE_COMPLETE",
        payload: clipboardResult
      });

      sendResponse({
        ok: true,
        filename,
        copiedToClipboard: clipboardResult.copied
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
