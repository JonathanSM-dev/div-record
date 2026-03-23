const SELECTABLE_SELECTOR = [
  "div",
  "section",
  "article",
  "main",
  "header",
  "footer",
  "nav",
  "aside",
  "button",
  "a",
  "li",
  "ul",
  "ol",
  "table",
  "form",
  "img",
  "canvas",
  "svg"
].join(",");
const STORAGE_KEY = "divRecordOptions";
const MARGIN_STEP = 8;
const MAX_MARGIN = 64;

const state = {
  selectionActive: false,
  overlay: null,
  label: null,
  batchBadge: null,
  toast: null,
  toastTimer: null,
  captureSession: null,
  captureOptions: {
    margin: 8,
    copyToClipboard: false,
    filenamePrefix: "div-record",
    filenameStyle: "human",
    saveAs: true,
    previewBeforeSave: false,
    hideFloatingUi: true,
    batchMode: false,
    exportBatchZip: false
  },
  hiddenFloatingElements: [],
  batchSelections: [],
  currentPath: [],
  pathIndex: 0,
  lastPointerTarget: null,
  captureInProgress: false,
  batchCaptureCount: 0,
  batchProcessing: false,
  captureTargetElement: null,
  batchHighlightsSuspended: false,
  batchSessionId: null
};

function ensureOverlay() {
  if (state.overlay) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "__div_record_overlay__";
  overlay.style.position = "fixed";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.width = "0";
  overlay.style.height = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "2147483646";
  overlay.style.border = "2px solid #0d6efd";
  overlay.style.background = "rgba(13, 110, 253, 0.12)";
  overlay.style.boxShadow = "0 0 0 99999px rgba(7, 16, 35, 0.2)";
  overlay.style.transition = "all 60ms ease";

  const label = document.createElement("div");
  label.style.position = "fixed";
  label.style.pointerEvents = "none";
  label.style.zIndex = "2147483647";
  label.style.padding = "6px 8px";
  label.style.borderRadius = "8px";
  label.style.fontFamily = "Segoe UI, sans-serif";
  label.style.fontSize = "12px";
  label.style.fontWeight = "600";
  label.style.color = "#ffffff";
  label.style.background = "#0d6efd";
  label.style.boxShadow = "0 6px 14px rgba(0, 0, 0, 0.18)";
  label.textContent = "Selecione um elemento";

  const batchBadge = document.createElement("div");
  batchBadge.id = "__div_record_batch_badge__";
  batchBadge.style.position = "fixed";
  batchBadge.style.right = "16px";
  batchBadge.style.top = "16px";
  batchBadge.style.pointerEvents = "none";
  batchBadge.style.zIndex = "2147483647";
  batchBadge.style.padding = "8px 10px";
  batchBadge.style.borderRadius = "999px";
  batchBadge.style.fontFamily = "Segoe UI, sans-serif";
  batchBadge.style.fontSize = "12px";
  batchBadge.style.fontWeight = "700";
  batchBadge.style.color = "#ffffff";
  batchBadge.style.background = "#16a34a";
  batchBadge.style.boxShadow = "0 6px 14px rgba(0, 0, 0, 0.18)";
  batchBadge.style.opacity = "0";
  batchBadge.style.display = "none";
  batchBadge.textContent = "Lote: 0";

  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(label);
  document.documentElement.appendChild(batchBadge);

  state.overlay = overlay;
  state.label = label;
  state.batchBadge = batchBadge;
}

function hideOverlay() {
  if (!state.overlay || !state.label || !state.batchBadge) {
    return;
  }

  state.overlay.style.width = "0";
  state.overlay.style.height = "0";
  state.label.style.opacity = "0";
  state.batchBadge.style.opacity = "0";
}

function setOverlayVisibility(visible) {
  if (!state.overlay || !state.label || !state.batchBadge) {
    return;
  }

  state.overlay.style.display = visible ? "block" : "none";
  state.label.style.display = visible ? "block" : "none";
  state.batchBadge.style.display = visible ? "block" : "none";
}

function clearToast() {
  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
    state.toastTimer = null;
  }

  if (state.toast) {
    state.toast.remove();
    state.toast = null;
  }
}

function showToast(message, isError = false, duration = 2600) {
  clearToast();

  const toast = document.createElement("div");
  toast.id = "__div_record_toast__";
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.right = "16px";
  toast.style.bottom = "16px";
  toast.style.zIndex = "2147483647";
  toast.style.padding = "12px 14px";
  toast.style.borderRadius = "12px";
  toast.style.font = "600 13px Segoe UI, sans-serif";
  toast.style.color = "#ffffff";
  toast.style.background = isError ? "#b42318" : "#101828";
  toast.style.boxShadow = "0 12px 24px rgba(0, 0, 0, 0.2)";

  document.documentElement.appendChild(toast);
  state.toast = toast;

  if (duration > 0) {
    state.toastTimer = window.setTimeout(() => clearToast(), duration);
  }
}

function describeElement(element) {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const classes = Array.from(element.classList).slice(0, 2).join(".");
  const classSuffix = classes ? `.${classes}` : "";
  return `${tag}${id}${classSuffix}`;
}

function isExtensionUiElement(element) {
  return Boolean(
    element?.id === "__div_record_overlay__" ||
    element?.id === "__div_record_batch_badge__" ||
    element?.id === "__div_record_toast__" ||
    state.overlay === element ||
    state.label === element ||
    state.batchBadge === element ||
    state.toast === element
  );
}

function findBatchSelectionIndex(element) {
  return state.batchSelections.findIndex((entry) => entry.element === element);
}

function clearBatchSelectionHighlights() {
  for (const entry of state.batchSelections) {
    entry.element.style.outline = entry.outline;
    entry.element.style.outlineOffset = entry.outlineOffset;
  }
}

function suspendBatchSelectionHighlights() {
  if (state.batchHighlightsSuspended) {
    return;
  }

  for (const entry of state.batchSelections) {
    entry.element.style.outline = entry.outline;
    entry.element.style.outlineOffset = entry.outlineOffset;
  }

  state.batchHighlightsSuspended = true;
}

function resumeBatchSelectionHighlights() {
  if (!state.batchHighlightsSuspended) {
    return;
  }

  for (const entry of state.batchSelections) {
    entry.element.style.outline = "2px dashed #16a34a";
    entry.element.style.outlineOffset = "2px";
  }

  state.batchHighlightsSuspended = false;
}

function updateBatchBadge() {
  if (!state.batchBadge) {
    return;
  }

  const shouldShow = state.selectionActive && state.captureOptions.batchMode;
  state.batchBadge.style.display = shouldShow ? "block" : "none";
  state.batchBadge.style.opacity = shouldShow ? "1" : "0";

  if (!shouldShow) {
    return;
  }

  const selectedCount = state.batchSelections.length;
  const processingPrefix = state.batchProcessing ? "Processando" : "Lote";
  state.batchBadge.textContent = `${processingPrefix}: ${selectedCount}`;
  state.batchBadge.style.background = selectedCount > 0 ? "#16a34a" : "#475467";
}

function resetBatchSelections() {
  clearBatchSelectionHighlights();
  state.batchSelections = [];
  state.batchCaptureCount = 0;
  state.batchHighlightsSuspended = false;
  updateBatchBadge();
}

function toggleBatchSelection(element) {
  const existingIndex = findBatchSelectionIndex(element);

  if (existingIndex >= 0) {
    const [existing] = state.batchSelections.splice(existingIndex, 1);
    existing.element.style.outline = existing.outline;
    existing.element.style.outlineOffset = existing.outlineOffset;
    updateBatchBadge();
    return false;
  }

  state.batchSelections.push({
    element,
    outline: element.style.outline,
    outlineOffset: element.style.outlineOffset
  });

  element.style.outline = "2px dashed #16a34a";
  element.style.outlineOffset = "2px";
  updateBatchBadge();
  return true;
}

function isLikelyNoiseElement(element, style) {
  const marker = `${element.id} ${element.className} ${element.getAttribute("aria-label") || ""} ${element.getAttribute("role") || ""}`.toLowerCase();
  const keywords = [
    "ad",
    "ads",
    "advert",
    "banner",
    "promo",
    "cookie",
    "consent",
    "newsletter",
    "subscribe",
    "popup",
    "modal",
    "intercom",
    "chat",
    "whatsapp",
    "floating"
  ];

  const hasKeyword = keywords.some((keyword) => marker.includes(keyword));
  const zIndex = Number.parseInt(style.zIndex, 10);
  const highZIndex = Number.isFinite(zIndex) && zIndex >= 20;
  const rect = element.getBoundingClientRect();
  const smallOverlay = rect.width >= 120 && rect.height >= 40;

  return hasKeyword || (highZIndex && smallOverlay);
}

function isSelectableElement(element) {
  if (!(element instanceof Element)) {
    return false;
  }

  if (!element.matches(SELECTABLE_SELECTOR)) {
    return false;
  }

  if (element === document.documentElement || element === document.body) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width >= 4 && rect.height >= 4;
}

function buildSelectablePath(target) {
  const path = [];
  let cursor = target instanceof Element ? target : null;

  while (cursor && cursor !== document.body && cursor !== document.documentElement) {
    if (isSelectableElement(cursor)) {
      path.push(cursor);
    }

    cursor = cursor.parentElement;
  }

  return path;
}

function getCurrentElement() {
  return state.currentPath[state.pathIndex] || null;
}

function updateOverlay(element) {
  ensureOverlay();

  const rect = element.getBoundingClientRect();
  state.overlay.style.left = `${rect.left}px`;
  state.overlay.style.top = `${rect.top}px`;
  state.overlay.style.width = `${rect.width}px`;
  state.overlay.style.height = `${rect.height}px`;

  const hierarchyLabel = state.currentPath.length > 1
    ? ` ${state.pathIndex + 1}/${state.currentPath.length}`
    : "";
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  const margin = Math.max(0, Number(state.captureOptions.margin) || 0);

  state.label.textContent = `Capturar ${describeElement(element)}${hierarchyLabel} ${width}x${height} m:${margin}`;
  state.label.style.opacity = "1";
  state.label.style.left = `${Math.max(8, rect.left)}px`;
  state.label.style.top = `${Math.max(8, rect.top - 34)}px`;
}

async function persistCaptureOptions() {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const mergedOptions = {
      ...(stored[STORAGE_KEY] || {}),
      ...state.captureOptions
    };

    await chrome.storage.local.set({
      [STORAGE_KEY]: mergedOptions
    });
  } catch (_error) {
    // Non-blocking: selection should keep working even if persistence fails.
  }
}

function adjustMargin(delta) {
  const nextMargin = Math.max(
    0,
    Math.min(MAX_MARGIN, (Number(state.captureOptions.margin) || 0) + delta)
  );

  if (nextMargin === state.captureOptions.margin) {
    return;
  }

  state.captureOptions.margin = nextMargin;
  persistCaptureOptions().catch(() => {});

  const element = getCurrentElement();

  if (element) {
    updateOverlay(element);
  }

  showToast(`Margem ajustada para ${nextMargin}px.`, false, 1400);
}

function syncHoveredPath(target) {
  const path = buildSelectablePath(target);

  if (!path.length) {
    state.lastPointerTarget = null;
    state.currentPath = [];
    state.pathIndex = 0;
    hideOverlay();
    return;
  }

  if (state.lastPointerTarget === target && state.currentPath.length) {
    return;
  }

  state.lastPointerTarget = target;
  state.currentPath = path;
  state.pathIndex = 0;
  updateOverlay(path[0]);
}

function moveSelectionLevel(direction) {
  if (!state.currentPath.length) {
    return;
  }

  const nextIndex = Math.min(
    Math.max(state.pathIndex + direction, 0),
    state.currentPath.length - 1
  );

  if (nextIndex === state.pathIndex) {
    return;
  }

  state.pathIndex = nextIndex;
  updateOverlay(state.currentPath[state.pathIndex]);
}

function getDocumentBounds() {
  const doc = document.documentElement;
  const body = document.body;

  return {
    width: Math.max(
      doc.scrollWidth,
      doc.clientWidth,
      body ? body.scrollWidth : 0,
      body ? body.clientWidth : 0
    ),
    height: Math.max(
      doc.scrollHeight,
      doc.clientHeight,
      body ? body.scrollHeight : 0,
      body ? body.clientHeight : 0
    )
  };
}

function startSelection(options = {}) {
  ensureOverlay();
  setOverlayVisibility(true);
  state.selectionActive = true;
  state.currentPath = [];
  state.pathIndex = 0;
  state.lastPointerTarget = null;
  state.captureTargetElement = null;
  state.batchProcessing = false;
  state.batchSessionId = null;
  resetBatchSelections();
  state.captureOptions = {
    margin: Number.isFinite(options.margin) ? options.margin : 8,
    copyToClipboard: Boolean(options.copyToClipboard),
    filenamePrefix: typeof options.filenamePrefix === "string" && options.filenamePrefix.trim()
      ? options.filenamePrefix.trim()
      : "div-record",
    filenameStyle: typeof options.filenameStyle === "string" ? options.filenameStyle : "human",
    saveAs: "saveAs" in options ? Boolean(options.saveAs) : true,
    previewBeforeSave: "previewBeforeSave" in options ? Boolean(options.previewBeforeSave) : false,
    hideFloatingUi: "hideFloatingUi" in options ? Boolean(options.hideFloatingUi) : true,
    batchMode: "batchMode" in options ? Boolean(options.batchMode) : false,
    exportBatchZip: "exportBatchZip" in options ? Boolean(options.exportBatchZip) : false
  };
  updateBatchBadge();

  const batchHint = state.captureOptions.batchMode
    ? " Modo lote ativo: clique para marcar itens e pressione Esc para capturar tudo."
    : "";
  showToast(`Selecao ativa. Use roda do mouse ou setas para mudar o container.${batchHint}`, false, 3800);
}

function stopSelection() {
  state.selectionActive = false;
  state.currentPath = [];
  state.pathIndex = 0;
  state.lastPointerTarget = null;
  state.captureTargetElement = null;
  state.batchProcessing = false;
  state.batchSessionId = null;
  resetBatchSelections();
  hideOverlay();
  updateBatchBadge();
}

function onMouseMove(event) {
  if (!state.selectionActive) {
    return;
  }

  if (state.captureInProgress) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  syncHoveredPath(event.target);
}

function onWheel(event) {
  if (!state.selectionActive) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  moveSelectionLevel(event.deltaY > 0 ? 1 : -1);
}

function onClick(event) {
  if (!state.selectionActive) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  syncHoveredPath(event.target);

  const element = getCurrentElement();

  if (!element) {
    showToast("Nenhum elemento valido encontrado nesse ponto.", true);
    return;
  }

  if (state.captureOptions.batchMode && !state.batchProcessing) {
    const added = toggleBatchSelection(element);
    updateOverlay(element);
    showToast(
      added
        ? `Item adicionado ao lote (${state.batchSelections.length}). Pressione Esc para capturar.`
        : `Item removido do lote (${state.batchSelections.length}).`,
      false,
      1800
    );
    return;
  }

  state.selectionActive = false;
  state.captureInProgress = true;
  updateOverlay(element);
  clearToast();

  state.captureTargetElement = element;
  chrome.runtime.sendMessage({
    type: "CAPTURE_ELEMENT",
    payload: {
      selectorLabel: describeElement(element),
      copyToClipboard: state.captureOptions.copyToClipboard,
      filenamePrefix: state.captureOptions.filenamePrefix,
      filenameStyle: state.captureOptions.filenameStyle,
      saveAs: state.captureOptions.saveAs,
      previewBeforeSave: state.captureOptions.previewBeforeSave,
      hideFloatingUi: state.captureOptions.hideFloatingUi,
      batchMode: state.captureOptions.batchMode,
      exportBatchZip: false,
      batchSequence: state.captureOptions.batchMode ? state.batchCaptureCount + 1 : 0
    }
  }, (response) => {
    if (chrome.runtime.lastError) {
      state.captureInProgress = false;
      showToast(chrome.runtime.lastError.message, true);
      return;
    }

    if (!response?.ok) {
      state.captureInProgress = false;
      showToast(response?.error || "Falha ao capturar o elemento.", true);
    }
  });
}

async function sendCaptureRequest(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: "CAPTURE_ELEMENT",
      payload
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Falha ao capturar o elemento."));
        return;
      }

      resolve(response);
    });
  });
}

async function processBatchSelections() {
  const items = state.batchSelections
    .map((entry) => entry.element)
    .filter((element) => document.contains(element));

  if (!items.length) {
    throw new Error("Nenhum item valido permaneceu no lote.");
  }

  state.selectionActive = false;
  state.batchProcessing = true;
  state.batchCaptureCount = 0;
  state.batchSessionId = state.captureOptions.exportBatchZip
    ? (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
    : null;
  updateBatchBadge();
  suspendBatchSelectionHighlights();
  clearToast();

  try {
    for (let index = 0; index < items.length; index += 1) {
      const element = items[index];

      state.captureTargetElement = element;
      state.captureInProgress = true;
      showToast(`Processando lote ${index + 1}/${items.length}...`, false, 0);

      await sendCaptureRequest({
        selectorLabel: describeElement(element),
        copyToClipboard: state.captureOptions.copyToClipboard,
        filenamePrefix: state.captureOptions.filenamePrefix,
        filenameStyle: state.captureOptions.filenameStyle,
        saveAs: state.captureOptions.saveAs,
        previewBeforeSave: false,
        hideFloatingUi: state.captureOptions.hideFloatingUi,
        batchMode: true,
        exportBatchZip: state.captureOptions.exportBatchZip,
        batchSessionId: state.batchSessionId,
        batchSequence: index + 1
      });
    }

    if (state.captureOptions.exportBatchZip) {
      showToast(`Empacotando ZIP do lote (${items.length} capturas)...`, false, 0);

      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: "FINALIZE_BATCH_EXPORT",
          payload: {
            batchSessionId: state.batchSessionId,
            filenamePrefix: state.captureOptions.filenamePrefix,
            saveAs: state.captureOptions.saveAs
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response?.ok) {
            reject(new Error(response?.error || "Falha ao gerar o ZIP do lote."));
            return;
          }

          resolve(response);
        });
      });
    }
  } finally {
    state.batchProcessing = false;
    state.captureInProgress = false;
    state.captureTargetElement = null;
    state.batchSessionId = null;
    updateBatchBadge();
  }

  state.selectionActive = false;
  resetBatchSelections();
  hideOverlay();
  if (state.captureOptions.exportBatchZip) {
    showToast(`Lote exportado em ZIP com ${items.length} capturas.`, false, 3200);
  } else {
    showToast(`Lote concluido com ${items.length} capturas salvas.`, false, 2800);
  }
}

function clearBatchSelectionsWithFeedback() {
  if (!state.batchSelections.length) {
    showToast("O lote ja esta vazio.", false, 1400);
    return;
  }

  resetBatchSelections();
  showToast("Lote limpo.", false, 1400);
}

function undoLastBatchSelection() {
  if (!state.batchSelections.length) {
    showToast("Nao ha itens no lote para desfazer.", false, 1400);
    return;
  }

  const lastEntry = state.batchSelections.pop();
  lastEntry.element.style.outline = lastEntry.outline;
  lastEntry.element.style.outlineOffset = lastEntry.outlineOffset;
  updateBatchBadge();
  showToast(`Ultimo item removido do lote (${state.batchSelections.length}).`, false, 1400);
}

function onKeyDown(event) {
  if (!state.selectionActive) {
    return;
  }

  if (event.key === "Escape" || event.key === "Enter") {
    if (
      state.captureOptions.batchMode &&
      !state.captureInProgress &&
      !state.batchProcessing &&
      state.batchSelections.length > 0
    ) {
      event.preventDefault();
      processBatchSelections().catch((error) => {
        restoreAfterCapture();
        state.batchProcessing = false;
        state.selectionActive = true;
        showToast(error.message || "Falha ao processar o lote.", true, 2600);
      });
      return;
    }

    if (event.key === "Enter") {
      return;
    }

    stopSelection();
    showToast("Selecao cancelada.");
    return;
  }

  if (
    state.captureOptions.batchMode &&
    !state.captureInProgress &&
    !state.batchProcessing &&
    (event.key === "Backspace" || event.key === "Delete")
  ) {
    event.preventDefault();
    clearBatchSelectionsWithFeedback();
    return;
  }

  if (
    state.captureOptions.batchMode &&
    !state.captureInProgress &&
    !state.batchProcessing &&
    event.key.toLowerCase() === "z" &&
    (event.ctrlKey || event.metaKey)
  ) {
    event.preventDefault();
    undoLastBatchSelection();
    return;
  }

  if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    event.preventDefault();
    moveSelectionLevel(1);
    return;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    event.preventDefault();
    moveSelectionLevel(-1);
    return;
  }

  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    adjustMargin(MARGIN_STEP);
    return;
  }

  if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    adjustMargin(-MARGIN_STEP);
  }
}

async function prepareCapture() {
  const element = state.captureTargetElement || getCurrentElement();

  if (!element || !document.contains(element)) {
    throw new Error("O elemento selecionado nao esta mais disponivel.");
  }

  state.captureSession = {
    scrollX: window.scrollX,
    scrollY: window.scrollY
  };

  clearToast();
  setOverlayVisibility(false);
  suspendBatchSelectionHighlights();
  hideFloatingElements(element);

  const rect = element.getBoundingClientRect();
  const bounds = getDocumentBounds();
  const margin = Math.max(0, Number(state.captureOptions.margin) || 0);

  const unclampedLeft = rect.left + window.scrollX - margin;
  const unclampedTop = rect.top + window.scrollY - margin;
  const unclampedRight = rect.right + window.scrollX + margin;
  const unclampedBottom = rect.bottom + window.scrollY + margin;

  const left = Math.max(0, unclampedLeft);
  const top = Math.max(0, unclampedTop);
  const right = Math.min(bounds.width, unclampedRight);
  const bottom = Math.min(bounds.height, unclampedBottom);

  return {
    ok: true,
    metrics: {
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      label: describeElement(element),
      pageTitle: document.title || "",
      hostname: window.location.hostname || "",
      pathname: window.location.pathname || ""
    }
  };
}

function restoreHiddenFloatingElements() {
  for (const item of state.hiddenFloatingElements) {
    item.element.style.visibility = item.visibility;
    item.element.style.opacity = item.opacity;
    item.element.style.pointerEvents = item.pointerEvents;
  }

  state.hiddenFloatingElements = [];
}

function hideFloatingElements(selectedElement) {
  if (!state.captureOptions.hideFloatingUi || !document.body) {
    return;
  }

  restoreHiddenFloatingElements();

  const elements = document.body.querySelectorAll("*");

  for (const element of elements) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    if (
      isExtensionUiElement(element) ||
      element === selectedElement ||
      selectedElement.contains(element) ||
      element.contains(selectedElement)
    ) {
      continue;
    }

    const style = window.getComputedStyle(element);

    const likelyNoise = isLikelyNoiseElement(element, style);

    if (style.position !== "fixed" && style.position !== "sticky" && !likelyNoise) {
      continue;
    }

    if (style.visibility === "hidden" || style.display === "none") {
      continue;
    }

    const rect = element.getBoundingClientRect();

    if (rect.width < 4 || rect.height < 4) {
      continue;
    }

    state.hiddenFloatingElements.push({
      element,
      visibility: element.style.visibility,
      opacity: element.style.opacity,
      pointerEvents: element.style.pointerEvents
    });

    element.style.visibility = "hidden";
    element.style.opacity = "0";
    element.style.pointerEvents = "none";
  }
}

async function scrollForCapture(payload) {
  window.scrollTo({
    left: payload.x,
    top: payload.y,
    behavior: "auto"
  });

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  return {
    ok: true,
    viewport: {
      left: window.scrollX,
      top: window.scrollY
    }
  };
}

async function copyToClipboard(dataUrl) {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard nao suportado nesta pagina.");
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  await navigator.clipboard.write([
    new ClipboardItem({
      [blob.type]: blob
    })
  ]);

  return { ok: true };
}

function restoreAfterCapture() {
  restoreHiddenFloatingElements();

  if (state.captureSession) {
    window.scrollTo({
      left: state.captureSession.scrollX,
      top: state.captureSession.scrollY,
      behavior: "auto"
    });
  }

  state.captureSession = null;
  state.captureTargetElement = null;
  state.captureInProgress = false;
  hideOverlay();
  setOverlayVisibility(true);

  if (state.selectionActive && state.captureOptions.batchMode) {
    resumeBatchSelectionHighlights();
  }

  updateBatchBadge();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "START_SELECTION") {
    startSelection(message.payload || {});
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "PREPARE_CAPTURE") {
    prepareCapture()
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error.message || "Falha ao preparar a captura."
        });
      });
    return true;
  }

  if (message?.type === "SCROLL_FOR_CAPTURE") {
    scrollForCapture(message.payload)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error.message || "Falha ao posicionar a pagina."
        });
      });
    return true;
  }

  if (message?.type === "COPY_TO_CLIPBOARD") {
    copyToClipboard(message.payload.dataUrl)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error.message || "Falha ao copiar a imagem."
        });
      });
    return true;
  }

  if (message?.type === "CAPTURE_PROGRESS") {
    const current = Number(message.payload?.current) || 0;
    const total = Number(message.payload?.total) || 0;
    const suffix = total > 1 ? ` (${current}/${total})` : "";
    showToast(`Montando captura${suffix}...`, false, 0);
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "CAPTURE_COMPLETE") {
    restoreAfterCapture();
    if (state.batchProcessing) {
      state.batchCaptureCount += 1;
      sendResponse({ ok: true });
      return false;
    }

    if (state.captureOptions.batchMode) {
      state.selectionActive = true;
      if (message.payload?.previewOpened) {
        showToast(`Captura ${state.batchCaptureCount} enviada para a previa. Continue selecionando ou pressione Esc para sair.`, false, 3200);
      } else
      if (message.payload?.copied) {
        showToast(`Captura ${state.batchCaptureCount} salva e copiada. Continue selecionando ou pressione Esc para sair.`, false, 3200);
      } else {
        showToast(`Captura ${state.batchCaptureCount} salva. Continue selecionando ou pressione Esc para sair.`, false, 3200);
      }
    } else {
      if (message.payload?.previewOpened) {
        showToast("Previa aberta em uma nova aba.");
      } else if (message.payload?.copied) {
        showToast("Print salvo e copiado para a area de transferencia.");
      } else {
        showToast("Print salvo com sucesso.");
      }
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "CAPTURE_FAILED") {
    restoreAfterCapture();
    if (state.batchProcessing) {
      sendResponse({ ok: true });
      return false;
    }
    if (state.captureOptions.batchMode) {
      state.selectionActive = true;
    }
    showToast(message.error || "Erro ao capturar o elemento.", true);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

document.addEventListener("mousemove", onMouseMove, true);
document.addEventListener("wheel", onWheel, { capture: true, passive: false });
document.addEventListener("click", onClick, true);
document.addEventListener("keydown", onKeyDown, true);
