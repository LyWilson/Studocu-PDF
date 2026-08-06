importScripts("libs/jspdf.umd.min.js", "utils/pdf.js");

const api = globalThis.browser || globalThis.chrome;
const activeRunsByTab = new Map();
const supportedPattern = /bg[0-9a-f]+\.(png|jpg)$/i;

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

async function runWorkflow(tabId, reason = "manual") {
  if (activeRunsByTab.get(tabId)) {
    return { ok: false, error: "Workflow already running" };
  }

  activeRunsByTab.set(tabId, true);

  try {
    const tab = await api.tabs.get(tabId);
    if (!isStudocuUrl(tab.url)) {
      return { ok: false, error: "Active tab is not a Studocu page" };
    }

    await injectContent(tabId);

    const scrapeResult = await sendMessageToTab(tabId, { type: "START_SCRAPE" });
    if (!scrapeResult?.ok) {
      throw new Error(scrapeResult?.error || "Scrape failed");
    }

    const filtered = scrapeResult.urls.filter((url) => supportedPattern.test(new URL(url).pathname));
    const orderedUrls = globalThis.StudocuPdfBuilder.sortByBgIndex([...new Set(filtered)]);

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
    return { ok: true, imageCount: orderedUrls.length };
  } catch (error) {
    const message = String(error?.message || error);
    console.error("[Studocu PDF] Workflow failed", { tabId, error: message });
    return { ok: false, error: message };
  } finally {
    activeRunsByTab.delete(tabId);
  }
}

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "MANUAL_TRIGGER") return;

  api.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    try {
      const tab = tabs?.[0];
      if (!tab?.id) throw new Error("No active tab");
      const result = await runWorkflow(tab.id, "manual-trigger");
      sendResponse(result);
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message || error) });
    }
  });

  return true;
});
