// Turns an approved "Quiz einreichen" issue into a catalog entry: downloads the attached file,
// checks it, saves it under quizzes/ and adds it to quizzes/catalog.json.
// Env: ISSUE_BODY, ISSUE_USER, ISSUE_NUMBER. Writes "id" and "title" to $GITHUB_OUTPUT.
import fs from 'node:fs';
import crypto from 'node:crypto';

const MAX_BYTES = 5 * 1024 * 1024;
const TONES = { 'Mathe': 'mathe', 'Netzwerk / Telematik': 'netz', 'Datenbanken / SQL': 'sql', 'Web / Programmieren': 'web', 'Sprachen': 'sprache', 'Anderes': 'other' };

function fail(msg) {
  fs.writeFileSync('add-quiz-error.txt', msg);
  console.error(msg);
  process.exit(1);
}

// Issue forms render as "### Label\n\nvalue" blocks.
function fields(body) {
  const out = {};
  for (const part of body.split(/^### /m).slice(1)) {
    const nl = part.indexOf('\n');
    const value = part.slice(nl + 1).trim();
    out[part.slice(0, nl).trim()] = value === '_No response_' ? '' : value;
  }
  return out;
}

const one = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);

function slug(text, taken) {
  const base = text.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'quiz';
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

const f = fields(process.env.ISSUE_BODY || '');
const title = one(f['Titel'], 80);
if (!title) fail('Der Titel fehlt.');

const link = /https:\/\/github\.com\/user-attachments\/files\/[^\s)\]>"]+/.exec(f['Quiz-Datei'] || '');
if (!link) fail('Im Feld "Quiz-Datei" ist keine angehängte Datei. Zieh die .quiz.txt-Datei in das Feld.');

const res = await fetch(link[0], { redirect: 'follow' });
if (!res.ok) fail(`Die Datei konnte nicht geladen werden (HTTP ${res.status}).`);
const buf = Buffer.from(await res.arrayBuffer());
if (buf.length > MAX_BYTES) fail('Die Datei ist grösser als 5 MB.');
if (!/<(!doctype html|html|body|script)/i.test(buf.toString('utf8', 0, 20000))) fail('Die Datei ist keine HTML-Quizseite.');

const catalogPath = 'quizzes/catalog.json';
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const author = one(process.env.ISSUE_USER, 40);

// The same person sending a quiz with the same title again replaces their earlier version.
let id = slug(title, new Set());
const existing = catalog.quizzes.find(q => q.id === id);
if (existing && existing.author !== author) id = slug(title, new Set(catalog.quizzes.map(q => q.id)));

const entry = {
  id, title,
  tone: TONES[one(f['Fach'], 40)] || 'other',
  tag: one(f['Reiter-Text'], 24),
  desc: one(f['Kurzbeschreibung'], 200),
  author,
  added: new Date().toISOString().slice(0, 10),
  issue: Number(process.env.ISSUE_NUMBER) || undefined,
  file: id + '.html',
  sha256: crypto.createHash('sha256').update(buf).digest('hex'),
};

fs.writeFileSync('quizzes/' + entry.file, buf);
const i = catalog.quizzes.findIndex(q => q.id === id);
if (i >= 0) catalog.quizzes[i] = entry; else catalog.quizzes.push(entry);
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');

if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `id=${id}\ntitle=${title.replace(/[\r\n]/g, ' ')}\n`);
console.log(`Added ${id} (${buf.length} bytes)`);
