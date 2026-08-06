(() => {
  function api() {
    return globalThis.browser || globalThis.chrome;
  }

  async function blobToDataUrl(blob) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function fetchImageBlob(url) {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${url} (${response.status})`);
    }
    return await response.blob();
  }

  async function buildCombinedPdf(urls) {
    const { jsPDF } = globalThis.jspdf;
    let pdf = null;

    for (let i = 0; i < urls.length; i += 1) {
      const url = urls[i];
      console.log("[Studocu PDF] Adding image to PDF", { index: i + 1, total: urls.length, url });
      const blob = await fetchImageBlob(url);
      const imageBitmap = await createImageBitmap(blob);
      const width = imageBitmap.width;
      const height = imageBitmap.height;

      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d", { alpha: false });
      context.drawImage(imageBitmap, 0, 0, width, height);
      imageBitmap.close();

      const pngBlob = await canvas.convertToBlob({ type: "image/png", quality: 1 });
      const dataUrl = await blobToDataUrl(pngBlob);

      if (!pdf) {
        pdf = new jsPDF({
          orientation: width >= height ? "landscape" : "portrait",
          unit: "px",
          format: [width, height],
          compress: false
        });
      } else {
        pdf.addPage([width, height], width >= height ? "landscape" : "portrait");
      }

      pdf.addImage(dataUrl, "PNG", 0, 0, width, height, undefined, "NONE");
    }

    if (!pdf) throw new Error("No images available to generate PDF");

    return pdf.output("blob");
  }

  async function savePdfBlob(blob, filename = "studocu_combined.pdf") {
    const objectUrl = URL.createObjectURL(blob);
    try {
      await api().downloads.download({
        url: objectUrl,
        filename,
        saveAs: true,
        conflictAction: "overwrite"
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
    }
  }

  globalThis.StudocuPdfBuilder = {
    buildCombinedPdf,
    savePdfBlob
  };
})();
