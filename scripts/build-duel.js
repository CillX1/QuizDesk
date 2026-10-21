// Builds the duel question pools (quizzes/<id>.duel.json) from the quizzes themselves:
// each quiz is loaded in a hidden window and its own question generators are sampled many times.
// Run with: npx electron scripts/build-duel.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'quizzes');
const SAMPLES = 12;

// Runs inside the quiz page. Returns [{t, q, code, a, w}] with a = correct answer, w = wrong answers.
const EXTRACT = String.raw`(() => {
  const out = [], skipped = {};
  const strip = s => String(s ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
  const add = (t, q, a, w, code, keys) => {
    const extra = (keys || []).filter(k => !['q','qi','a','w','v','exact','unit','tol','e','code','kind','sql','opts','fields'].includes(k));
    if (extra.length) { extra.forEach(k => skipped[k] = (skipped[k] || 0) + 1); return; }
    w = [...new Set((w || []).map(strip))].filter(x => x && x !== strip(a));
    if (!q || !a || w.length < 3) return;
    out.push({ t, q: strip(q), code: code ? strip(code) : undefined, a: strip(a), w: w.slice(0, 6) });
  };
  const N = ${SAMPLES};
  if (typeof ALL !== 'undefined') {                       // HTTP Quizshow: fixed list
    ALL.forEach(x => add('HTTP', x.q, x.a[x.c], x.a.filter((_, i) => i !== x.c)));
  } else if (typeof GENS !== 'undefined') {               // Netzwerkgrundlagen
    const cat = id => (CATS[goalById[id]?.cat] || {}).name || '';
    [...Q, ...Q2].forEach(x => {
      const o = Array.isArray(x) ? { obj: x[0], q: x[1], opts: x[2] } : x;
      if (o.opts) add(cat(o.obj), o.q, o.opts[0], o.opts.slice(1));
    });
    GENS.forEach(g => { for (let i = 0; i < N; i++) { try { const r = g.make(); if (r.opts) add(cat(g.obj), r.q, r.opts[0], r.opts.slice(1)); } catch (e) {} } });
  } else {                                                // SQL / Mathe: K(topic, level, "m"/"i", generator)
    Q.filter(x => x.mc).forEach(x => {
      for (let i = 0; i < N; i++) { try { const r = x.g(); add(T[x.t], r.q, r.a, r.w, r.code, Object.keys(r)); } catch (e) {} }
    });
  }
  return { out, skipped };
})()`;

app.on('window-all-closed', () => {});   // keep running between quizzes

app.whenReady().then(async () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(DIR, 'catalog.json'), 'utf8'));
  for (const q of catalog.quizzes) {
    const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
    await w.loadFile(path.join(DIR, q.file));
    const { out, skipped } = await w.webContents.executeJavaScript(EXTRACT);
    w.destroy();
    const seen = new Set();
    const pool = out.filter(x => { const k = x.q + '|' + (x.code || '') + '|' + x.a; if (seen.has(k)) return false; seen.add(k); return true; })
      .filter(x => x.q.length <= 400 && (x.code || '').length <= 600 && x.a.length <= 200);
    const file = q.id + '.duel.json';
    const json = JSON.stringify({ quiz: q.id, questions: pool }) + '\n';
    fs.writeFileSync(path.join(DIR, file), json);
    q.duel = file;
    q.duelSha256 = crypto.createHash('sha256').update(json).digest('hex');
    const topics = {};
    pool.forEach(x => topics[x.t] = (topics[x.t] || 0) + 1);
    console.log(`${q.id}: ${pool.length} questions`, topics, Object.keys(skipped).length ? 'skipped keys: ' + JSON.stringify(skipped) : '');
  }
  fs.writeFileSync(path.join(DIR, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  app.quit();
});
