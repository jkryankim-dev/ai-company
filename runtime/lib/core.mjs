import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const p = (...a) => path.join(ROOT, ...a);

export const env = (() => {
  const e = {};
  for (const line of fs.readFileSync(p('.env'), 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    e[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return e;
})();

export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
export const now   = () => new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
export const log   = (...m) => console.log(`[${now()}]`, ...m);

// --- 인사기록카드 로딩 ---
function frontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    else if (v.startsWith('{')) { try { v = JSON.parse(v.replace(/(\w+):/g, '"$1":')); } catch {} }
    meta[k] = v;
  }
  return { meta, body: src.slice(m[0].length) };
}

export function loadOrg() {
  const dir = p('org');
  const staff = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md') || f === 'handbook.md' || f === 'README.md') continue;
    const { meta, body } = frontmatter(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!meta.id) continue;
    staff.push({ ...meta, card: body, file: f });
  }
  const order = ['chief_of_staff','qa_lead','pm','dev_1','dev_2','marketing','ops','librarian','analyst'];
  staff.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return staff;
}

export const handbook = () => fs.readFileSync(p('org', 'handbook.md'), 'utf8');

// 직원에게 주는 시스템 프롬프트 = 사규 + 본인 인사기록카드
export const systemFor = (s) =>
  `${handbook()}\n\n---\n\n# 너의 인사기록카드\n\n이름: ${s.name} / 직무: ${s.title}\n\n${s.card}`;

export function saveState(name, data) {
  fs.mkdirSync(p('runtime', 'state'), { recursive: true });
  fs.writeFileSync(p('runtime', 'state', name), JSON.stringify(data, null, 2));
}
export function readState(name, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p('runtime', 'state', name), 'utf8')); } catch { return fallback; }
}
