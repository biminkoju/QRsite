# QR Site

QR code generator and scanner — installable PWA, no build step.

## Run

    cd ~/dev/qrsite
    python3 -m http.server 8080

Open http://localhost:8080. Camera needs HTTPS (or localhost); tunnel or deploy to any static host for phone testing. The app also works from a subpath, because script, cache and share-target paths are relative.

## Test

    npm test        # or: node --test tests/

The smoke tests need no dependencies. They cover the QR generator, the CSV parser, and structural checks: every DOM id referenced exists, all libraries are vendored, the service worker precaches the app shell, and the share target is relative.

## Features

**Generate**
- Any content: links, text, email, phone, SMS.
- Structured presets: Wi-Fi, contact, location (geo), event (VEVENT), WhatsApp, and app deep links.
- Size auto-grows with content and error correction; the slider can't go below what the content needs.
- Shows the QR version and error-correction level, e.g. `v4 · ECC M · 33x33 modules`.
- If the content doesn't fit, offers a lower error-correction level instead of just failing.
- Warns on dark backgrounds and low contrast, which many scanners can't read.
- Optional caption under the code (PNG and print); center logo forces error correction to H.
- Custom colors, PNG and SVG download (path or `rect` output), page print, copy image, native share.
- History in localStorage with thumbnails and one-tap reload; export/import as JSON.

**Scan**
- Live camera scanning, rear camera default, switch camera, flashlight.
- Multi-code camera mode: decodes several codes per frame by masking regions.
- Image scan: click, drop or paste. Whole-image scan on load with upscale retries for tiny codes, plus drag-a-region selection that scans immediately.
- Barcodes via ZXing (EAN/UPC/Code128/Code39/ITF) in addition to QR.
- Scan history with cropped thumbnails.
- "Make QR" re-encodes a scan; "Make styled QR" re-encodes it with your current colors, logo and caption.

**Batch**
- CSV in, ZIP of PNGs or SVGs out. Accepts one-column text or `text,filename`, with or without a header row. Preview renders the first few.
- Cancellable mid-run; per-row failures are listed with row numbers instead of stopping the whole batch.

**PWA**
- Manifest, service worker with precached app shell and vendored libs, offline navigation.
- Updates are offered with an in-app banner rather than swapping code silently mid-session.
- Android share target: share an image from another app straight into the scanner.

**Accessibility**
- Visible focus rings, labelled color inputs, `aria-live` on scan results and batch status, tab/tablist state, reduced-motion support.

## Files

- `index.html`, `styles.css` — shell and theming (dark + light).
- `lib-core.js` — helpers, storage, theme, tab routing.
- `lib-csv.js` — CSV parsing, shared by the app and the tests.
- `app.js` — generator, presets, logo, caption, SVG, history, downloads, print, share.
- `scan.js` — camera, image, multi-code, barcode fallback, scan history, share target intake.
- `batch.js` — CSV batch job, ZIP output, cancel, per-row errors.
- `sw.js`, `manifest.webmanifest`, `icons/` — PWA.
- `tests/smoke.test.js` — dependency-free smoke tests.

## Libraries

`qrcode-generator`, `jsQR`, `JSZip`, and `@zxing/library`, vendored in `vendor/` so the app works offline and needs no CDN.

## History

This project started without version control; the initial commit captures the vendored libraries, the refactored app, and the smoke tests as a baseline.
