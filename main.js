// QuizDesk: a library of study quizzes (single HTML files) that work offline,
// plus a shared catalog in the GitHub repo that everyone can download from.
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, session, net, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const REPO = 'CillX1/QuizDesk';
const RAW = `https://raw.githubusercontent.com/${REPO}/main/quizzes/`;
const MAX_BYTES = 5 * 1024 * 1024;
const TONES = ['mathe', 'netz', 'sql', 'web', 'sprache', 'other'];
// Option labels of the "Fach" dropdown in .github/ISSUE_TEMPLATE/quiz.yml
const FORM_TONES = { mathe: 'Mathe', netz: 'Netzwerk / Telematik', sql: 'Datenbanken / SQL', web: 'Web / Programmieren', sprache: 'Sprachen', other: 'Anderes' };

protocol.registerSchemesAsPrivileged([{ scheme: 'quiz', privileges: { standard: true, secure: true } }]);
if (!app.requestSingleInstanceLock()) { app.quit(); return; }

let win, quizDir, libFile, library = [], catalog = null;
const pendingImports = new Map();

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const looksLikeQuiz = buf => buf.length > 0 && buf.length <= MAX_BYTES && /<(!doctype html|html|body|script)/i.test(buf.toString('utf8', 0, Math.min(buf.length, 20000)));
const titleOf = html => ((/<title>([^<]{1,120})<\/title>/i.exec(html) || [])[1] || '').trim();
const quizFile = id => path.join(quizDir, id + '.html');

function slug(text) {
  const base = String(text).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'quiz';
  let id = base, n = 2;
  while (library.some(q => q.id === id)) id = `${base}-${n++}`;
  return id;
}

function clean(meta) {
  const s = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
  return {
    title: s(meta.title, 80) || 'Quiz',
    tone: TONES.includes(meta.tone) ? meta.tone : 'other',
    tag: s(meta.tag, 24),
    desc: s(meta.desc, 200),
    author: s(meta.author, 40),
  };
}

function saveLibrary() { fs.writeFileSync(libFile, JSON.stringify(library, null, 2)); }

function loadLibrary() {
  fs.mkdirSync(quizDir, { recursive: true });
  try { library = JSON.parse(fs.readFileSync(libFile, 'utf8')); return; } catch { library = []; }
  // First start: put the quizzes that ship with the app into the library, so it works offline right away.
  const builtinDir = app.isPackaged ? path.join(process.resourcesPath, 'quizzes') : path.join(__dirname, 'quizzes');
  try {
    const bundled = JSON.parse(fs.readFileSync(path.join(builtinDir, 'catalog.json'), 'utf8')).quizzes;
    for (const q of bundled) {
      const buf = fs.readFileSync(path.join(builtinDir, q.file));
      fs.writeFileSync(quizFile(q.id), buf);
      library.push({ id: q.id, ...clean(q), source: 'catalog', sha256: sha256(buf) });
    }
  } catch (e) { console.error('Could not load bundled quizzes:', e); }
  saveLibrary();
}

async function fetchCatalog() {
  try {
    const res = await net.fetch(RAW + 'catalog.json?t=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    catalog = (data.quizzes || []).filter(q => /^[a-z0-9-]{1,48}$/.test(q.id) && /^[a-z0-9-]+\.html$/.test(q.file))
      .map(q => ({ id: q.id, file: q.file, sha256: q.sha256, added: q.added, ...clean(q) }));
    return { ok: true, quizzes: catalog };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function downloadQuiz(id) {
  const entry = (catalog || []).find(q => q.id === id);
  if (!entry) throw new Error('Dieses Quiz ist nicht in der Sammlung.');
  const res = await net.fetch(RAW + entry.file, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error('Download fehlgeschlagen (HTTP ' + res.status + ').');
  const buf = Buffer.from(await res.arrayBuffer());
  if (!looksLikeQuiz(buf)) throw new Error('Die Datei ist kein gültiges Quiz.');
  if (entry.sha256 && sha256(buf) !== entry.sha256) throw new Error('Die Datei ist beschädigt angekommen. Versuch es nochmal.');
  fs.writeFileSync(quizFile(id), buf);
  const item = { id, ...clean(entry), source: 'catalog', sha256: sha256(buf) };
  const i = library.findIndex(q => q.id === id);
  if (i >= 0) library[i] = item; else library.push(item);
  saveLibrary();
  return library;
}

function openQuiz(id) {
  const q = library.find(x => x.id === id);
  if (!q) return;
  const w = new BrowserWindow({
    width: 1100, height: 820, minWidth: 420, minHeight: 500, title: q.title, autoHideMenuBar: true,
    icon: iconPath(),
    webPreferences: { partition: 'persist:quizzes', sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  const origin = `quiz://${id}`;
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  w.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith(origin + '/')) return;
    e.preventDefault();
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
  });
  w.loadURL(origin + '/');
}

function iconPath() { return app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : path.join(__dirname, 'build', 'icon.png'); }

function setupQuizSession() {
  // Quizzes are other people's web pages: each runs in a sandbox under its own origin (quiz://<id>),
  // can't reach the computer, and gets no camera, microphone or similar permissions.
  const ses = session.fromPartition('persist:quizzes');
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(false));
  ses.protocol.handle('quiz', req => {
    const url = new URL(req.url);
    const q = library.find(x => x.id === url.hostname);
    if (!q || (url.pathname !== '/' && url.pathname !== '/index.html')) return new Response('Not found', { status: 404 });
    return new Response(fs.readFileSync(quizFile(q.id)), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  });
}

function registerIpc() {
  ipcMain.handle('library', () => library);
  ipcMain.handle('catalog', () => fetchCatalog());
  ipcMain.handle('download', (e, id) => downloadQuiz(String(id)));
  ipcMain.handle('open', (e, id) => openQuiz(String(id)));

  ipcMain.handle('remove', (e, id) => {
    library = library.filter(q => q.id !== id);
    try { fs.unlinkSync(quizFile(String(id))); } catch {}
    saveLibrary();
    return library;
  });

  ipcMain.handle('import-pick', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Quiz-Datei wählen', properties: ['openFile'],
      filters: [{ name: 'Quiz (HTML)', extensions: ['html', 'htm', 'txt'] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const buf = fs.readFileSync(r.filePaths[0]);
    if (!looksLikeQuiz(buf)) throw new Error('Diese Datei ist kein Quiz. Wähle eine .html-Datei (höchstens 5 MB).');
    const token = crypto.randomUUID();
    pendingImports.set(token, buf);
    return { token, title: titleOf(buf.toString('utf8')) || path.parse(r.filePaths[0]).name.replace(/\.quiz$/, '') };
  });

  ipcMain.handle('import-save', (e, token, meta) => {
    const buf = pendingImports.get(token);
    if (!buf) throw new Error('Die Datei ist nicht mehr da. Wähle sie nochmal.');
    pendingImports.delete(token);
    const m = clean(meta);
    const id = slug(m.title);
    fs.writeFileSync(quizFile(id), buf);
    library.push({ id, ...m, source: 'import', sha256: sha256(buf) });
    saveLibrary();
    return library;
  });

  ipcMain.handle('update-meta', (e, id, meta) => {
    const q = library.find(x => x.id === id);
    if (q) { Object.assign(q, clean({ ...q, ...meta })); saveLibrary(); }
    return library;
  });

  ipcMain.handle('export', async (e, id) => {
    const q = library.find(x => x.id === id);
    if (!q) return null;
    const r = await dialog.showSaveDialog(win, {
      title: 'Quiz speichern', defaultPath: path.join(app.getPath('downloads'), q.title.replace(/[\\/:*?"<>|]/g, '') + '.html'),
      filters: [{ name: 'Quiz (HTML)', extensions: ['html'] }],
    });
    if (r.canceled || !r.filePath) return null;
    fs.copyFileSync(quizFile(q.id), r.filePath);
    shell.showItemInFolder(r.filePath);
    return r.filePath;
  });

  // GitHub only accepts certain attachment types, so the quiz goes along as a .txt copy of its HTML.
  ipcMain.handle('submit', async (e, id) => {
    const q = library.find(x => x.id === id);
    if (!q) return null;
    const file = path.join(app.getPath('downloads'), q.id + '.quiz.txt');
    fs.copyFileSync(quizFile(q.id), file);
    shell.showItemInFolder(file);
    const p = new URLSearchParams({
      template: 'quiz.yml', title: 'Quiz: ' + q.title,
      titel: q.title, fach: FORM_TONES[q.tone] || 'Anderes', reiter: q.tag, beschreibung: q.desc,
    });
    shell.openExternal(`https://github.com/${REPO}/issues/new?${p}`);
    return file;
  });

  ipcMain.handle('open-repo', () => shell.openExternal(`https://github.com/${REPO}`));
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  quizDir = path.join(app.getPath('userData'), 'quizzes');
  libFile = path.join(app.getPath('userData'), 'library.json');
  loadLibrary();
  setupQuizSession();
  registerIpc();
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);

  win = new BrowserWindow({
    width: 1200, height: 860, minWidth: 420, minHeight: 560, title: 'QuizDesk', autoHideMenuBar: true,
    icon: iconPath(),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
});

app.on('window-all-closed', () => app.quit());
