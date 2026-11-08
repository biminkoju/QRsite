/* QR Site — scanner (camera, image, history) */
(() => {
  'use strict';
  const { $, toast, store, switchTab, onTabLeaveScan, SCAN_HISTORY_KEY, HISTORY_MAX } = window.QRS;

  const resultBox = $('scan-result');
  const resultText = $('result-text');
  const resultMeta = $('result-meta');
  const resultDomain = $('result-domain');
  const resultBadge = $('result-badge');
  const btnOpen = $('btn-open-result');
  const btnCopyVcard = $('btn-copy-vcard');
  const btnShareResult = $('btn-share-result');
  const btnCopyWifi = $('btn-copy-wifi');
  const btnAddContacts = $('btn-add-contacts');
  const btnDownloadResult = $('btn-download-result');
  const btnPrintResult = $('btn-print-result');

  function safeUrl(text) {
    try {
      const u = new URL(text);
      if (['http:', 'https:', 'mailto:', 'tel:', 'sms:'].includes(u.protocol)) return u.href;
    } catch (e) {}
    return null;
  }

  function detectResultType(text) {
    const t = text.trim();
    if (t.startsWith('BEGIN:VCARD')) return { id: 'vcard', label: 'Contact' };
    if (t.startsWith('BEGIN:VEVENT')) return { id: 'event', label: 'Calendar event' };
    if (t.startsWith('WIFI:')) return { id: 'wifi', label: 'Wi-Fi network' };
    if (/^geo:[-0-9.,]+/.test(t)) return { id: 'geo', label: 'Location' };
    if (/^smsto:/.test(t)) return { id: 'sms', label: 'SMS' };
    if (/^tel:/.test(t)) return { id: 'phone', label: 'Phone number' };
    if (/^mailto:/.test(t)) return { id: 'email', label: 'Email address' };
    const url = safeUrl(t);
    if (url) return { id: 'url', label: 'Link' };
    return { id: 'text', label: 'Text' };
  }

  function showResult(text, meta, thumb) {
    resultBox.hidden = false;
    resultText.value = text;
    resultText.readOnly = false;
    resultMeta.textContent = meta || '';
    resultBadge.textContent = 'Detected';
    resultBadge.classList.remove('error');
    const url = safeUrl(text);
    btnOpen.hidden = !url;
    if (url) btnOpen.dataset.url = url;
    resultDomain.hidden = !url;
    resultDomain.textContent = url ? new URL(url).hostname : '';
    btnCopyVcard.hidden = !text.trim().startsWith('BEGIN:VCARD');

    /* Result type detection + contextual buttons */
    const type = detectResultType(text);
    resultType.hidden = !type;
    resultType.textContent = type.label;

    btnShareResult.hidden = !navigator.share;
    btnCopyWifi.hidden = type.id !== 'wifi';
    btnAddContacts.hidden = type.id !== 'vcard';
    btnDownloadResult.hidden = false;
    btnPrintResult.hidden = false;

    addHistory(text, meta, thumb, type.id);
  }

  function showError(msg) {
    resultBox.hidden = false;
    resultText.value = '';
    resultText.readOnly = false;
    resultDomain.hidden = true;
    resultType.hidden = true;
    resultMeta.textContent = msg;
    resultBadge.textContent = 'Not found';
    resultBadge.classList.add('error');
    btnOpen.hidden = true;
    btnShareResult.hidden = true;
    btnCopyWifi.hidden = true;
    btnAddContacts.hidden = true;
    btnDownloadResult.hidden = true;
    btnPrintResult.hidden = true;
  }

  $('btn-clear-result').addEventListener('click', () => { resultBox.hidden = true; });
  $('btn-copy-result').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(resultText.value); toast('Copied'); }
    catch (e) { toast('Copy failed'); }
  });
  btnCopyVcard.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(resultText.value); toast('vCard copied'); }
    catch (e) { toast('Copy failed'); }
  });
  btnOpen.addEventListener('click', () => {
    if (btnOpen.dataset.url) window.open(btnOpen.dataset.url, '_blank', 'noopener');
  });
  btnShareResult.addEventListener('click', async () => {
    try { await navigator.share({ title: 'QR Scan Result', text: resultText.value }); }
    catch (e) { /* cancelled */ }
  });
  btnCopyWifi.addEventListener('click', async () => {
    const text = resultText.value;
    const m = text.match(/P:([^;]+)/);
    if (m) { try { await navigator.clipboard.writeText(m[1]); toast('Wi-Fi password copied'); }
      catch (e) { toast('Copy failed'); } }
    else toast('No Wi-Fi password found');
  });
  btnAddContacts.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(resultText.value); toast('Contact copied'); }
    catch (e) { toast('Copy failed'); }
  });
  btnDownloadResult.addEventListener('click', () => {
    const text = resultText.value.trim();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'qr-scan-result.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Downloaded result');
  });
  btnPrintResult.addEventListener('click', () => {
    const text = resultText.value.trim();
    if (!text) return;
    const win = window.open('', '_blank');
    if (!win) { toast('Allow popups to print'); return; }
    const escaped = String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    win.document.write('<!DOCTYPE html><title>QR Scan Result</title>' +
      '<style>body{margin:0;font-family:system-ui,sans-serif;padding:24px;background:#fff;color:#000}' +
      'pre{white-space:pre-wrap;word-wrap:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:16px}' +
      'h1{font-size:20px;margin:0 0 12px}</style>' +
      '<h1>QR Scan Result</h1><pre>' + escaped + '</pre>');
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch (e) {} }, 350);
  });
  $('btn-generate-from-result').addEventListener('click', () => {
    window.QRSGen.setInput(resultText.value);
    switchTab('generate');
  });

  /* Re-encode a scanned code with the current look and feel (colors, logo, caption). */
  $('btn-restyle-from-result').addEventListener('click', () => {
    const text = resultText.value;
    if (!text) return;
    window.QRSGen.setInput(text, {
      foreground: $('fg').value,
      background: $('bg').value,
      caption: $('qr-caption').value,
    });
    switchTab('generate');
    toast('Re-encoded with your current styling');
  });

  /* ---- history ---- */
  function addHistory(text, meta, thumb, typeId) {
    const list = store.get(SCAN_HISTORY_KEY, []);
    if (list.length && list[0].text === text && Date.now() - list[0].at < 3000) return;
    list.unshift({ text, meta: meta || '', thumb: thumb || '', at: Date.now(), type: typeId || 'text', starred: false });
    store.set(SCAN_HISTORY_KEY, list.slice(0, HISTORY_MAX));
    renderHistory();
  }

  function typeIcon(typeId) {
    const icons = {
      url: '↗', wifi: '📶', vcard: '👤', event: '📅', geo: '📍',
      sms: '💬', phone: '📞', email: '✉', text: '📄'
    };
    return icons[typeId] || '📄';
  }

  function renderHistory() {
    const list = $('scan-history');
    const filter = $('scan-filter');
    const countEl = $('scan-filter-count');
    const prune = $('scan-prune');

    /* Auto-prune: drop items older than 30 days if enabled */
    const items = store.get(SCAN_HISTORY_KEY, []);
    if (prune && prune.checked) {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const kept = items.filter((it) => it.at > cutoff);
      if (kept.length !== items.length) {
        store.set(SCAN_HISTORY_KEY, kept);
        renderHistory();
        return;
      }
    }

    let term = (filter && filter.value) ? filter.value.trim().toLowerCase() : '';
    let shown = items.filter((it) => {
      if (term && !it.text.toLowerCase().includes(term)) return false;
      return true;
    });

    /* Starred first */
    shown = shown.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0));

    if (countEl) countEl.textContent = term ? ('' + shown.length + ' match' + (shown.length !== 1 ? 'es' : '')) : ('' + items.length + ' item' + (items.length !== 1 ? 's' : ''));

    list.innerHTML = '';
    shown.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      const img = document.createElement('img');
      img.className = 'thumb'; img.alt = '';
      if (item.thumb) img.src = item.thumb;
      else { img.classList.add('placeholder'); img.textContent = typeIcon(item.type); }
      const meta = document.createElement('div'); meta.className = 'meta';
      const val = document.createElement('span'); val.className = 'value'; val.textContent = item.text;
      const sub = document.createElement('span'); sub.className = 'sub'; sub.textContent = new Date(item.at).toLocaleString();
      meta.append(val, sub);
      const actions = document.createElement('div'); actions.className = 'item-actions';
      const copy = document.createElement('button'); copy.textContent = 'Copy';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(item.text); toast('Copied'); } catch (e) { toast('Copy failed'); }
      });
      const reuse = document.createElement('button'); reuse.textContent = 'QR';
      reuse.addEventListener('click', () => { window.QRSGen.setInput(item.text); switchTab('generate'); });
      const star = document.createElement('button');
      star.textContent = item.starred ? '★' : '☆';
      star.setAttribute('aria-label', item.starred ? 'Unfavorite' : 'Favorite');
      star.addEventListener('click', () => {
        const all = store.get(SCAN_HISTORY_KEY, []);
        const idx = all.findIndex((x) => x.at === item.at && x.text === item.text);
        if (idx !== -1) {
          all[idx].starred = !all[idx].starred;
          store.set(SCAN_HISTORY_KEY, all);
          renderHistory();
          toast(item.starred ? 'Unfavorited' : 'Favorited');
        }
      });
      const del = document.createElement('button'); del.textContent = '✕';
      del.setAttribute('aria-label', 'Delete history entry');
      del.addEventListener('click', () => {
        store.set(SCAN_HISTORY_KEY, store.get(SCAN_HISTORY_KEY, []).filter((x) => x.at !== item.at || x.text !== item.text));
        renderHistory();
      });
      actions.append(copy, reuse, star, del);
      li.append(img, meta, actions);
      list.appendChild(li);
    });
  }

  $('btn-clear-scan-history').addEventListener('click', () => {
    var snapshot = store.get(SCAN_HISTORY_KEY, []);
    if (!snapshot.length) { toast('Nothing to clear'); return; }
    store.del(SCAN_HISTORY_KEY);
    renderHistory();
    toast('Scan history cleared', {
      undo: function () { store.set(SCAN_HISTORY_KEY, snapshot); renderHistory(); },
      undoLabel: 'Undo'
    });
  });

  $('btn-export-scan-history').addEventListener('click', () => {
    const items = store.get(SCAN_HISTORY_KEY, []);
    if (!items.length) { toast('Nothing to export'); return; }
    const payload = { app: 'qrsite', kind: 'scan-history', version: 1, exportedAt: new Date().toISOString(), items };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'qrsite-scan-history.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Scan history exported');
  });

  const scanFilter = $('scan-filter');
  if (scanFilter) {
    scanFilter.addEventListener('input', renderHistory);
  }

  renderHistory();

  /* ---- decode helpers ---- */
  function decodeQr(imgData) {
    return window.jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'attemptBoth' });
  }

  function decodeZxing(imgData) {
    try {
      const ZX = window.ZXing;
      if (!ZX) return null;
      const hints = new Map();
      hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [
        ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.UPC_A,
        ZX.BarcodeFormat.UPC_E, ZX.BarcodeFormat.CODE_128, ZX.BarcodeFormat.CODE_39,
        ZX.BarcodeFormat.ITF, ZX.BarcodeFormat.CODABAR, ZX.BarcodeFormat.QR_CODE,
      ]);
      hints.set(ZX.DecodeHintType.TRY_HARDER, true);
      const src = new ZX.RGBLuminanceSource(imgData.data, imgData.width, imgData.height);
      const bitmap = new ZX.BinaryBitmap(new ZX.HybridBinarizer(src));
      const reader = new ZX.MultiFormatReader();
      reader.setHints(hints);
      const result = reader.decode(bitmap);
      return result ? result.getText() : null;
    } catch (e) { return null; }
  }

  function decodeAny(imgData) {
    const qr = decodeQr(imgData);
    if (qr) return { text: qr.data, location: qr.location, kind: 'qr' };
    const bar = decodeZxing(imgData);
    if (bar) return { text: bar, location: null, kind: 'barcode' };
    return null;
  }

  function thumbnailOf(canvasEl) {
    const t = document.createElement('canvas');
    t.width = 96; t.height = 96;
    t.getContext('2d').drawImage(canvasEl, 0, 0, 96, 96);
    return t.toDataURL('image/jpeg', 0.7);
  }

  function drawBox(container, x, y, w, h, flat) {
    const box = document.createElement('div');
    box.className = 'selection' + (flat ? ' flat' : '');
    box.style.left = x + 'px';
    box.style.top = y + 'px';
    box.style.width = w + 'px';
    box.style.height = h + 'px';
    container.appendChild(box);
  }

  function boundsOf(loc) {
    const xs = [loc.topLeftCorner.x, loc.topRightCorner.x, loc.bottomRightCorner.x, loc.bottomLeftCorner.x];
    const ys = [loc.topLeftCorner.y, loc.topRightCorner.y, loc.bottomRightCorner.y, loc.bottomLeftCorner.y];
    return {
      x: Math.min.apply(null, xs), y: Math.min.apply(null, ys),
      x2: Math.max.apply(null, xs), y2: Math.max.apply(null, ys),
    };
  }

  /* =============== CAMERA =============== */
  const video = $('video');
  const overlay = $('scan-overlay');
  const camPlaceholder = $('camera-placeholder');
  const btnStart = $('btn-start-camera');
  const btnStop = $('btn-stop-camera');
  const btnSwitch = $('btn-switch-camera');
  const torchToggle = $('torch');
  const multiCam = $('multi-scan');

  let stream = null, rafId = null, videoTrack = null;
  let facingMode = 'environment', lastScanAt = 0, lastCode = null, lastCodeAt = 0;

  const scanCanvas = document.createElement('canvas');
  const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });

  async function startCamera() {
    try {
      stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      videoTrack = stream.getVideoTracks()[0];
      camPlaceholder.hidden = true;
      btnStop.hidden = false;
      btnSwitch.hidden = false;
      const caps = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
      torchToggle.disabled = !caps.torch;
      torchToggle.checked = false;
      lastScanAt = 0;
      rafId = requestAnimationFrame(loop);
    } catch (err) {
      camPlaceholder.hidden = false;
      camPlaceholder.querySelector('p').textContent =
        err && err.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Could not access camera. Try HTTPS or another browser.';
    }
  }

  function stopCamera() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    videoTrack = null;
    if (video) video.srcObject = null;
    if (camPlaceholder) { camPlaceholder.hidden = false; camPlaceholder.querySelector('p').textContent = 'Camera is off'; }
    if (btnStop) btnStop.hidden = true;
    if (btnSwitch) btnSwitch.hidden = true;
    if (torchToggle) { torchToggle.disabled = true; torchToggle.checked = false; }
    clearOverlay();
  }

  function clearOverlay() { while (overlay.firstChild) overlay.removeChild(overlay.firstChild); }

  function loop(ts) {
    if (!stream) return;
    rafId = requestAnimationFrame(loop);
    if (ts - lastScanAt < 100) return;
    lastScanAt = ts;
    if (!video.videoWidth) return;

    const scale = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight));
    scanCanvas.width = Math.round(video.videoWidth * scale);
    scanCanvas.height = Math.round(video.videoHeight * scale);
    scanCtx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);

    const img = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
    const rect = overlay.getBoundingClientRect();
    const sx = rect.width / scanCanvas.width;
    const sy = rect.height / scanCanvas.height;
    clearOverlay();

    if (multiCam.checked) {
      scanMany(img, rect, sx, sy);
      return;
    }

    const found = decodeAny(img);
    if (!found) return;

    if (found.location) {
      const b = boundsOf(found.location);
      drawBox(overlay, b.x * sx, b.y * sy, (b.x2 - b.x) * sx, (b.y2 - b.y) * sy, false);
    }
    report(found.text, 'Scanned from camera');
  }

  function scanMany(img, rect, sx, sy) {
    // Mask each decoded region and retry: surfaces several codes in one frame.
    const work = document.createElement('canvas');
    work.width = img.width; work.height = img.height;
    const wctx = work.getContext('2d', { willReadFrequently: true });
    wctx.putImageData(img, 0, 0);

    const seen = [];
    for (let i = 0; i < 6; i++) {
      const data = wctx.getImageData(0, 0, work.width, work.height);
      const code = decodeQr(data);
      if (!code || seen.indexOf(code.data) !== -1) break;
      seen.push(code.data);
      if (code.location) {
        const b = boundsOf(code.location);
        drawBox(overlay, b.x * sx, b.y * sy, (b.x2 - b.x) * sx, (b.y2 - b.y) * sy, true);
        wctx.fillStyle = '#fff';
        wctx.fillRect(b.x - 4, b.y - 4, (b.x2 - b.x) + 8, (b.y2 - b.y) + 8);
      }
    }
    if (seen.length) {
      seen.forEach((t) => report(t, 'Scanned from camera (multi)'));
    }
  }

  function report(text, source) {
    const now = Date.now();
    if (text === lastCode && now - lastCodeAt < 2000) return;
    lastCode = text; lastCodeAt = now;
    if (navigator.vibrate) navigator.vibrate(60);
    showResult(text, source + ' · ' + new Date().toLocaleTimeString(), thumbnailOf(scanCanvas));
  }

  btnStart.addEventListener('click', startCamera);
  btnStop.addEventListener('click', stopCamera);
  btnSwitch.addEventListener('click', () => {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera();
  });
  torchToggle.addEventListener('change', async () => {
    if (!videoTrack) return;
    try { await videoTrack.applyConstraints({ advanced: [{ torch: torchToggle.checked }] }); }
    catch (e) { toast('Flashlight not supported'); torchToggle.checked = false; }
  });
  onTabLeaveScan(stopCamera);

  /* =============== IMAGE =============== */
  const dropzone = $('dropzone');
  const fileInput = $('file-input');
  const editor = $('editor');
  const imgCanvas = $('image-canvas');
  const imgCtx = imgCanvas.getContext('2d', { willReadFrequently: true });
  const selectionEl = $('selection');
  const btnScanAll = $('btn-scan-all');
  const btnScanRegion = $('btn-scan-region');
  const btnClearSel = $('btn-clear-selection');
  const btnNewImage = $('btn-new-image');
  const multiImage = $('multi-scan-image');

  let loaded = false, sel = null, dragging = false, dragStart = null;

  function selectScanMode(mode) {
    document.querySelectorAll('.seg').forEach((b) => {
      const on = b.dataset.scan === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.scan-view').forEach((v) => v.classList.remove('active'));
    $('scan-' + mode).classList.add('active');
    if (mode !== 'camera') stopCamera();
  }

  document.querySelectorAll('.seg').forEach((btn) => {
    btn.addEventListener('click', () => selectScanMode(btn.dataset.scan));
  });

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  fileInput.addEventListener('change', () => {
    const files = fileInput.files && Array.prototype.slice.call(fileInput.files);
    if (!files || !files.length) return;
    scanImageQueue(files);
    fileInput.value = '';
  });
  ['dragenter', 'dragover'].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); }));
  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files && Array.prototype.slice.call(e.dataTransfer.files);
    if (files && files.length) scanImageQueue(files);
  });

  window.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const it of items) {
      if (it.type.indexOf('image/') === 0) {
        const blob = it.getAsFile();
        if (blob) {
          e.preventDefault();
          switchTab('scan');
          document.querySelector('.seg[data-scan="image"]').click();
          loadFile(blob);
        }
        return;
      }
    }
  });

  function scanImageQueue(files) {
    files = files.filter(function (f) { return f.type.indexOf('image/') === 0; });
    if (!files.length) { toast('No images selected'); return; }
    switchTab('scan');
    document.querySelector('.seg[data-scan="image"]').click();
    var i = 0;
    function next() {
      if (i >= files.length) return;
      loadFile(files[i], i === files.length - 1);
      i++;
    }
    next();
  }

  function loadFile(file, last) {
    if (file.type.indexOf('image/') !== 0) { toast('That is not an image'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1600;
      const s = Math.min(1, maxDim / Math.max(img.width, img.height));
      imgCanvas.width = Math.round(img.width * s);
      imgCanvas.height = Math.round(img.height * s);
      imgCtx.drawImage(img, 0, 0, imgCanvas.width, imgCanvas.height);
      imgCanvas.style.width = '100%';
      imgCanvas.style.height = 'auto';
      dropzone.hidden = true;
      editor.hidden = false;
      loaded = true;
      clearSel();
      setTimeout(function () {
        if (!scanWhole(true)) showError('No QR code found in the whole image. Drag a region to search a smaller area.');
        if (last) return;
        next();
      }, 50);
    };
    img.onerror = () => toast('Could not load that image');
    img.src = url;
  }

  function clearSel() {
    sel = null;
    selectionEl.hidden = true;
    btnScanRegion.disabled = true;
    btnClearSel.disabled = true;
  }

  function point(e) {
    const r = imgCanvas.getBoundingClientRect();
    const sx = imgCanvas.width / r.width, sy = imgCanvas.height / r.height;
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    return { x: cx * sx, y: cy * sy, cssX: cx, cssY: cy };
  }

  function showSel(x, y, w, h) {
    selectionEl.hidden = false;
    selectionEl.style.left = x + 'px';
    selectionEl.style.top = y + 'px';
    selectionEl.style.width = w + 'px';
    selectionEl.style.height = h + 'px';
  }

  imgCanvas.addEventListener('pointerdown', (e) => {
    if (!loaded) return;
    imgCanvas.setPointerCapture(e.pointerId);
    dragging = true;
    dragStart = point(e);
    showSel(dragStart.cssX, dragStart.cssY, 0, 0);
    btnScanRegion.disabled = true;
  });
  imgCanvas.addEventListener('pointermove', (e) => {
    if (!dragging || !dragStart) return;
    const p = point(e);
    showSel(Math.min(dragStart.cssX, p.cssX), Math.min(dragStart.cssY, p.cssY),
      Math.abs(p.cssX - dragStart.cssX), Math.abs(p.cssY - dragStart.cssY));
  });
  imgCanvas.addEventListener('pointerup', (e) => {
    if (!dragging || !dragStart) return;
    dragging = false;
    const p = point(e);
    const w = Math.abs(p.x - dragStart.x), h = Math.abs(p.y - dragStart.y);
    if (w < 8 || h < 8) { clearSel(); return; }
    const x = Math.max(0, Math.min(dragStart.x, p.x));
    const y = Math.max(0, Math.min(dragStart.y, p.y));
    sel = {
      x: Math.round(x), y: Math.round(y),
      w: Math.round(Math.min(w, imgCanvas.width - x)),
      h: Math.round(Math.min(h, imgCanvas.height - y)),
    };
    if (sel.w < 8 || sel.h < 8) { clearSel(); return; }
    showSel(Math.min(dragStart.cssX, p.cssX), Math.min(dragStart.cssY, p.cssY),
      Math.abs(p.cssX - dragStart.cssX), Math.abs(p.cssY - dragStart.cssY));
    btnScanRegion.disabled = false;
    btnClearSel.disabled = false;
    if (!scanRegion(sel, true)) showError('No QR code found in that region. Try a larger selection.');
  });

  function regionData(r) {
    const c = document.createElement('canvas');
    c.width = r.w; c.height = r.h;
    c.getContext('2d', { willReadFrequently: true })
      .drawImage(imgCanvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    return c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, r.w, r.h);
  }

  function tryRegion(r) {
    let found = decodeAny(regionData(r));
    if (found) return found;
    const s = r.w < 300 ? 3 : 2;
    const c = document.createElement('canvas');
    c.width = r.w * s; c.height = r.h * s;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.imageSmoothingEnabled = false;
    cx.drawImage(imgCanvas, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
    return decodeAny(cx.getImageData(0, 0, c.width, c.height));
  }

  function scanRegion(r, quiet) {
    if (!loaded || !r) return false;
    const found = tryRegion(r);
    if (found) {
      const crop = document.createElement('canvas');
      crop.width = r.w; crop.height = r.h;
      crop.getContext('2d').drawImage(imgCanvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      showResult(found.text, 'Scanned from selected region', thumbnailOf(crop));
      return true;
    }
    if (!quiet) showError('No QR code found in that region.');
    return false;
  }

  function scanWhole(quiet) {
    if (!loaded) return false;
    const full = imgCtx.getImageData(0, 0, imgCanvas.width, imgCanvas.height);
    const found = decodeAny(full);
    if (found) {
      showResult(found.text, 'Scanned from image', thumbnailOf(imgCanvas));
      return true;
    }

    // Upscale retry for tiny codes.
    for (const s of [2, 3]) {
      const c = document.createElement('canvas');
      c.width = imgCanvas.width * s; c.height = imgCanvas.height * s;
      const cx = c.getContext('2d', { willReadFrequently: true });
      cx.imageSmoothingEnabled = false;
      cx.drawImage(imgCanvas, 0, 0, c.width, c.height);
      const hit = decodeAny(cx.getImageData(0, 0, c.width, c.height));
      if (hit) {
        showResult(hit.text, 'Scanned from image (upscaled)', thumbnailOf(imgCanvas));
        return true;
      }
    }

    if (multiImage.checked) return scanWholeMany();
    if (!quiet) showError('No QR code found in the whole image.');
    return false;
  }

  function scanWholeMany() {
    const work = document.createElement('canvas');
    work.width = imgCanvas.width; work.height = imgCanvas.height;
    const wctx = work.getContext('2d', { willReadFrequently: true });
    wctx.drawImage(imgCanvas, 0, 0);
    let count = 0;
    const seen = [];
    for (let i = 0; i < 8; i++) {
      const data = wctx.getImageData(0, 0, work.width, work.height);
      const code = decodeQr(data);
      if (!code || seen.indexOf(code.data) !== -1) break;
      seen.push(code.data);
      const crop = document.createElement('canvas');
      if (code.location) {
        const b = boundsOf(code.location);
        crop.width = Math.max(1, b.x2 - b.x); crop.height = Math.max(1, b.y2 - b.y);
        crop.getContext('2d').drawImage(work, b.x, b.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
        wctx.fillStyle = '#fff';
        wctx.fillRect(b.x - 4, b.y - 4, (b.x2 - b.x) + 8, (b.y2 - b.y) + 8);
      }
      showResult(code.data, 'Scanned from image (multi)', thumbnailOf(crop.width ? crop : work));
      count++;
    }
    if (!count) showError('No QR codes found in the whole image.');
    return count > 0;
  }

  btnScanAll.addEventListener('click', () => scanWhole(false));
  btnScanRegion.addEventListener('click', () => { if (sel) scanRegion(sel, false); });
  btnClearSel.addEventListener('click', clearSel);
  btnNewImage.addEventListener('click', () => {
    loaded = false;
    clearSel();
    editor.hidden = true;
    dropzone.hidden = false;
    imgCanvas.width = 0; imgCanvas.height = 0;
    resultBox.hidden = true;
  });

  /* ---- PWA share target ---- */
  let pendingShareFile = null;
  window.QRS.consumePendingShare = () => {
    if (!pendingShareFile) return;
    const f = pendingShareFile;
    pendingShareFile = null;
    document.querySelector('.seg[data-scan="image"]').click();
    loadFile(f);
  };

  (function handleShareTarget() {
    const params = new URLSearchParams(location.search);
    if (!params.has('share-target')) return;
    const cacheName = 'qrsite-share-target';
    const key = new URL('shared-image', location.href).href;
    caches.open(cacheName).then((cache) => cache.match(key)).then((res) => res && res.blob()).then((blob) => {
      if (!blob) return;
      const file = new File([blob], 'shared.png', { type: blob.type || 'image/png' });
      pendingShareFile = file;
      caches.open(cacheName).then((cache) => cache.delete(key));
      switchTab('scan');
    }).catch(() => {});
  })();

  window.addEventListener('beforeunload', stopCamera);

  /* Keyboard shortcuts */
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const resultBox = $('scan-result');
      if (resultBox && !resultBox.hidden) {
        $('btn-clear-result').click();
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const active = document.querySelector('.scan-view.active');
      if (active && active.id === 'scan-image') {
        const btnScanAll = $('btn-scan-all');
        if (btnScanAll && !btnScanAll.hidden) btnScanAll.click();
        e.preventDefault();
      }
    }
  });
})();
