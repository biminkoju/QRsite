/* CSV parsing for batch generation. Shared by the app and the node smoke tests. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.QRCsv = api;
    if (root.QRS) {
      root.QRS.parseCsv = api.parseCsv;
      root.QRS.itemsFromCsv = api.itemsFromCsv;
      root.QRS.safeName = api.safeName;
    }
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else field += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(function (c) { return c.length; })) rows.push(row);
        row = [];
      } else field += ch;
    }
    row.push(field);
    if (row.some(function (c) { return c.length; })) rows.push(row);
    return rows;
  }

  function itemsFromCsv(text) {
    var rows = parseCsv(text);
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var start = 0;
    var textIdx = 0;
    var nameIdx = -1;
    if (head[0] === 'text' || head.indexOf('text') !== -1 || head.indexOf('content') !== -1 || head.indexOf('value') !== -1) {
      start = 1;
      textIdx = head.indexOf('text');
      if (textIdx === -1) textIdx = head.indexOf('content');
      if (textIdx === -1) textIdx = head.indexOf('value');
      nameIdx = head.indexOf('filename');
      if (nameIdx === -1) nameIdx = head.indexOf('name');
    } else {
      textIdx = 0;
      nameIdx = head.length > 1 ? 1 : -1;
    }
    var out = [];
    for (var i = start; i < rows.length; i++) {
      var r = rows[i];
      var value = (r[textIdx] || '').trim();
      if (!value) continue;
      var name = nameIdx >= 0 ? (r[nameIdx] || '').trim() : '';
      out.push({ text: value, name: name });
    }
    return out;
  }

  function safeName(s, i) {
    var n = (s || '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return n ? n : 'qr-' + (i + 1);
  }

  return { parseCsv: parseCsv, itemsFromCsv: itemsFromCsv, safeName: safeName };
});
