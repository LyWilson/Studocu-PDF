importScripts("libs/jspdf.umd.min.js", "utils/downloader.js", "utils/pdf.js");

const api = globalThis.browser || globalThis.chrome;
const activeRunsByTab = new Map();
const supportedPattern = /Bg\d+\.(png|jpg)$/i;

function isStudocuUrl(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "studocu.com" || hostname.endsWith(".studocu.com");
  } catch (_) {
    return false;
  }
}

async function injectContent(tabId) {
  await api.scripting.executeScript({
    target: { tabId },
    files: ["utils/scroll.js", "content.js"]
  });
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    api.tabs.sendMessage(tabId, message, (response) => {
      const error = api.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

async function runWorkflow(tabId, reason = "auto") {
  if (activeRunsByTab.get(tabId)) {
    console.log("[Studocu PDF] Workflow already running", { tabId });
    return;
  }

  activeRunsByTab.set(tabId, true);

  try {
    const tab = await api.tabs.get(tabId);
    if (!isStudocuUrl(tab.url)) {
      console.log("[Studocu PDF] Ignoring non-Studocu URL", tab.url);
      return;
    }

    console.log("[Studocu PDF] Starting workflow", { tabId, reason, url: tab.url });

    await injectContent(tabId);

    const scrapeResult = await sendMessageToTab(tabId, { type: "START_SCRAPE" });
    if (!scrapeResult?.ok) {
      throw new Error(scrapeResult?.error || "Scrape failed");
    }

    const filtered = scrapeResult.urls.filter((url) => supportedPattern.test(new URL(url).pathname));

    const downloadResult = await globalThis.StudocuPdfDownloader.downloadImages(filtered);
    const orderedUrls = globalThis.StudocuPdfDownloader.sortByBgIndex(Object.keys(downloadResult.allKnownDownloads));

    if (orderedUrls.length === 0) {
      throw new Error("No matching images were found");
    }

    const pdfBlob = await globalThis.StudocuPdfBuilder.buildCombinedPdf(orderedUrls);
    await globalThis.StudocuPdfBuilder.savePdfBlob(pdfBlob, "studocu_combined.pdf");

    await api.storage.local.set({
      studocu_last_run: {
        timestamp: new Date().toISOString(),
        tabId,
        reason,
        imageCount: orderedUrls.length
      }
    });

    console.log("[Studocu PDF] Workflow completed", { tabId, images: orderedUrls.length });
  } catch (error) {
    console.error("[Studocu PDF] Workflow failed", { tabId, error: String(error?.message || error) });
  } finally {
    activeRunsByTab.delete(tabId);
  }
}

api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && isStudocuUrl(tab.url)) {
    runWorkflow(tabId, "tab-updated");
  }
});

api.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await api.tabs.get(tabId);
    if (isStudocuUrl(tab.url)) {
      runWorkflow(tabId, "tab-activated");
    }
  } catch (error) {
    console.warn("[Studocu PDF] Failed to inspect active tab", String(error?.message || error));
  }
});

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "MANUAL_TRIGGER") return;

  api.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    try {
      const tab = tabs?.[0];
      if (!tab?.id) throw new Error("No active tab");
      if (!isStudocuUrl(tab.url)) throw new Error("Active tab is not a Studocu page");

      await runWorkflow(tab.id, "manual-trigger");
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message || error) });
    }
  });

  return true;
});
