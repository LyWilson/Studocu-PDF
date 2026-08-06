# Studocu-PDF

Browser extension (Manifest V3) that:

- Detects `studocu.com` tabs
- Auto-scrolls until lazy-loaded content stops growing
- Extracts `BgX.png` / `BgX.jpg` image URLs from `<img>` and CSS backgrounds
- Downloads deduplicated images with retry support
- Builds a single ordered PDF (`studocu_combined.pdf`) using jsPDF

## Project Structure

```text
/extension-root
  manifest.json
  background.js
  content.js
  popup.html
  popup.js
  /libs
    jspdf.umd.min.js
  /utils
    scroll.js
    downloader.js
    pdf.js
```

## Install (Chrome MV3)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select: `/home/runner/work/Studocu-PDF/Studocu-PDF/extension-root`

## Install (Firefox WebExtensions)

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json` from:
   `/home/runner/work/Studocu-PDF/Studocu-PDF/extension-root/manifest.json`

## Package as ZIP

```bash
cd /home/runner/work/Studocu-PDF/Studocu-PDF
zip -r studocu-extension.zip extension-root
```

## How It Works

- Auto-run: when a tab is updated/activated and hostname contains `studocu.com`
- Manual run: click the extension icon and press **Generate Studocu PDF**
- Image ordering: `Bg1 -> Bg2 -> Bg3 ...`
- PDF pages auto-fit image width/height with PNG embedding

## Debugging Checklist

1. **URL detection test**
   - Open `https://www.studocu.com/...`
   - Confirm service worker log: `Starting workflow`

2. **Scroll completion test**
   - In page console, verify logs: `Starting page scroll` then `Scroll complete`

3. **Image extraction test**
   - Verify log: `Extracted image URLs` with non-zero count
   - Ensure matched filenames end with `BgX.png` or `BgX.jpg`

4. **PDF generation test**
   - Confirm downloads complete
   - Confirm final file download: `studocu_combined.pdf`
   - Validate page order and dimensions visually
