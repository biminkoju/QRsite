/* QR Site — generator */
(() => {
  'use strict';
  const { $, bytes, toast, store, switchTab, GEN_HISTORY_KEY, HISTORY_MAX } = window.QRS;

  const input = $('qr-input');
  const canvas = $('qr-canvas');
  const emptyMsg = $('qr-empty');
  const charCount = $('char-count');
  const sizeEl = $('size');
  const sizeHint = $('size-hint');
  const eccEl = $('ecc');
  const fgEl = $('fg');
  const bgEl = $('bg');
  const captionEl = $('qr-caption');
  const svgRectsEl = $('svg-rects');
  const logoInput = $('logo-input');
  const logoHint = $('logo-hint');
  const metaEl = $('qr-meta');
  const warnEl = $('qr-warn');
  const fixWrap = $('qr-fix-ecc-wrap');
  const fixBtn = $('qr-fix-ecc');
  const btnDownload = $('btn-download');
  const btnDownloadSvg = $('btn-download-svg');
  const btnPrint = $('btn-print-window');
  const btnPrintPage = $('btn-print');
  const btnCopyImage = $('btn-copy-image');
  const btnShare = $('btn-share');
  const formWifi = $('form-wifi');
  const formVcard = $('form-vcard');
  const formGeo = $('form-geo');
  const formEvent = $('form-event');
  const formWhatsapp = $('form-whatsapp');
  const formApp = $('form-app');

  const FORMS = [formWifi, formVcard, formGeo, formEvent, formWhatsapp, formApp];
  const ECC_ORDER = ['L', 'M', 'Q', 'H'];

  let logoImage = null;
  let logoDataUrl = null;
  let currentCanvasDataUrl = null;
  let currentSvg = null;
  let currentInfo = null;
  let suggestedEcc = null;

  function suggestedSize(text, ecc) {
    const len = bytes(text);
    let min = 256;
    if (len > 100) min = 384;
    if (len > 300) min = 512;
    if (len > 700) min = 768;
    if (len > 1400) min = 1024;
    const boost = { L: 0, M: 0.15, Q: 0.3, H: 0.45 }[ecc] || 0;
    return Math.min(1024, Math.round(min * (1 + boost)));
  }

  function build(text, ecc) {
    const qr = qrcode(0, ecc);
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    return { qr, count, version: (count - 17) / 4 };
  }

  /* Returns the lowest ECC level that can hold this text, or null. */
  function fittingEcc(text) {
    for (const level of ECC_ORDER) {
      try { build(text, level); return level; } catch (e) { /* too long */ }
    }
    return null;
  }

  function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    const toLin = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const r = toLin((n >> 16) & 255), g = toLin((n >> 8) & 255), b = toLin(n & 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatio(a, b) {
    const la = luminance(a), lb = luminance(b);
    if (la === null || lb === null) return null;
    const hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function updateWarnings() {
    const notes = [];
    const bgLum = luminance(bgEl.value);
    if (bgLum !== null && bgLum < 0.35) {
      notes.push('Dark background: many scanners only read dark modules on a light background. Swap the colors if scanning fails.');
    }
    const ratio = contrastRatio(fgEl.value, bgEl.value);
    if (ratio !== null && ratio < 3) {
      notes.push('Low contrast between foreground and background (' + ratio.toFixed(1) + ':1). Aim for at least 3:1.');
    }
    warnEl.textContent = notes.join(' ');
    warnEl.hidden = notes.length === 0;
  }

  function clearFix() {
    suggestedEcc = null;
    fixWrap.hidden = true;
  }

  function offerFix(text, currentEcc) {
    /* A center logo pins error correction to H, so lowering ECC is not an option. */
    if (logoImage) {
      suggestedEcc = null;
      fixWrap.hidden = true;
      return false;
    }
    const fits = fittingEcc(text);
    if (!fits || ECC_ORDER.indexOf(fits) <= ECC_ORDER.indexOf(currentEcc)) {
      suggestedEcc = null;
      fixWrap.hidden = true;
      return false;
    }
    suggestedEcc = fits;
    fixBtn.textContent = 'Use ' + fits + ' instead';
    fixWrap.hidden = false;
    return true;
  }

  function renderQR() {
    const text = input.value;
    charCount.textContent = text.length + ' chars';
    updateWarnings();

    if (!text.trim()) {
      canvas.hidden = true;
      emptyMsg.hidden = false;
      emptyMsg.textContent = 'Your QR code will appear here.';
      sizeHint.textContent = '';
      metaEl.hidden = true;
      setActions(false);
      clearFix();
      currentCanvasDataUrl = null;
      currentSvg = null;
      currentInfo = null;
      return;
    }

    if (logoImage) {
      if (eccEl.value !== 'H') eccEl.value = 'H';
      logoHint.textContent = 'Logo active — error correction forced to H.';
    } else {
      logoHint.textContent = 'Optional. Raises error correction to H.';
    }

    let size = parseInt(sizeEl.value, 10);
    const suggested = suggestedSize(text, eccEl.value);
    if (size < suggested) { size = suggested; sizeEl.value = String(size); }
    sizeHint.textContent = bytes(text) + ' bytes · ' + size + 'px';

    let built;
    try {
      built = build(text, eccEl.value);
    } catch (err) {
      canvas.hidden = true;
      emptyMsg.hidden = false;
      metaEl.hidden = true;
      setActions(false);
      currentCanvasDataUrl = null;
      currentSvg = null;
      currentInfo = null;
      const offered = offerFix(text, eccEl.value);
      emptyMsg.textContent = offered
        ? 'Too long for error correction ' + eccEl.value + '. It fits at ' + suggestedEcc + '.'
        : (logoImage
          ? 'Too long for a QR code with a center logo, which requires error correction H. Shorten the content or remove the logo.'
          : 'Content too long for a QR code, even at L. Shorten it a little.');
      return;
    }

    clearFix();
    const { qr, count, version } = built;
    const caption = captionEl.value.trim();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixels = Math.max(size, count * 4);
    const scale = Math.max(1, Math.floor(pixels / count));
    const quiet = Math.max(4, Math.round(count * 0.08)) * scale;
    const w = count * scale + quiet * 2;
    const captionH = caption ? Math.round(Math.max(18, w * 0.055)) : 0;
    const captionGap = caption ? Math.round(captionH * 0.35) : 0;
    const totalH = w + captionH + captionGap;

    canvas.width = w * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = 'min(100%, ' + w + 'px)';
    canvas.style.height = 'auto';
    canvas.style.imageRendering = 'pixelated';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = bgEl.value;
    ctx.fillRect(0, 0, w, totalH);
    ctx.fillStyle = fgEl.value;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(quiet + c * scale, quiet + r * scale, scale, scale);
      }
    }
    if (logoImage) drawLogo(ctx, quiet, count, scale);
    if (caption) {
      ctx.fillStyle = fgEl.value;
      ctx.font = '600 ' + captionH + 'px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(caption, w / 2, w + captionGap, w - quiet);
    }

    canvas.hidden = false;
    emptyMsg.hidden = true;
    setActions(true);
    currentCanvasDataUrl = canvas.toDataURL('image/png');
    currentSvg = buildSvg(qr, count, quiet, scale, caption, captionH, captionGap);
    currentInfo = { version, ecc: eccEl.value, count };

    metaEl.textContent = 'v' + version + ' · ECC ' + eccEl.value + ' · ' + count + '×' + count + ' modules';
    metaEl.hidden = false;
  }

  function setActions(on) {
    [btnDownload, btnDownloadSvg, btnPrint, btnPrintPage, btnCopyImage, btnShare].forEach((b) => { b.disabled = !on; });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawLogo(ctx, quiet, count, scale) {
    const body = count * scale;
    const logoSize = Math.round(body * 0.22);
    const cx = quiet + body / 2;
    const pad = Math.round(logoSize * 0.1);
    const box = logoSize + pad * 2;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cx - box / 2, cx - box / 2, box, box, Math.round(box * 0.14));
    ctx.fill();
    const ratio = logoImage.width / logoImage.height;
    let lw = logoSize, lh = logoSize;
    if (ratio > 1) lh = logoSize / ratio; else lw = logoSize * ratio;
    ctx.drawImage(logoImage, cx - lw / 2, cx - lh / 2, lw, lh);
    ctx.restore();
  }

  function escapeXml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function buildSvg(qr, count, quiet, scale, caption, captionH, captionGap) {
    const body = count * scale;
    const width = body + quiet * 2;
    const height = width + captionH + captionGap;
    const parts = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
      '" viewBox="0 0 ' + width + ' ' + height + '" shape-rendering="crispEdges">');
    parts.push('<rect width="' + width + '" height="' + height + '" fill="' + bgEl.value + '"/>');

    if (svgRectsEl.checked) {
      parts.push('<g fill="' + fgEl.value + '">');
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            parts.push('<rect x="' + (quiet + c * scale) + '" y="' + (quiet + r * scale) +
              '" width="' + scale + '" height="' + scale + '"/>');
          }
        }
      }
      parts.push('</g>');
    } else {
      let d = '';
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            d += 'M' + (quiet + c * scale) + ' ' + (quiet + r * scale) + 'h' + scale + 'v' + scale + 'h-' + scale + 'z';
          }
        }
      }
      parts.push('<path fill="' + fgEl.value + '" d="' + d + '"/>');
    }

    if (logoImage && logoDataUrl) {
      const logoSize = Math.round(body * 0.22);
      const cx = quiet + body / 2;
      const box = logoSize + Math.round(logoSize * 0.2);
      parts.push('<rect x="' + (cx - box / 2) + '" y="' + (cx - box / 2) + '" width="' + box +
        '" height="' + box + '" rx="' + Math.round(box * 0.14) + '" fill="#ffffff"/>');
      parts.push('<image x="' + (cx - logoSize / 2) + '" y="' + (cx - logoSize / 2) +
        '" width="' + logoSize + '" height="' + logoSize +
        '" preserveAspectRatio="xMidYMid meet" href="' + logoDataUrl + '"/>');
    }

    if (caption) {
      parts.push('<text x="' + (width / 2) + '" y="' + (width + captionGap) +
        '" fill="' + fgEl.value + '" text-anchor="middle" dominant-baseline="hanging"' +
        ' font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="' + captionH +
        '" font-weight="600">' + escapeXml(caption) + '</text>');
    }

    parts.push('</svg>');
    return parts.join('');
  }

  let debounce = null;
  function schedule(ms) { clearTimeout(debounce); debounce = setTimeout(renderQR, ms); }

  input.addEventListener('input', () => { emptyMsg.textContent = 'Your QR code will appear here.'; schedule(160); scheduleHistory(); });
  [sizeEl, eccEl, fgEl, bgEl, captionEl, svgRectsEl].forEach((el) => {
    el.addEventListener('input', () => schedule(80));
    el.addEventListener('change', () => schedule(80));
  });

  fixBtn.addEventListener('click', () => {
    if (!suggestedEcc) return;
    eccEl.value = suggestedEcc;
    renderQR();
    toast('Switched to error correction ' + suggestedEcc);
  });

  logoInput.addEventListener('change', () => {
    const file = logoInput.files && logoInput.files[0];
    if (!file) { logoImage = null; logoDataUrl = null; renderQR(); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => { logoImage = img; logoDataUrl = reader.result; renderQR(); };
      img.onerror = () => toast('Could not load that image');
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  const PRESETS = {
    url: () => ['https://example.com', null],
    text: () => ['Hello from QR Site!', null],
    email: () => ['mailto:someone@example.com?subject=Hi&body=Hello', null],
    phone: () => ['tel:+15551234567', null],
    sms: () => ['smsto:+15551234567:Hi there', null],
    wifi: () => [null, 'wifi'],
    vcard: () => [null, 'vcard'],
    geo: () => [null, 'geo'],
    event: () => [null, 'event'],
    whatsapp: () => [null, 'whatsapp'],
    app: () => [null, 'app'],
  };

  function showForm(name) {
    FORMS.forEach((f) => { f.hidden = f.id !== 'form-' + name; });
  }

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const p = PRESETS[chip.dataset.preset];
      if (!p) return;
      const res = p();
      showForm(res[1]);
      if (res[1]) return;
      input.value = res[0];
      input.focus();
      renderQR();
      scheduleHistory();
    });
  });

  const esc = (s) => String(s).replace(/([\\;,":])/g, '\\$1');

  function applyBuilt(text, message) {
    input.value = text;
    renderQR();
    scheduleHistory();
    if (message) toast(message);
  }

  $('w-build').addEventListener('click', () => {
    const ssid = $('w-ssid').value.trim();
    if (!ssid) { toast('Enter an SSID'); return; }
    const sec = $('w-sec').value;
    const pass = $('w-pass').value;
    let s = 'WIFI:T:' + (sec === 'nopass' ? 'nopass' : sec) + ';S:' + esc(ssid) + ';';
    if (sec !== 'nopass' && pass) s += 'P:' + esc(pass) + ';';
    if ($('w-hidden').value === 'true') s += 'H:true;';
    s += ';';
    applyBuilt(s, 'Wi-Fi string generated');
  });

  $('v-build').addEventListener('click', () => {
    const name = $('v-name').value.trim();
    const phone = $('v-phone').value.trim();
    const email = $('v-email').value.trim();
    const org = $('v-org').value.trim();
    const title = $('v-title').value.trim();
    const url = $('v-url').value.trim();
    if (!name && !phone && !email) { toast('Fill in a name, phone or email'); return; }
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + esc(name) + ';;;;', 'FN:' + esc(name)];
    if (org) lines.push('ORG:' + esc(org));
    if (title) lines.push('TITLE:' + esc(title));
    if (phone) lines.push('TEL;TYPE=CELL:' + esc(phone));
    if (email) lines.push('EMAIL:' + esc(email));
    if (url) lines.push('URL:' + esc(url));
    lines.push('END:VCARD');
    applyBuilt(lines.join('\n'), 'Contact generated');
  });

  $('g-build').addEventListener('click', () => {
    const lat = $('g-lat').value.trim();
    const lng = $('g-lng').value.trim();
    const label = $('g-label').value.trim();
    const num = /^-?\d+(\.\d+)?$/;
    if (!num.test(lat) || !num.test(lng)) { toast('Enter numeric latitude and longitude'); return; }
    let s = 'geo:' + lat + ',' + lng;
    if (label) s += '?q=' + encodeURIComponent(label);
    applyBuilt(s, 'Location generated');
  });

  /* datetime-local gives local time with no zone; the event format wants UTC. */
  function toIcsStamp(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  $('e-build').addEventListener('click', () => {
    const title = $('e-title').value.trim();
    const loc = $('e-loc').value.trim();
    const start = toIcsStamp($('e-start').value);
    const end = toIcsStamp($('e-end').value);
    if (!title || !start) { toast('Enter a title and a start time'); return; }
    const lines = ['BEGIN:VEVENT', 'SUMMARY:' + esc(title)];
    if (loc) lines.push('LOCATION:' + esc(loc));
    lines.push('DTSTART:' + start);
    if (end) lines.push('DTEND:' + end);
    lines.push('END:VEVENT');
    applyBuilt(lines.join('\n'), 'Event generated');
  });

  $('wa-build').addEventListener('click', () => {
    const phone = $('wa-phone').value.replace(/[^0-9]/g, '');
    const msg = $('wa-msg').value.trim();
    if (!phone) { toast('Enter a phone number with country code'); return; }
    let s = 'https://wa.me/' + phone;
    if (msg) s += '?text=' + encodeURIComponent(msg);
    applyBuilt(s, 'WhatsApp link generated');
  });

  $('a-build').addEventListener('click', () => {
    const scheme = $('a-scheme').value.trim().replace(/[:\/]+$/, '');
    const path = $('a-path').value.trim().replace(/^\/+/, '');
    if (!scheme) { toast('Enter a URL scheme, e.g. myapp'); return; }
    applyBuilt(scheme + '://' + path, 'App link generated');
  });

  /* ---- history ---- */
  function renderHistory() {
    const list = $('gen-history');
    list.innerHTML = '';
    store.get(GEN_HISTORY_KEY, []).forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      const img = document.createElement('img');
      img.className = 'thumb';
      img.alt = '';
      if (item.thumb) img.src = item.thumb;
      else { img.classList.add('placeholder'); img.textContent = 'QR'; }
      const meta = document.createElement('div');
      meta.className = 'meta';
      const val = document.createElement('span'); val.className = 'value'; val.textContent = item.text;
      const sub = document.createElement('span'); sub.className = 'sub'; sub.textContent = new Date(item.at).toLocaleString();
      meta.append(val, sub);
      const actions = document.createElement('div'); actions.className = 'item-actions';
      const load = document.createElement('button'); load.textContent = 'Load';
      load.addEventListener('click', () => { input.value = item.text; switchTab('generate'); renderQR(); });
      const del = document.createElement('button'); del.textContent = '✕';
      del.setAttribute('aria-label', 'Delete history entry');
      del.addEventListener('click', () => {
        store.set(GEN_HISTORY_KEY, store.get(GEN_HISTORY_KEY, []).filter((x) => x.at !== item.at || x.text !== item.text));
        renderHistory();
      });
      actions.append(load, del);
      li.append(img, meta, actions);
      list.appendChild(li);
    });
  }

  function pushHistory() {
    const text = input.value.trim();
    if (!text || !currentCanvasDataUrl) return;
    const t = document.createElement('canvas');
    t.width = 96; t.height = 96;
    const tc = t.getContext('2d');
    tc.fillStyle = '#fff'; tc.fillRect(0, 0, 96, 96);
    tc.drawImage(canvas, 0, 0, 96, 96);
    const list = store.get(GEN_HISTORY_KEY, []).filter((x) => x.text !== text);
    list.unshift({ text, at: Date.now(), thumb: t.toDataURL('image/png') });
    store.set(GEN_HISTORY_KEY, list.slice(0, HISTORY_MAX));
    renderHistory();
  }

  let historyTimer = null;
  function scheduleHistory() {
    clearTimeout(historyTimer);
    historyTimer = setTimeout(pushHistory, 1200);
  }

  $('btn-clear-history').addEventListener('click', () => {
    store.del(GEN_HISTORY_KEY);
    renderHistory();
    toast('History cleared');
  });

  $('btn-export-history').addEventListener('click', () => {
    const items = store.get(GEN_HISTORY_KEY, []);
    if (!items.length) { toast('Nothing to export'); return; }
    const payload = { app: 'qrsite', kind: 'gen-history', version: 1, exportedAt: new Date().toISOString(), items };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'qrsite-history.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('History exported');
  });

  $('btn-import-history').addEventListener('click', () => $('history-import').click());

  $('history-import').addEventListener('change', () => {
    const file = $('history-import').files && $('history-import').files[0];
    $('history-import').value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(String(reader.result || '')); } catch (e) { toast('That file is not valid JSON'); return; }
      const incoming = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.items) ? parsed.items : null);
      if (!incoming) { toast('No history items found in that file'); return; }
      const clean = incoming
        .filter((it) => it && typeof it.text === 'string' && it.text.trim())
        .map((it) => ({ text: it.text, at: Number(it.at) || Date.now(), thumb: typeof it.thumb === 'string' ? it.thumb : '' }));
      if (!clean.length) { toast('No usable entries in that file'); return; }
      const merged = clean.concat(store.get(GEN_HISTORY_KEY, []));
      const seen = new Set();
      const deduped = merged.filter((it) => {
        const key = it.text + '|' + it.at;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => b.at - a.at).slice(0, HISTORY_MAX);
      store.set(GEN_HISTORY_KEY, deduped);
      renderHistory();
      toast('Imported ' + clean.length + ' item(s)');
    };
    reader.readAsText(file);
  });

  /* ---- downloads ---- */
  btnDownload.addEventListener('click', () => {
    if (!currentCanvasDataUrl) return;
    const a = document.createElement('a');
    a.href = currentCanvasDataUrl; a.download = 'qr-code.png'; a.click();
    toast('Downloaded PNG'); pushHistory();
  });

  btnDownloadSvg.addEventListener('click', () => {
    if (!currentSvg) return;
    const blob = new Blob([currentSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'qr-code.svg'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Downloaded SVG'); pushHistory();
  });

  btnPrintPage.addEventListener('click', () => {
    window.print();
  });

  function captionMarkup() {
    const caption = captionEl.value.trim();
    return caption ? '<figcaption>' + escapeXml(caption) + '</figcaption>' : '';
  }

  btnPrint.addEventListener('click', () => {
    if (!currentCanvasDataUrl) return;
    const win = window.open('', '_blank');
    if (!win) { toast('Allow popups to print'); return; }
    win.document.write('<!DOCTYPE html><title>Print QR</title>' +
      '<style>@page{margin:12mm}body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif}' +
      'figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:6mm}' +
      'img{width:80mm;height:auto;image-rendering:pixelated}figcaption{font-size:5mm;font-weight:600}</style>' +
      '<figure><img src="' + currentCanvasDataUrl + '" alt="QR code">' + captionMarkup() + '</figure>');
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch (e) {} }, 350);
  });

  btnCopyImage.addEventListener('click', async () => {
    try {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Image copied');
    } catch (e) { toast('Copy failed — try downloading instead'); }
  });

  if (navigator.canShare) {
    btnShare.hidden = false;
    btnShare.addEventListener('click', async () => {
      try {
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        const file = new File([blob], 'qr-code.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'QR Code' });
        else await navigator.share({ title: 'QR Code', text: input.value });
      } catch (e) { /* cancelled */ }
    });
  }

  /* Used by the scanner: send a decoded value here, optionally with look-and-feel. */
  window.QRSGen = {
    setInput(text, opts) {
      opts = opts || {};
      input.value = text;
      if (opts.caption !== undefined) captionEl.value = opts.caption;
      if (opts.foreground) fgEl.value = opts.foreground;
      if (opts.background) bgEl.value = opts.background;
      showForm(null);
      renderQR();
      scheduleHistory();
    },
  };

  renderQR();
  renderHistory();
})();
