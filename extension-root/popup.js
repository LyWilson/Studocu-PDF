const statusNode = document.getElementById("status");

function setStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.style.color = isError ? "#b71c1c" : "#1b5e20";
}

document.getElementById("run").addEventListener("click", async () => {
  setStatus("Running...");

  chrome.runtime.sendMessage({ type: "MANUAL_TRIGGER" }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message, true);
      return;
    }

    if (!response?.ok) {
      setStatus(response?.error || "Failed to start", true);
      return;
    }

    setStatus("Workflow started. Check extension/service worker logs.");
  });
});
