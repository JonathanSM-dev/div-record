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

const state = {
  selectionActive: false,
  overlay: null,
  label: null,
  toast: null,
  toastTimer: null,
  captureSession: null,
  captureOptions: {
    margin: 8,
    copyToClipboard: false,
    filenamePrefix: "div-record",
    saveAs: true
  },
  currentPath: [],
  pathIndex: 0,
  lastPointerTarget: null
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

  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(label);

  state.overlay = overlay;
  state.label = label;
}

function hideOverlay() {
  if (!state.overlay || !state.label) {
    return;
  }

  state.overlay.style.width = "0";
  state.overlay.style.height = "0";
  state.label.style.opacity = "0";
}

function setOverlayVisibility(visible) {
  if (!state.overlay || !state.label) {
    return;
  }

  state.overlay.style.display = visible ? "block" : "none";
  state.label.style.display = visible ? "block" : "none";
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

  state.label.textContent = `Capturar ${describeElement(element)}${hierarchyLabel}`;
  state.label.style.opacity = "1";
  state.label.style.left = `${Math.max(8, rect.left)}px`;
  state.label.style.top = `${Math.max(8, rect.top - 34)}px`;
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
  state.captureOptions = {
    margin: Number.isFinite(options.margin) ? options.margin : 8,
    copyToClipboard: Boolean(options.copyToClipboard),
    filenamePrefix: typeof options.filenamePrefix === "string" && options.filenamePrefix.trim()
      ? options.filenamePrefix.trim()
      : "div-record",
    saveAs: "saveAs" in options ? Boolean(options.saveAs) : true
  };

  showToast("Selecao ativa. Use roda do mouse ou setas para mudar o container.", false, 3200);
}

function stopSelection() {
  state.selectionActive = false;
  state.currentPath = [];
  state.pathIndex = 0;
  state.lastPointerTarget = null;
  hideOverlay();
}

function onMouseMove(event) {
  if (!state.selectionActive) {
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

  state.selectionActive = false;
  updateOverlay(element);
  clearToast();

  chrome.runtime.sendMessage({
    type: "CAPTURE_ELEMENT",
    payload: {
      selectorLabel: describeElement(element),
      copyToClipboard: state.captureOptions.copyToClipboard,
      filenamePrefix: state.captureOptions.filenamePrefix,
      saveAs: state.captureOptions.saveAs
    }
  }, (response) => {
    if (chrome.runtime.lastError) {
      showToast(chrome.runtime.lastError.message, true);
      return;
    }

    if (!response?.ok) {
      showToast(response?.error || "Falha ao capturar o elemento.", true);
    }
  });
}

function onKeyDown(event) {
  if (!state.selectionActive) {
    return;
  }

  if (event.key === "Escape") {
    stopSelection();
    showToast("Selecao cancelada.");
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
  }
}

async function prepareCapture() {
  const element = getCurrentElement();

  if (!element || !document.contains(element)) {
    throw new Error("O elemento selecionado nao esta mais disponivel.");
  }

  state.captureSession = {
    scrollX: window.scrollX,
    scrollY: window.scrollY
  };

  clearToast();
  setOverlayVisibility(false);

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
  if (state.captureSession) {
    window.scrollTo({
      left: state.captureSession.scrollX,
      top: state.captureSession.scrollY,
      behavior: "auto"
    });
  }

  state.captureSession = null;
  hideOverlay();
  setOverlayVisibility(true);
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
    if (message.payload?.copied) {
      showToast("Print salvo e copiado para a area de transferencia.");
    } else {
      showToast("Print salvo com sucesso.");
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "CAPTURE_FAILED") {
    restoreAfterCapture();
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
