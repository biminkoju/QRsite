/* Smoke tests: run with `node --test tests/` (no dependencies). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadInSandbox(file, extraGlobals) {
  const sandbox = Object.assign({ window: {}, console }, extraGlobals || {});
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  return sandbox;
}

/* ---- generator ---- */
test('generator produces a valid square matrix', () => {
  const box = loadInSandbox('vendor/qrcode.min.js');
  const qrcode = box.qrcode;
  assert.equal(typeof qrcode, 'function');

  const qr = qrcode(0, 'M');
  qr.addData('https://example.com/hello');
  qr.make();

  const count = qr.getModuleCount();
  assert.ok(count >= 21, 'module count too small');
  assert.equal((count - 17) % 4, 0, 'module count is not 4v+17');

  let dark = 0;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) if (qr.isDark(r, c)) dark++;
  }
  assert.ok(dark > 0 && dark < count * count, 'matrix looks empty or fully dark');
});

test('generator picks a bigger version for longer content', () => {
  const { qrcode } = loadInSandbox('vendor/qrcode.min.js');
  const small = qrcode(0, 'M');
  small.addData('hi');
  small.make();
  const big = qrcode(0, 'M');
  big.addData('x'.repeat(600));
  big.make();
  assert.ok(big.getModuleCount() > small.getModuleCount());
});

test('higher error correction needs more modules', () => {
  const { qrcode } = loadInSandbox('vendor/qrcode.min.js');
  const text = 'x'.repeat(200);
  const l = qrcode(0, 'L'); l.addData(text); l.make();
  const h = qrcode(0, 'H'); h.addData(text); h.make();
  assert.ok(h.getModuleCount() >= l.getModuleCount());
});

test('oversized content throws (drives the ECC suggestion UI)', () => {
  const { qrcode } = loadInSandbox('vendor/qrcode.min.js');
  const qr = qrcode(0, 'H');
  qr.addData('y'.repeat(3000));
  assert.throws(() => qr.make());
});

/* ---- CSV ---- */
const csv = require(path.join(ROOT, 'lib-csv.js'));

test('parseCsv handles plain rows', () => {
  assert.deepEqual(csv.parseCsv('a,b\nc,d'), [['a', 'b'], ['c', 'd']]);
});

test('parseCsv honours quotes and escaped quotes', () => {
  const rows = csv.parseCsv('"a,1",b\n"say ""hi""",c');
  assert.deepEqual(rows, [['a,1', 'b'], ['say "hi"', 'c']]);
});

test('parseCsv handles CRLF and blank lines', () => {
  assert.deepEqual(csv.parseCsv('a,b\r\n\r\nc,d\r\n'), [['a', 'b'], ['c', 'd']]);
});

test('itemsFromCsv without a header uses first column as text', () => {
  const items = csv.itemsFromCsv('https://a.test,page-a\nhttps://b.test');
  assert.deepEqual(items, [
    { text: 'https://a.test', name: 'page-a' },
    { text: 'https://b.test', name: '' },
  ]);
});

test('itemsFromCsv with a header maps text and filename columns', () => {
  const items = csv.itemsFromCsv('filename,text\nmenu,https://a.test/menu\n');
  assert.deepEqual(items, [{ text: 'https://a.test/menu', name: 'menu' }]);
});

test('itemsFromCsv skips empty rows and trims values', () => {
  const items = csv.itemsFromCsv('text\n  hello  \n   \nworld\n');
  assert.deepEqual(items.map((i) => i.text), ['hello', 'world']);
});

test('safeName strips unsafe characters and falls back', () => {
  assert.equal(csv.safeName('my page/1', 0), 'my-page-1');
  assert.equal(csv.safeName('', 2), 'qr-3');
  assert.ok(csv.safeName('x'.repeat(100), 0).length <= 40);
});

/* ---- structural checks ---- */
test('every id referenced by scripts exists in index.html', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const scripts = ['lib-core.js', 'lib-csv.js', 'app.js', 'scan.js', 'batch.js'];
  const missing = [];
  for (const file of scripts) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of src.matchAll(/\$\(.([a-zA-Z0-9-]+).\)/g)) {
      if (!ids.has(m[1])) missing.push(file + ' -> ' + m[1]);
    }
  }
  assert.deepEqual(missing, [], 'missing elements: ' + missing.join(', '));
});

test('index.html loads every vendored script from vendor/', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcs.includes('vendor/qrcode.min.js'));
  assert.ok(srcs.includes('vendor/jsQR.js'));
  assert.ok(srcs.includes('vendor/jszip.min.js'));
  assert.ok(srcs.includes('vendor/zxing.min.js'));
  for (const src of srcs) {
    assert.ok(!/^https?:/.test(src), 'remote script should be vendored: ' + src);
    assert.ok(fs.existsSync(path.join(ROOT, src)), 'missing file: ' + src);
  }
});

test('service worker precaches every local script the page loads', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  for (const src of srcs) {
    assert.ok(sw.includes("'" + src + "'"), 'not precached: ' + src);
  }
});

test('manifest share target is relative to the app directory', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.ok(manifest.share_target);
  assert.ok(!manifest.share_target.action.startsWith('/'), 'share target must not be root-absolute');
});
