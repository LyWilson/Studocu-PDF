(() => {
  const STORAGE_KEY = "studocu_downloaded_urls";

  function api() {
    return globalThis.browser || globalThis.chrome;
  }

  function getFilenameFromUrl(url) {
    try {
      const pathname = new URL(url).pathname;
      return pathname.split("/").filter(Boolean).pop() || `file-${Date.now()}.png`;
    } catch (_) {
      return `file-${Date.now()}.png`;
    }
  }

  function sortByBgIndex(urls) {
    const rank = (url) => {
      const match = url.match(/Bg(\d+)\.(png|jpg)$/i);
      return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
    };

    return [...urls].sort((a, b) => {
      const diff = rank(a) - rank(b);
      return diff !== 0 ? diff : a.localeCompare(b);
    });
  }

  async function storageGet(key) {
    const value = await api().storage.local.get(key);
    return value[key];
  }

  async function storageSet(payload) {
    await api().storage.local.set(payload);
  }

  function waitForDownloadCompletion(downloadId) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        api().downloads.onChanged.removeListener(listener);
        reject(new Error(`Download timed out for id=${downloadId}`));
      }, 120000);

      const listener = (delta) => {
        if (delta.id !== downloadId) return;

        if (delta.state?.current === "complete") {
          clearTimeout(timeoutId);
          api().downloads.onChanged.removeListener(listener);
          resolve();
        }

        if (delta.state?.current === "interrupted") {
          clearTimeout(timeoutId);
          api().downloads.onChanged.removeListener(listener);
          reject(new Error(`Download interrupted for id=${downloadId}`));
        }
      };

      api().downloads.onChanged.addListener(listener);
    });
  }

  async function downloadWithRetry(url, maxAttempts = 3) {
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        console.log("[Studocu PDF] Downloading", { url, attempt });
        const filename = `studocu-images/${getFilenameFromUrl(url)}`;
        const id = await api().downloads.download({
          url,
          filename,
          conflictAction: "overwrite",
          saveAs: false
        });
        await waitForDownloadCompletion(id);
        return { url, filename, success: true };
      } catch (error) {
        console.warn("[Studocu PDF] Download attempt failed", { url, attempt, error: String(error?.message || error) });
        if (attempt >= maxAttempts) {
          return { url, filename: getFilenameFromUrl(url), success: false, error: String(error?.message || error) };
        }
      }
    }

    return { url, filename: getFilenameFromUrl(url), success: false, error: "Unexpected download state" };
  }

  async function downloadImages(urls) {
    const downloadedMap = (await storageGet(STORAGE_KEY)) || {};
    const uniqueOrdered = sortByBgIndex(Array.from(new Set(urls)));

    const toDownload = uniqueOrdered.filter((url) => !downloadedMap[url]);
    console.log("[Studocu PDF] Download queue", { total: uniqueOrdered.length, newItems: toDownload.length });

    const results = [];
    for (const url of toDownload) {
      const result = await downloadWithRetry(url);
      results.push(result);
      if (result.success) downloadedMap[url] = result.filename;
    }

    await storageSet({
      [STORAGE_KEY]: downloadedMap,
      studocu_last_downloaded_filenames: results.filter((r) => r.success).map((r) => r.filename)
    });

    return {
      orderedUrls: uniqueOrdered,
      downloadedNow: results,
      allKnownDownloads: downloadedMap
    };
  }

  globalThis.StudocuPdfDownloader = {
    downloadImages,
    sortByBgIndex
  };
})();
