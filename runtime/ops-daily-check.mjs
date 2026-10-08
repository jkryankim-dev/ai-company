// 두레 - 일일 실측 3종 (콘솔 무입력·inbox/pending·무인증 REST)
// 사용법: node runtime/ops-daily-check.mjs
// 출력: 테스트 일지 묶음 행 실측 근거 양식(test-journal.md 기록 규칙)과 동일 구성의 1행.
//   일지 양식 부가 항목(최종 커밋)도 함께 출력한다.
// 근거: org/proposals.md 큐 #12 채택(2026-10-07 종합) 이행 — 검증: 당일 수동 실측 결과와 대조.
// 이전 REST 측정값은 runtime/state/ops-daily.json(gitignore)에 보관해 무변동/변동을 판정한다.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');

// ---- .env 로드 (check.mjs 방식 준용) ----
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('=');
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const now = new Date();
const stamp = `${now.getMonth() + 1}/${now.getDate()}`;

// ---- 1. inbox/pending 점검 ----
const pending = fs.readdirSync(path.join(ROOT, 'inbox/pending')).filter(f => f !== '.gitkeep');
const inboxNote = pending.length
  ? `수신 ${pending.length}건(${pending.join(', ')})`
  : '수신 0건·.gitkeep 외 부재';

// ---- 2. 최종 커밋 (일지 양식 부가 항목 — 시각은 KST, 자동 저장 커밋 메시지 관례와 동일) ----
const GIT_OPT = { cwd: ROOT, env: { ...process.env, TZ: 'Asia/Seoul' } };
const last = execSync(`git log -1 --pretty=format:'%h|%ad' --date=format-local:'%-m/%-d %H:%M'`, GIT_OPT)
  .toString().split('|');
const kst = new Date(now.getTime() + 9 * 3600e3);
const since = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')} 00:00 +09:00`;
const todayCount = parseInt(execSync(`git rev-list --count --since='${since}' HEAD`, { cwd: ROOT }).toString(), 10);
const commitNote = `최종 커밋 ${last[0]}(${last[1]}), 금일(KST) 커밋 ${todayCount}건`;

// ---- 3. console-input 무입력 확인 ----
// '붙여넣는 곳' 절에 안내 괄호행 외 본문이 있으면 대표 값 도착으로 본다.
const ci = fs.readFileSync(path.join(ROOT, 'org/console-input.md'), 'utf8');
const section = ci.split('## 붙여넣는 곳')[1] || '';
const hasInput = section.split(/\r?\n/).some(l => {
  const t = l.trim();
  return t && !t.startsWith('(') && !t.startsWith('—');
});
const consoleNote = hasInput ? '입력 감지(대표 값 도착 — 이관 몫)' : '무입력';

// ---- 4. 무인증 REST 무변동 조회 (meeting.mjs:62 방식 준용) ----
const m = (env.GITHUB_REPO || '').match(/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
let restNote = '측정 불가(GITHUB_REPO 미인식)';
if (m) {
  try {
    const r = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}/issues?state=open&per_page=30`, {
      headers: { 'User-Agent': 'doore', Accept: 'application/vnd.github+json' },
    });
    if (!r.ok) restNote = `측정 불가(HTTP ${r.status})`;
    else {
      const open = (await r.json()).filter(i => !i.pull_request).length;
      const stateFile = path.join(ROOT, 'runtime/state/ops-daily.json');
      const prev = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
      restNote = prev
        ? `무인증 REST open ${open}건(${prev.open === open ? '무변동' : `변동 ${prev.open}→${open}(${prev.date} 대비)`})`
        : `무인증 REST open ${open}건(첫 회 측정 — 이전값 없음)`;
      fs.writeFileSync(stateFile, JSON.stringify({ open, date: now.toISOString().slice(0, 10) }));
    }
  } catch (e) { restNote = `측정 불가(${e.message})`; }
}

// ---- 출력 (일지 묶음 행 실측 근거 양식) ----
console.log(`${stamp} 실측: inbox/pending ${inboxNote}, ${commitNote}, console-input.md 붙여넣기 칸 ${consoleNote}, ${restNote}`);
