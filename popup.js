const STORAGE_KEY = "divRecordOptions";
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

const startButton = document.getElementById("start-selection");
const statusElement = document.getElementById("status");
const marginSelect = document.getElementById("margin");
const copyCheckbox = document.getElementById("copy-to-clipboard");
const filenamePrefixInput = document.getElementById("filename-prefix");
const filenameStyleSelect = document.getElementById("filename-style");
const saveAsCheckbox = document.getElementById("save-as");
const previewBeforeSaveCheckbox = document.getElementById("preview-before-save");
const hideFloatingUiCheckbox = document.getElementById("hide-floating-ui");
const batchModeCheckbox = document.getElementById("batch-mode");
const exportBatchZipCheckbox = document.getElementById("export-batch-zip");

function syncBatchExportAvailability() {
  const batchEnabled = batchModeCheckbox.checked;
  exportBatchZipCheckbox.disabled = !batchEnabled;

  if (!batchEnabled) {
    exportBatchZipCheckbox.checked = false;
  }
}

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.style.color = isError ? "#b42318" : "#1357d4";
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function loadOptions() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const options = {
    ...DEFAULT_OPTIONS,
    ...(stored[STORAGE_KEY] || {})
  };

  marginSelect.value = String(options.margin);
  copyCheckbox.checked = Boolean(options.copyToClipboard);
  filenamePrefixInput.value = options.filenamePrefix || DEFAULT_OPTIONS.filenamePrefix;
  filenameStyleSelect.value = options.filenameStyle || DEFAULT_OPTIONS.filenameStyle;
  saveAsCheckbox.checked = Boolean(options.saveAs);
  previewBeforeSaveCheckbox.checked = Boolean(options.previewBeforeSave);
  hideFloatingUiCheckbox.checked = Boolean(options.hideFloatingUi);
  batchModeCheckbox.checked = Boolean(options.batchMode);
  exportBatchZipCheckbox.checked = Boolean(options.exportBatchZip);
  syncBatchExportAvailability();
}

async function saveOptions() {
  const options = {
    margin: Number(marginSelect.value),
    copyToClipboard: copyCheckbox.checked,
    filenamePrefix: (filenamePrefixInput.value || DEFAULT_OPTIONS.filenamePrefix).trim() || DEFAULT_OPTIONS.filenamePrefix,
    filenameStyle: filenameStyleSelect.value || DEFAULT_OPTIONS.filenameStyle,
    saveAs: saveAsCheckbox.checked,
    previewBeforeSave: previewBeforeSaveCheckbox.checked,
    hideFloatingUi: hideFloatingUiCheckbox.checked,
    batchMode: batchModeCheckbox.checked,
    exportBatchZip: exportBatchZipCheckbox.checked
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: options });
  return options;
}

marginSelect.addEventListener("change", () => {
  saveOptions().catch(() => {});
});

copyCheckbox.addEventListener("change", () => {
  saveOptions().catch(() => {});
});

filenamePrefixInput.addEventListener("change", () => {
  saveOptions().catch(() => {});
});

filenameStyleSelect.addEventListener("change", () => {
  saveOptions().catch(() => {});
});

saveAsCheckbox.addEventListener("change", () => {
  saveOptions().catch(() => {});
});

previewBeforeSaveCheckbox.addEventListener("change", () => {
  saveOptions().catch(() => {});
});

hideFloatingUiCheckbox.addEventListener("change", () => {
  saveOptions().catch(() => {});
});

batchModeCheckbox.addEventListener("change", () => {
  syncBatchExportAvailability();
  saveOptions().catch(() => {});
});

exportBatchZipCheckbox.addEventListener("change", () => {
  saveOptions().catch(() => {});
});

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  setStatus("Ativando selecao na pagina...");

  try {
    const tab = await getActiveTab();

    if (!tab?.id) {
      throw new Error("Nao encontrei a aba ativa.");
    }

    const options = await saveOptions();

    await chrome.tabs.sendMessage(tab.id, {
      type: "START_SELECTION",
      payload: options
    });

    setStatus("Passe o mouse e clique no elemento que deseja capturar.");
    window.close();
  } catch (error) {
    setStatus(error.message || "Nao foi possivel iniciar a selecao.", true);
    startButton.disabled = false;
  }
});

loadOptions().catch(() => {
  setStatus("Nao foi possivel carregar as opcoes salvas.", true);
});
