(() => {
  const IMAGE_PATTERN = /Bg\d+\.(png|jpg)$/i;

  function normalizeUrl(rawUrl) {
    if (!rawUrl) return null;
    try {
      return new URL(rawUrl, window.location.href).href;
    } catch (_) {
      return null;
    }
  }

  function extractBackgroundImageUrl(backgroundImageValue) {
    if (!backgroundImageValue || backgroundImageValue === "none") return null;
    const match = backgroundImageValue.match(/url\(["']?(.*?)["']?\)/i);
    return match ? match[1] : null;
  }

  function matchesPattern(url) {
    try {
      const parsed = new URL(url);
      return IMAGE_PATTERN.test(parsed.pathname);
    } catch (_) {
      return false;
    }
  }

  function collectImageUrls() {
    const found = new Set();

    for (const img of document.querySelectorAll("img")) {
      const src = normalizeUrl(img.currentSrc || img.src);
      if (src && matchesPattern(src)) found.add(src);
    }

    for (const el of document.querySelectorAll("*")) {
      const styles = getComputedStyle(el);
      const bgUrl = normalizeUrl(extractBackgroundImageUrl(styles.backgroundImage));
      if (bgUrl && matchesPattern(bgUrl)) found.add(bgUrl);
    }

    const urls = Array.from(found);
    console.log("[Studocu PDF] Extracted image URLs", urls.length);
    return urls;
  }

  async function scrapePage() {
    if (!window.StudocuPdfScrollUtils?.scrollUntilStable) {
      throw new Error("Scroll utilities not loaded");
    }

    await window.StudocuPdfScrollUtils.scrollUntilStable({
      delayMs: 200,
      stepPx: Math.max(500, Math.floor(window.innerHeight * 0.9)),
      stableChecksRequired: 6,
      maxIterations: 2500
    });

    return collectImageUrls();
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "START_SCRAPE") return;

    scrapePage()
      .then((urls) => sendResponse({ ok: true, urls }))
      .catch((error) => {
        console.error("[Studocu PDF] Scrape failed", error);
        sendResponse({ ok: false, error: String(error?.message || error) });
      });

    return true;
  });
})();
