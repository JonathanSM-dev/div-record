const PREVIEW_KEY_PREFIX = "previewCapture:";

const filenameElement = document.getElementById("filename");
const imageElement = document.getElementById("preview-image");
const statusElement = document.getElementById("status");
const downloadButton = document.getElementById("download");
const copyButton = document.getElementById("copy");
const closeButton = document.getElementById("close");

let previewKey = "";
let previewData = null;

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.style.color = isError ? "#b42318" : "#51627f";
}

function getPreviewId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("previewId");
}

async function loadPreview() {
  const previewId = getPreviewId();

  if (!previewId) {
    throw new Error("Previa invalida.");
  }

  previewKey = `${PREVIEW_KEY_PREFIX}${previewId}`;
  const stored = await chrome.storage.session.get(previewKey);
  previewData = stored[previewKey];

  if (!previewData?.imageDataUrl) {
    throw new Error("A captura desta previa nao esta mais disponivel.");
  }

  imageElement.src = previewData.imageDataUrl;
  filenameElement.textContent = previewData.filename || "";
  setStatus("Confira a imagem e escolha o que fazer.");
}

async function downloadPreview() {
  if (!previewData) {
    return;
  }

  await chrome.downloads.download({
    url: previewData.imageDataUrl,
    filename: previewData.filename,
    saveAs: Boolean(previewData.saveAs)
  });

  setStatus("Download iniciado.");
}

async function copyPreview() {
  if (!previewData) {
    return;
  }

  const response = await fetch(previewData.imageDataUrl);
  const blob = await response.blob();
  await navigator.clipboard.write([
    new ClipboardItem({
      [blob.type]: blob
    })
  ]);

  setStatus("Imagem copiada para a area de transferencia.");
}

async function cleanupAndClose() {
  if (previewKey) {
    await chrome.storage.session.remove(previewKey);
  }

  window.close();
}

downloadButton.addEventListener("click", () => {
  downloadPreview().catch((error) => {
    setStatus(error.message || "Falha ao iniciar o download.", true);
  });
});

copyButton.addEventListener("click", () => {
  copyPreview().catch((error) => {
    setStatus(error.message || "Falha ao copiar a imagem.", true);
  });
});

closeButton.addEventListener("click", () => {
  cleanupAndClose().catch(() => window.close());
});

loadPreview().catch((error) => {
  setStatus(error.message || "Falha ao carregar a previa.", true);
  downloadButton.disabled = true;
  copyButton.disabled = true;
});
