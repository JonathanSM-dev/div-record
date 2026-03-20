const STORAGE_KEY = "divRecordOptions";
const DEFAULT_OPTIONS = {
  margin: 8,
  copyToClipboard: false,
  filenamePrefix: "div-record",
  saveAs: true,
  hideFloatingUi: true,
  batchMode: false
};

const startButton = document.getElementById("start-selection");
const statusElement = document.getElementById("status");
const marginSelect = document.getElementById("margin");
const copyCheckbox = document.getElementById("copy-to-clipboard");
const filenamePrefixInput = document.getElementById("filename-prefix");
const saveAsCheckbox = document.getElementById("save-as");
const hideFloatingUiCheckbox = document.getElementById("hide-floating-ui");
const batchModeCheckbox = document.getElementById("batch-mode");

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
  saveAsCheckbox.checked = Boolean(options.saveAs);
  hideFloatingUiCheckbox.checked = Boolean(options.hideFloatingUi);
  batchModeCheckbox.checked = Boolean(options.batchMode);
}

async function saveOptions() {
  const options = {
    margin: Number(marginSelect.value),
    copyToClipboard: copyCheckbox.checked,
    filenamePrefix: (filenamePrefixInput.value || DEFAULT_OPTIONS.filenamePrefix).trim() || DEFAULT_OPTIONS.filenamePrefix,
    saveAs: saveAsCheckbox.checked,
    hideFloatingUi: hideFloatingUiCheckbox.checked,
    batchMode: batchModeCheckbox.checked
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

saveAsCheckbox.addEventListener("change", () => {
  saveOptions().catch(() => {});
});

hideFloatingUiCheckbox.addEventListener("change", () => {
  saveOptions().catch(() => {});
});

batchModeCheckbox.addEventListener("change", () => {
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
