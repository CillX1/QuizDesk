// Duels. Live: two PCs connect directly with a 5-letter room code (PeerJS); the host picks the
// questions and runs the clock. Challenge: play alone, then share a code that holds the seed for the
// same questions plus your points, so someone else can try to beat you later.
(() => {
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const PREFIX = 'quizdesk-v1-';
  const REVEAL_MS = 2800;
  const $ = id => document.getElementById(id);

  let peer = null, conn = null, role = null;   // role: 'host' | 'guest' | 'solo' | 'challenge'
  let settings = null;                         // host: { pool, n, time }
  let game = null;

  // ---------- helpers ----------
  const myName = () => ($('d-name').value.trim() || 'Ich').slice(0, 20);
  const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
  const randCode = () => Array.from(crypto.getRandomValues(new Uint32Array(5)), n => ALPHA[n % ALPHA.length]).join('');
  const points = (ok, ms, time) => ok ? Math.round(500 + 500 * Math.max(0, 1 - ms / (time * 1000))) : 0;

  function rng(seed) {
    return () => {
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffled(arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // The same pool and seed always give the same questions in the same order.
  function makeRound(pool, n, seed) {
    const r = rng(seed);
    return shuffled(pool.questions.map((_, i) => i), r).slice(0, n).map(i => {
      const x = pool.questions[i];
      const opts = shuffled([x.a, ...shuffled(x.w, r).slice(0, 3)], r);
      return { t: x.t, q: x.q, code: x.code, opts, c: opts.indexOf(x.a) };
    });
  }

  const b64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

  async function copy(text) { try { await api.copy(text); toast('Kopiert'); } catch { toast('Kopieren ging nicht', true); } }

  // ---------- setup screen ----------
  function fillQuizzes() {
    const sel = $('d-quiz'), keep = sel.value;
    sel.textContent = '';
    const usable = library.filter(q => q.duelSha);
    for (const q of usable) { const o = el('option', null, q.title); o.value = q.id; sel.append(o); }
    if (usable.some(q => q.id === keep)) sel.value = keep;
    $('d-none').hidden = usable.length > 0;
    $('btn-host').disabled = $('btn-solo').disabled = !usable.length;
  }

  async function loadPool() {
    const id = $('d-quiz').value;
    if (!id) throw new Error('Wähle zuerst ein Quiz.');
    return api.duelPool(id);
  }

  function liveError(msg) { $('live-err').textContent = msg; }
  function showLobby(on) { $('live-idle').hidden = on; $('live-lobby').hidden = !on; }

  function leave() {
    try { conn && conn.close(); } catch {}
    try { peer && peer.destroy(); } catch {}
    peer = conn = null; role = null; settings = null;
    clearTimers();
    showLobby(false);
    $('btn-start').hidden = true;
  }

  // ---------- live: connection ----------
  function send(msg) { if (conn && conn.open) conn.send(msg); }

  function hookConnection(c) {
    conn = c;
    c.on('open', () => send({ type: 'hello', name: myName(), v: 1 }));
    c.on('data', msg => { try { onMessage(msg); } catch (e) { console.error(e); } });
    c.on('close', () => { if (conn === c) lost(); });
    c.on('error', () => { if (conn === c) lost(); });
  }

  function lost() {
    const inGame = !$('game').hidden, ended = inGame && !$('g-end').hidden;
    const opp = game ? game.opp.name : 'Dein Gegner';
    leave();
    if (ended) {
      // Keep the result on screen; there just can't be a rematch any more.
      showEnd($('g-end-title').textContent, `${$('g-end-score').textContent} · ${opp} hat das Duell verlassen.`, [['Zurück', 'primary', closeGame]]);
    } else if (inGame) {
      clearTimers();
      $('g-status').textContent = 'Die Verbindung zum Gegner ist abgebrochen.';
      showEnd('Verbindung verloren', '', [['Zurück', 'primary', closeGame]]);
    } else {
      liveError('Die Verbindung ist abgebrochen.');
    }
  }

  function peerError(e) {
    const type = e && e.type;
    if (role === 'host' && type === 'unavailable-id') { try { peer.destroy(); } catch {} return hostCreate(); }
    const msg = type === 'peer-unavailable' ? 'Kein offenes Duell mit diesem Code gefunden. Stimmt der Code?'
      : type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed'
        ? 'Keine Verbindung zum Duell-Server. Bist du mit dem Internet verbunden?'
        : type === 'browser-incompatible' ? 'Live-Duelle gehen auf diesem Gerät nicht.' : 'Das Duell konnte nicht verbunden werden.';
    leave();
    liveError(msg);
  }

  function hostCreate() {
    role = 'host';
    const code = randCode();
    peer = new Peer(PREFIX + code, { debug: 0 });
    peer.on('open', () => {
      $('lobby-code').textContent = code;
      $('lobby-status').textContent = 'Warte auf deinen Gegner… Schick ihm den Code.';
      showLobby(true);
    });
    peer.on('connection', c => {
      if (conn) { c.on('open', () => { c.send({ type: 'busy' }); setTimeout(() => c.close(), 500); }); return; }
      hookConnection(c);
    });
    peer.on('error', peerError);
  }

  function guestJoin(code) {
    role = 'guest';
    peer = new Peer({ debug: 0 });
    peer.on('open', () => {
      hookConnection(peer.connect(PREFIX + code, { reliable: true }));
      $('lobby-code').textContent = code;
      $('lobby-status').textContent = 'Verbinde…';
      $('btn-copy-code').hidden = true;
      showLobby(true);
    });
    peer.on('error', peerError);
  }

  // ---------- live: messages ----------
  function onMessage(m) {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'busy') { leave(); liveError('Dieses Duell ist schon voll.'); return; }
    if (m.type === 'hello') {
      const opp = str(m.name, 20) || 'Gegner';
      if (game) game.opp.name = opp;
      $('lobby-status').textContent = role === 'host' ? `${opp} ist da. Bereit?` : `Verbunden mit ${opp}. Warte, bis das Duell startet…`;
      if (role === 'host') { $('btn-start').hidden = false; $('lobby-status').dataset.opp = opp; }
      else $('lobby-status').dataset.opp = opp;
      return;
    }
    if (role === 'guest') {
      if (m.type === 'start') {
        const qs = Array.isArray(m.questions) ? m.questions.slice(0, 30).map(x => ({
          t: str(x.t, 60), q: str(x.q, 400), code: str(x.code, 600),
          opts: Array.isArray(x.opts) ? x.opts.slice(0, 4).map(o => str(o, 200)) : [],
        })).filter(x => x.q && x.opts.length === 4) : [];
        if (!qs.length) return;
        startGame({ mode: 'guest', title: str(m.title, 80), questions: qs, time: Math.min(90, Math.max(5, +m.time || 20)),
          oppName: $('lobby-status').dataset.opp || 'Gegner' });
        $('g-status').textContent = 'Gleich geht’s los…';
      } else if (m.type === 'q' && game) {
        const i = m.i | 0;
        if (i >= 0 && i < game.questions.length) ask(i);
      } else if (m.type === 'answered' && game && (m.i | 0) === game.i && game.myChoice !== undefined) {
        $('g-status').textContent = `${game.opp.name} hat auch geantwortet.`;
      } else if (m.type === 'answered' && game && (m.i | 0) === game.i) {
        $('g-status').textContent = `${game.opp.name} hat schon geantwortet!`;
      } else if (m.type === 'reveal' && game && (m.i | 0) === game.i) {
        const me = m.guest || {}, op = m.host || {};
        reveal(m.c | 0, { choice: me.choice | 0, pts: me.pts | 0 }, { choice: op.choice | 0, pts: op.pts | 0 });
      } else if (m.type === 'end' && game) {
        finish();
      }
    } else if (role === 'host' && game && m.type === 'ans') {
      const i = m.i | 0, choice = Math.max(-1, Math.min(3, m.choice | 0));
      if (i !== game.i || game.oppAns) return;
      const ms = Math.max(0, Math.min(game.time * 1000, +m.ms || 0));
      game.oppAns = { choice, ms };
      if (game.myChoice === undefined) $('g-status').textContent = `${game.opp.name} hat schon geantwortet!`;
      maybeFinishRound();
    }
  }

  // ---------- host: running the duel ----------
  async function hostStartDuel() {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const questions = makeRound(settings.pool, settings.n, seed);
    send({ type: 'start', title: settings.pool.title, time: settings.time,
      questions: questions.map(({ t, q, code, opts }) => ({ t, q, code, opts })) });
    startGame({ mode: 'host', title: settings.pool.title, questions, time: settings.time,
      oppName: $('lobby-status').dataset.opp || 'Gegner' });
    $('g-status').textContent = 'Gleich geht’s los…';
    later(() => hostAsk(0), 1500);
  }

  function hostAsk(i) {
    send({ type: 'q', i });
    ask(i);
    game.oppAns = null;
    game.hostDeadline = later(() => { if (!game.oppAns) game.oppAns = { choice: -1, ms: game.time * 1000 }; maybeFinishRound(); }, game.time * 1000 + 1500);
  }

  function maybeFinishRound() {
    if (!game || game.mode !== 'host' || game.revealed || game.myChoice === undefined || !game.oppAns) return;
    const q = game.questions[game.i];
    const mine = { choice: game.myChoice, pts: points(game.myChoice === q.c, game.myMs, game.time) };
    const theirs = { choice: game.oppAns.choice, pts: points(game.oppAns.choice === q.c, game.oppAns.ms, game.time) };
    send({ type: 'reveal', i: game.i, c: q.c, host: mine, guest: theirs });
    reveal(q.c, mine, theirs);
    later(() => {
      if (game.i + 1 < game.questions.length) hostAsk(game.i + 1);
      else { send({ type: 'end' }); finish(); }
    }, REVEAL_MS);
  }

  // ---------- game screen (all modes) ----------
  let timers = [], tick = null;
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(tick); }

  function startGame({ mode, title, questions, time, oppName, target }) {
    clearTimers();
    game = { mode, title, questions, time, i: -1, me: { name: myName(), score: 0, pts: [] }, opp: { name: oppName || '', score: 0 }, target };
    $('g-me-name').textContent = game.me.name;
    $('g-opp-name').textContent = game.opp.name;
    $('g-opp-name').parentElement.hidden = mode === 'solo';
    $('g-me-score').textContent = $('g-opp-score').textContent = '0';
    $('g-play').hidden = false; $('g-end').hidden = true;
    $('g-q').textContent = title; $('g-topic').textContent = mode === 'solo' ? 'Herausforderung' : 'Duell';
    $('g-code').hidden = true; $('g-answers').textContent = ''; $('g-progress').textContent = '';
    $('g-timer').style.transform = 'scaleX(1)';
    $('game').hidden = false;
  }

  function ask(i) {
    const q = game.questions[i];
    Object.assign(game, { i, myChoice: undefined, myMs: 0, revealed: false, t0: performance.now() });
    $('g-progress').textContent = `Frage ${i + 1} / ${game.questions.length}`;
    $('g-topic').textContent = q.t || game.title;
    $('g-q').textContent = q.q;
    $('g-code').hidden = !q.code; $('g-code').textContent = q.code || '';
    $('g-status').textContent = '';
    const box = $('g-answers'); box.textContent = '';
    q.opts.forEach((o, k) => {
      const b = el('button', 'ans a' + k);
      b.type = 'button';
      b.append(el('span', 'key', String(k + 1)), el('span', 'txt', o));
      b.onclick = () => answer(k);
      box.append(b);
    });
    const bar = $('g-timer');
    const frame = () => {
      const left = 1 - (performance.now() - game.t0) / (game.time * 1000);
      bar.style.transform = `scaleX(${Math.max(0, left)})`;
      if (left <= 0) { if (game.myChoice === undefined) answer(-1); return; }
      tick = requestAnimationFrame(frame);
    };
    cancelAnimationFrame(tick);
    tick = requestAnimationFrame(frame);
  }

  function answer(k) {
    if (!game || game.myChoice !== undefined || game.revealed) return;
    game.myChoice = k;
    game.myMs = Math.min(game.time * 1000, performance.now() - game.t0);
    cancelAnimationFrame(tick);
    [...$('g-answers').children].forEach((b, j) => { b.disabled = true; if (j === k) b.classList.add('picked'); });
    if (game.mode === 'guest') {
      send({ type: 'ans', i: game.i, choice: k, ms: game.myMs });
      $('g-status').textContent = k < 0 ? 'Zeit abgelaufen.' : `Warte auf ${game.opp.name}…`;
    } else if (game.mode === 'host') {
      send({ type: 'answered', i: game.i });
      if (!game.oppAns) $('g-status').textContent = k < 0 ? 'Zeit abgelaufen.' : `Warte auf ${game.opp.name}…`;
      maybeFinishRound();
    } else {
      const q = game.questions[game.i];
      const mine = { choice: k, pts: points(k === q.c, game.myMs, game.time) };
      const theirs = game.target ? { choice: -2, pts: game.target.p[game.i] | 0 } : null;
      reveal(q.c, mine, theirs);
      later(() => game.i + 1 < game.questions.length ? ask(game.i + 1) : finish(), REVEAL_MS);
    }
  }

  function reveal(c, mine, theirs) {
    game.revealed = true;
    cancelAnimationFrame(tick);
    game.me.score += mine.pts; game.me.pts[game.i] = mine.pts;
    if (theirs) game.opp.score += theirs.pts;
    $('g-me-score').textContent = game.me.score;
    $('g-opp-score').textContent = game.opp.score;
    [...$('g-answers').children].forEach((b, j) => {
      b.disabled = true;
      b.classList.add(j === c ? 'right' : 'dim');
      if (theirs && j === theirs.choice) b.append(el('span', 'opp-pick', game.opp.name));
    });
    const me = mine.choice === c ? `Richtig! +${mine.pts}` : mine.choice < 0 ? 'Zeit abgelaufen.' : 'Leider falsch.';
    const op = !theirs ? '' : theirs.choice === -2 ? ` · ${game.opp.name} hatte hier ${theirs.pts} Punkte.`
      : ` · ${game.opp.name}: ${theirs.choice === c ? '+' + theirs.pts : theirs.choice < 0 ? 'keine Antwort' : 'falsch'}`;
    $('g-status').textContent = me + op;
  }

  function finish() {
    clearTimers();
    const me = game.me.score, op = game.opp.score;
    if (game.mode === 'solo') {
      const code = 'QD-' + b64(JSON.stringify({ v: 1, q: game.quizId, h: game.sha.slice(0, 10), s: game.seed, t: game.time, m: game.me.name, p: game.me.pts }));
      $('g-chal-code').textContent = code;
      $('g-share').hidden = false;
      const msg = `Ich fordere dich in QuizDesk heraus! „${game.title}“, ${game.questions.length} Fragen, ich habe ${me} Punkte. Duell → Herausforderung annehmen und diesen Code einfügen:\n${code}`;
      showEnd(`${me} Punkte`, 'Schick den Code jemandem. Wer schafft mehr?', [
        ['Code mit Nachricht kopieren', 'primary', () => copy(msg)],
        ['Nur Code kopieren', '', () => copy(code)],
        ['Fertig', 'small', closeGame]]);
      return;
    }
    $('g-share').hidden = true;
    const title = me > op ? 'Du gewinnst! 🏆' : me < op ? `${game.opp.name} gewinnt` : 'Unentschieden';
    const actions = game.mode === 'host' ? [['Revanche', 'primary', () => hostStartDuel()], ['Beenden', 'small', () => { leave(); closeGame(); }]]
      : game.mode === 'guest' ? [['Beenden', 'small', () => { leave(); closeGame(); }]]
      : [['Fertig', 'primary', closeGame]];
    showEnd(title, `${game.me.name} ${me} : ${op} ${game.opp.name}`, actions);
    if (game.mode === 'guest') $('g-status').textContent = `Warte, ob ${game.opp.name} eine Revanche startet…`;
  }

  function showEnd(title, sub, actions) {
    $('g-play').hidden = false;
    $('g-answers').textContent = ''; $('g-code').hidden = true; $('g-q').textContent = ''; $('g-topic').textContent = '';
    $('g-play').hidden = true;
    $('g-end').hidden = false;
    $('g-end-title').textContent = title;
    $('g-end-score').textContent = sub;
    const box = $('g-end-actions'); box.textContent = '';
    for (const [label, cls, fn] of actions) {
      const b = el('button', 'btn ' + cls, label); b.type = 'button'; b.onclick = fn; box.append(b);
    }
  }

  function closeGame() {
    clearTimers();
    game = null;
    $('game').hidden = true;
    $('g-share').hidden = true;
  }

  // ---------- buttons ----------
  $('btn-host').onclick = async () => {
    liveError('');
    try {
      const pool = await loadPool();
      settings = { pool, n: Math.min(+$('d-n').value, pool.questions.length), time: +$('d-time').value };
      $('btn-copy-code').hidden = false;
      hostCreate();
    } catch (e) { liveError(errText(e)); }
  };

  $('btn-join').onclick = () => {
    liveError('');
    const code = $('d-code').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) { liveError('Der Code hat 5 Zeichen, z. B. K7P2Q.'); return; }
    guestJoin(code);
  };
  $('d-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join').click(); });

  $('btn-start').onclick = () => { $('btn-start').hidden = true; hostStartDuel(); };
  $('btn-leave').onclick = leave;
  $('btn-copy-code').onclick = () => copy(`Duell in QuizDesk! Duell → Code eingeben: ${$('lobby-code').textContent}`);

  $('btn-solo').onclick = async () => {
    $('chal-err').textContent = '';
    try {
      const pool = await loadPool();
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const n = Math.min(+$('d-n').value, pool.questions.length), time = +$('d-time').value;
      role = 'solo';
      startGame({ mode: 'solo', title: pool.title, questions: makeRound(pool, n, seed), time });
      Object.assign(game, { quizId: pool.id, sha: pool.sha, seed });
      later(() => ask(0), 900);
    } catch (e) { $('chal-err').textContent = errText(e); }
  };

  $('btn-accept').onclick = async () => {
    const err = $('chal-err'); err.textContent = '';
    const m = /QD-([A-Za-z0-9_-]+)/.exec($('d-chal').value);
    let c;
    try { c = JSON.parse(unb64(m[1])); } catch { err.textContent = 'Das ist kein gültiger Herausforderungs-Code. Kopiere ihn ganz, er beginnt mit QD-.'; return; }
    const q = library.find(x => x.id === c.q);
    if (!q || !q.duelSha) { err.textContent = 'Dafür brauchst du ein Quiz, das du noch nicht hast. Lade es unter „Entdecken“ herunter.'; return; }
    if (!q.duelSha.startsWith(str(c.h, 10))) { err.textContent = 'Ihr habt verschiedene Versionen dieses Quiz. Ladet beide unter „Entdecken“ das Update.'; return; }
    try {
      const pool = await api.duelPool(q.id);
      const p = Array.isArray(c.p) ? c.p.slice(0, 30).map(x => x | 0) : [];
      const time = Math.min(90, Math.max(5, +c.t || 20));
      role = 'challenge';
      startGame({ mode: 'challenge', title: pool.title, questions: makeRound(pool, p.length, c.s >>> 0), time,
        oppName: str(c.m, 20) || 'Herausforderer', target: { p } });
      later(() => ask(0), 900);
    } catch (e) { err.textContent = errText(e); }
  };

  $('g-quit').onclick = () => { if (role === 'host' || role === 'guest') leave(); closeGame(); };
  document.addEventListener('keydown', e => {
    if ($('game').hidden || !game || e.target.tagName === 'INPUT') return;
    const k = '1234'.indexOf(e.key);
    if (k >= 0) answer(k);
  });

  // Remember the name on this computer.
  try { $('d-name').value = localStorage.getItem('qd-name') || ''; } catch {}
  $('d-name').addEventListener('input', () => { try { localStorage.setItem('qd-name', $('d-name').value); } catch {} });
  document.addEventListener('qd:tab', e => { if (e.detail === 'duel') fillQuizzes(); });
  window.quizdeskDuel = { fillQuizzes };
})();
