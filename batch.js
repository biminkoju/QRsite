/* QR Site — batch CSV generation */
(() => {
  'use strict';
  const { $, toast, itemsFromCsv, safeName } = window.QRS;

  const csvInput = $('csv-input');
  const csvText = $('csv-text');
  const svgToggle = $('batch-svg');
  const btnRun = $('btn-batch-run');
  const btnPreview = $('btn-batch-preview');
  const btnCancel = $('btn-batch-cancel');
  const status = $('batch-status');
  const errorsEl = $('batch-errors');
  const preview = $('batch-preview');

  let cancelRequested = false;
  let running = false;

  csvInput.addEventListener('change', () => {
    const f = csvInput.files && csvInput.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { csvText.value = String(r.result || ''); toast('CSV loaded'); };
    r.readAsText(f);
  });

  function makeQr(text) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr;
  }

  function layoutFor(qr, px) {
    const count = qr.getModuleCount();
    const scale = Math.max(2, Math.floor((px || 512) / count));
    const quiet = Math.max(4, Math.round(count * 0.08)) * scale;
    return { count, scale, quiet, size: count * scale + quiet * 2 };
  }

  function renderQrToCanvas(text, px) {
    const qr = makeQr(text);
    const { count, scale, quiet, size } = layoutFor(qr, px);
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < count; r++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(r, col)) ctx.fillRect(quiet + col * scale, quiet + r * scale, scale, scale);
      }
    }
    return c;
  }

  function renderQrToSvg(text) {
    const qr = makeQr(text);
    const { count, scale, quiet, size } = layoutFor(qr, 512);
    let d = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          d += 'M' + (quiet + c * scale) + ' ' + (quiet + r * scale) + 'h' + scale + 'v' + scale + 'h-' + scale + 'z';
        }
      }
    }
    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
      '" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges">' +
      '<rect width="' + size + '" height="' + size + '" fill="#ffffff"/>' +
      '<path fill="#000000" d="' + d + '"/></svg>';
  }

  function currentItems() {
    return itemsFromCsv(csvText.value);
  }

  function clearErrors() {
    errorsEl.innerHTML = '';
    errorsEl.hidden = true;
  }

  function addError(row, message) {
    const li = document.createElement('li');
    li.textContent = 'Row ' + row + ': ' + message;
    errorsEl.appendChild(li);
    errorsEl.hidden = false;
  }

  btnPreview.addEventListener('click', () => {
    preview.innerHTML = '';
    clearErrors();
    const items = currentItems();
    if (!items.length) { status.textContent = 'Nothing to generate — add rows first.'; return; }
    const head = items.slice(0, 8);
    head.forEach((it, i) => {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      try {
        img.src = renderQrToCanvas(it.text, 220).toDataURL('image/png');
      } catch (e) {
        addError(i + 1, 'cannot be encoded (' + e.message + ')');
        return;
      }
      img.alt = 'QR for ' + it.text;
      const cap = document.createElement('figcaption');
      cap.textContent = it.text;
      fig.append(img, cap);
      preview.appendChild(fig);
    });
    status.textContent = items.length + ' item(s) parsed' + (items.length > head.length ? ' — showing first ' + head.length : '') + '.';
  });

  btnCancel.addEventListener('click', () => {
    if (!running) return;
    cancelRequested = true;
    status.textContent = 'Cancelling…';
  });

  function nextTick() { return new Promise((r) => setTimeout(r, 0)); }

  btnRun.addEventListener('click', async () => {
    if (running) return;
    const items = currentItems();
    if (!items.length) { toast('Add some CSV rows first'); return; }
    if (typeof JSZip === 'undefined') { toast('JSZip failed to load'); return; }

    const asSvg = svgToggle.checked;
    const ext = asSvg ? '.svg' : '.png';
    running = true;
    cancelRequested = false;
    btnRun.disabled = true;
    btnPreview.disabled = true;
    btnCancel.hidden = false;
    clearErrors();
    preview.innerHTML = '';
    status.textContent = 'Generating ' + items.length + ' QR codes…';

    let done = 0, failed = 0;

    try {
      const zip = new JSZip();
      for (let i = 0; i < items.length; i++) {
        if (cancelRequested) break;
        const it = items[i];
        try {
          if (asSvg) {
            zip.file(safeName(it.name || it.text, i) + ext, renderQrToSvg(it.text));
          } else {
            const c = renderQrToCanvas(it.text, 512);
            const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
            if (!blob) throw new Error('could not rasterize');
            zip.file(safeName(it.name || it.text, i) + ext, blob);
          }
          done++;
        } catch (e) {
          failed++;
          addError(i + 1, e.message || 'failed to encode');
        }
        if (i % 10 === 0 || i === items.length - 1) {
          status.textContent = 'Generating… ' + (i + 1) + ' / ' + items.length +
            (failed ? ' (' + failed + ' failed)' : '');
          await nextTick();
        }
      }

      if (cancelRequested) {
        status.textContent = 'Cancelled after ' + done + ' of ' + items.length + ' item(s).' +
          (failed ? ' ' + failed + ' failed.' : '') + ' Nothing was downloaded.';
        toast('Batch cancelled');
        return;
      }

      if (!done) {
        status.textContent = 'Nothing could be encoded.' + (failed ? ' ' + failed + ' row(s) failed.' : '');
        toast('No QR codes generated');
        return;
      }

      const out = await zip.generateAsync({ type: 'blob' }, (meta) => {
        if (cancelRequested) return;
        status.textContent = 'Zipping… ' + Math.round(meta.percent) + '%';
      });
      const url = URL.createObjectURL(out);
      const a = document.createElement('a');
      a.href = url; a.download = 'qr-codes.zip'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      status.textContent = 'Done — ' + done + ' QR code(s) in qr-codes.zip.' +
        (failed ? ' ' + failed + ' row(s) could not be encoded — see the list below.' : '');
      toast('ZIP downloaded');
    } catch (err) {
      console.error(err);
      status.textContent = 'Something went wrong: ' + err.message;
    } finally {
      running = false;
      btnRun.disabled = false;
      btnPreview.disabled = false;
      btnCancel.hidden = true;
    }
  });
})();
