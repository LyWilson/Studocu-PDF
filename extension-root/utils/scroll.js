(() => {
  async function scrollUntilStable(options = {}) {
    const delayMs = options.delayMs ?? 200;
    const stepPx = options.stepPx ?? Math.max(400, Math.floor(window.innerHeight * 0.8));
    const stableChecksRequired = options.stableChecksRequired ?? 5;
    const maxIterations = options.maxIterations ?? 2000;

    let stableChecks = 0;
    let iterations = 0;
    let lastHeight = document.body.scrollHeight;

    console.log("[Studocu PDF] Starting page scroll", { delayMs, stepPx, stableChecksRequired, maxIterations });

    while (iterations < maxIterations && stableChecks < stableChecksRequired) {
      window.scrollBy(0, stepPx);
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      const currentHeight = document.body.scrollHeight;
      if (currentHeight > lastHeight) {
        lastHeight = currentHeight;
        stableChecks = 0;
      } else {
        stableChecks += 1;
      }
      iterations += 1;
    }

    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    console.log("[Studocu PDF] Scroll complete", { iterations, finalHeight: document.body.scrollHeight, stableChecks });

    return { iterations, finalHeight: document.body.scrollHeight, stableChecks };
  }

  window.StudocuPdfScrollUtils = { scrollUntilStable };
})();
