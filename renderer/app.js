const api = window.quizdesk;
const TONES = { mathe: 'Mathe', netz: 'Netzwerk', sql: 'Datenbanken', web: 'Web', sprache: 'Sprachen', other: 'Anderes' };
const $ = id => document.getElementById(id);

let library = [];
let catalog = null;          // null = not loaded yet, false = offline
let filter = 'all', query = '';
let metaMode = null;         // { kind: 'import', token } or { kind: 'edit', id }

const errText = e => String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

let toastTimer;
function toast(msg, bad) {
  const t = $('toast');
  t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, bad ? 5000 : 2500);
}

function card(q) {
  const c = el('article', 'card');
  c.style.setProperty('--tc', `var(--t-${TONES[q.tone] ? q.tone : 'other'})`);
  c.append(el('span', 'tab', q.tag || TONES[q.tone] || 'Quiz'), el('h3', null, q.title), el('p', 'desc', q.desc || ''));
  if (q.author) c.append(el('span', 'meta', 'von ' + q.author));
  return c;
}

function button(label, cls, onClick) {
  const b = el('button', 'btn ' + (cls || ''), label);
  b.type = 'button';
  b.onclick = onClick;
  return b;
}

async function busy(btn, label, fn) {
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = label;
  try { await fn(); } catch (e) { toast(errText(e), true); }
  finally { btn.disabled = false; btn.textContent = old; }
}

function renderMine() {
  $('n-mine').textContent = library.length;
  const used = new Set(library.map(q => q.tone));
  const chips = $('chips');
  chips.textContent = '';
  if (filter !== 'all' && !used.has(filter)) filter = 'all';
  [['all', 'Alle'], ...Object.keys(TONES).filter(k => used.has(k)).map(k => [k, TONES[k]])].forEach(([k, label]) => {
    const b = el('button', 'chip', label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(filter === k));
    b.onclick = () => { filter = k; renderMine(); };
    chips.append(b);
  });

  const shown = library.filter(q => (filter === 'all' || q.tone === filter) &&
    (!query || `${q.title} ${q.desc} ${q.tag}`.toLowerCase().includes(query)));
  const grid = $('grid-mine');
  grid.textContent = '';
  if (!shown.length) {
    grid.append(el('div', 'empty', library.length ? 'Kein Quiz passt zu deiner Suche.' : 'Noch keine Quizze. Lade welche unter „Entdecken“ herunter oder füge eine Datei hinzu.'));
    return;
  }
  for (const q of shown) {
    const c = card(q);
    const remote = catalog && catalog.find(x => x.id === q.id);
    const act = el('div', 'actions');
    act.append(button('Starten', 'primary', () => api.open(q.id)));
    if (q.duelSha) c.insertBefore(el('span', 'meta', '⚔ Duell möglich'), c.querySelector('.desc'));
    if (q.source === 'catalog' && outdated(q, remote)) {
      c.insertBefore(el('span', 'badge', 'Neue Version verfügbar'), c.querySelector('.desc'));
      const up = button('Update laden', 'small', () => busy(up, 'Lädt…', async () => { library = await api.download(q.id); renderAll(); toast('Aktualisiert'); }));
      act.append(up);
    }
    if (q.source === 'import') {
      act.append(button('Einreichen', 'small', () => submit(q)));
      act.append(button('Bearbeiten', 'small', () => openMeta({ kind: 'edit', id: q.id }, q)));
    }
    act.append(button('Exportieren', 'small', async () => { try { if (await api.exportQuiz(q.id)) toast('Gespeichert'); } catch (e) { toast(errText(e), true); } }));
    const del = button('Entfernen', 'small danger', async () => {
      if (!del.classList.contains('armed')) { del.classList.add('armed'); del.textContent = 'Wirklich?'; return; }
      library = await api.remove(q.id); renderAll(); toast('Entfernt');
    });
    act.append(del);
    c.append(act);
    grid.append(c);
  }
}

function renderFind() {
  const net = $('net'), grid = $('grid-find');
  grid.textContent = '';
  if (catalog === null) { net.className = 'net'; $('net-text').textContent = 'Verbinde…'; return; }
  if (catalog === false) {
    net.className = 'net off';
    $('net-text').textContent = 'Offline. Deine Quizze unter „Meine Quizze“ funktionieren trotzdem.';
    grid.append(el('div', 'empty', 'Verbinde dich mit dem Internet, um neue Quizze zu sehen.'));
    return;
  }
  net.className = 'net on';
  $('net-text').textContent = `Online · ${catalog.length} ${catalog.length === 1 ? 'Quiz' : 'Quizze'} in der Sammlung`;
  if (!catalog.length) grid.append(el('div', 'empty', 'Die Sammlung ist noch leer.'));
  for (const q of catalog) {
    const c = card(q);
    const mine = library.find(x => x.id === q.id);
    const act = el('div', 'actions');
    if (q.duel) c.insertBefore(el('span', 'meta', '⚔ Duell möglich'), c.querySelector('.desc'));
    if (mine && !outdated(mine, q)) {
      act.append(el('span', 'done', '✓ Geladen'), button('Starten', 'small', () => api.open(q.id)));
    } else {
      const b = button(mine ? 'Update laden' : 'Herunterladen', 'primary', () =>
        busy(b, 'Lädt…', async () => { library = await api.download(q.id); renderAll(); toast('„' + q.title + '“ ist jetzt offline verfügbar'); }));
      act.append(b);
    }
    c.append(act);
    grid.append(c);
  }
}

function renderAll() { renderMine(); renderFind(); }

async function loadCatalog() {
  catalog = null; renderFind();
  const r = await api.catalog();
  catalog = r.ok ? r.quizzes : false;
  renderAll();
}

function showTab(which) {
  for (const t of ['mine', 'find', 'duel']) {
    $('tab-' + t).setAttribute('aria-selected', String(t === which));
    $('view-' + t).hidden = t !== which;
  }
  document.dispatchEvent(new CustomEvent('qd:tab', { detail: which }));
}

// A catalog quiz needs an update when the quiz or its duel questions changed online.
const outdated = (mine, remote) => remote && ((remote.sha256 && remote.sha256 !== mine.sha256) || (remote.duelSha256 && remote.duelSha256 !== mine.duelSha));

function openMeta(mode, q) {
  metaMode = mode;
  $('meta-heading').textContent = mode.kind === 'edit' ? 'Quiz bearbeiten' : 'Quiz hinzufügen';
  $('m-title').value = q.title || '';
  $('m-tone').value = TONES[q.tone] ? q.tone : 'other';
  $('m-tag').value = q.tag || '';
  $('m-desc').value = q.desc || '';
  $('m-err').textContent = '';
  $('dlg-meta').showModal();
  $('m-title').focus();
}

async function submit(q) {
  try {
    const file = await api.submit(q.id);
    if (!file) return;
    $('s-file').textContent = file;
    $('dlg-submit').showModal();
  } catch (e) { toast(errText(e), true); }
}

$('form-meta').addEventListener('submit', async ev => {
  ev.preventDefault();
  const meta = { title: $('m-title').value, tone: $('m-tone').value, tag: $('m-tag').value, desc: $('m-desc').value };
  try {
    library = metaMode.kind === 'import' ? await api.importSave(metaMode.token, meta) : await api.updateMeta(metaMode.id, meta);
    $('dlg-meta').close();
    showTab('mine'); renderAll();
    toast(metaMode.kind === 'import' ? 'Hinzugefügt' : 'Gespeichert');
  } catch (e) { $('m-err').textContent = errText(e); }
});
$('m-cancel').onclick = () => $('dlg-meta').close();
$('s-ok').onclick = () => $('dlg-submit').close();

$('btn-import').onclick = async () => {
  try {
    const r = await api.importPick();
    if (r) openMeta({ kind: 'import', token: r.token }, { title: r.title, tone: 'other' });
  } catch (e) { toast(errText(e), true); }
};
$('btn-refresh').onclick = loadCatalog;
$('btn-repo').onclick = () => api.openRepo();
$('tab-mine').onclick = () => showTab('mine');
$('tab-find').onclick = () => { showTab('find'); if (catalog === false) loadCatalog(); };
$('tab-duel').onclick = () => showTab('duel');
$('btn-update').onclick = () => api.openRelease();
$('q').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); renderMine(); });

(async () => {
  library = await api.library();
  renderAll();
  loadCatalog();
  const latest = await api.updateCheck();
  if (latest) {
    $('update-text').textContent = `QuizDesk ${latest} ist da (du hast ${await api.version()}).`;
    $('update').hidden = false;
  }
})();
