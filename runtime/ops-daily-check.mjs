// 두레 - 일일 실측 3종 (콘솔 무입력·inbox/pending·무인증 REST)
// 사용법: node runtime/ops-daily-check.mjs
// 출력: 테스트 일지 묶음 행 실측 근거 양식(test-journal.md 기록 규칙)과 동일 구성의 1행.
//   일지 양식 부가 항목(최종 커밋)도 함께 출력한다.
// 근거: org/proposals.md 큐 #12 채택(2026-10-07 종합) 이행 — 검증: 당일 수동 실측 결과와 대조.
// 2026-10-30 큐 #51 자체 채택(2026-10-29) 이행: '검증 대기 48시간 초과' 항 추가(아래 §5).
// 2026-11-02 큐 #32 이행(채택 2026-10-22 종합): '직전 세션 스탠드업 산출물 존재 점검' 항 추가(아래 §6).
// 2026-11-12 큐 #74③ 자체 채택 이행: '검증 대기 상태값 불일치' 항 추가(아래 §5).
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

// ---- 5. 검증 대기 48시간 상한 초과 행 (org/assignments.md '검증 대기' 표 — 큐 #51) ----
// 상한은 제출 익일 스탠드업(48시간). 제출일+2일 도래 시점부터 초과로 본다
// (10/19 제출→10/21 판정을 초과로 센 W10 집계 산식과 동일 기준).
// 상태값 규격: 미판정 행은 'QA 대기'(큐 #22 채택 — 배정표 '검증 대기' 절 설명문 인용),
// 불일치 행을 아래 탐지한다(큐 #74③).
const asg = fs.readFileSync(path.join(ROOT, 'org/assignments.md'), 'utf8');
const waitTable = (asg.split('## 검증 대기')[1] || '').split(/\r?\n/);
const pad = n => String(n).padStart(2, '0');
const ktoday = `${kst.getFullYear()}-${pad(kst.getMonth() + 1)}-${pad(kst.getDate())}`;
const over = [];
const badState = [];
for (const line of waitTable) {
  const c = line.split('|').map(s => s.trim());
  if (c.length < 5 || !/^\d{4}-\d{2}-\d{2}$/.test(c[3] || '')) continue; // 표 머리행·비날짜 행 제외
  const judged = /합격|통과|반려/.test(c[4] || ''); // 판정 완료(부분 통과 포함) 행
  if (!judged && !/^QA 대기/.test(c[4] || '')) {
    const label = c[1].length > 24 ? `${c[1].slice(0, 24)}…` : c[1];
    badState.push(`${label}(상태 '${c[4] || '(공백)'}')`);
  }
  if (judged) continue; // 판정 완료 행은 상한 계산에서 제외
  const due = new Date(Date.parse(`${c[3]}T00:00:00Z`) + 2 * 86400e3).toISOString().slice(0, 10);
  if (ktoday >= due) {
    const label = c[1].length > 24 ? `${c[1].slice(0, 24)}…` : c[1];
    over.push(`${label}(제출 ${c[3]})`);
  }
}
const waitNote = over.length
  ? `검증 대기 48시간 초과 ${over.length}건 — ${over.join(' · ')}`
  : '검증 대기 48시간 초과 0건';
const badNote = badState.length
  ? `검증 대기 상태값 불일치 ${badState.length}건(미판정 'QA 대기' 외 — 큐 #74③) — ${badState.join(' · ')}`
  : "검증 대기 상태값 불일치 0건(큐 #74③)";

// ---- 6. 직전 세션 스탠드업 산출물 존재 점검 (org/proposals.md 큐 #32) ----
// 직전 세션 = 금일 이전 중 스탠드업 산출물(메인·부서별 섹션)이 마지막으로 존재한 날.
// 점검: 메인 회의록 파일 · 섹션 파일 제출(기준선 = 그 직전 세션 제출 부서) · 섹션 파일 상단 각주.
// 한계: 탐지 단위가 '부서'라 개인 서브섹션 누락은 미탐지(큐 #45 dry-run 차이 ①과 동일 한계).
const mins = path.join(ROOT, 'meetings/minutes');
const seen = {};
for (const f of fs.readdirSync(mins)) {
  const fm = f.match(/^(\d{4}-\d{2}-\d{2})-standup(?:-([a-z-]+))?\.md$/);
  if (!fm || fm[1] >= ktoday) continue;
  (seen[fm[1]] ??= { main: false, slugs: [] });
  if (fm[2]) seen[fm[1]].slugs.push(fm[2]); else seen[fm[1]].main = true;
}
const sdates = Object.keys(seen).sort();
let standupNote;
if (!sdates.length) standupNote = '직전 세션 산출물 없음(최초 실행)';
else {
  const cur = seen[sdates.at(-1)];
  const base = sdates.at(-2) ? seen[sdates.at(-2)].slugs : [];
  const missing = base.filter(s => !cur.slugs.includes(s));
  const noNote = cur.slugs.filter(s => {
    const head = fs.readFileSync(path.join(mins, `${sdates.at(-1)}-standup-${s}.md`), 'utf8')
      .split(/\r?\n/).slice(0, 8).join('\n');
    return !head.includes('부서별 섹션 파일');
  });
  const lost = [
    ...(cur.main ? [] : ['메인 회의록 부재']),
    ...(missing.length ? [`섹션 미제출 ${missing.join('·')}(직전 세션 제출분)`] : []),
    ...(noNote.length ? [`상단 각주 없음 ${noNote.join('·')}`] : []),
  ];
  standupNote = `직전 세션(${sdates.at(-1)}) 산출물 메인 ${cur.main ? '존재' : '부재'}·섹션 ${cur.slugs.length}부 제출`
    + (lost.length ? ` — 소실 의심: ${lost.join(' / ')}` : '·이상 없음');
}

// ---- 출력 (일지 묶음 행 실측 근거 양식) ----
console.log(`${stamp} 실측: inbox/pending ${inboxNote}, ${commitNote}, console-input.md 붙여넣기 칸 ${consoleNote}, ${restNote}, ${waitNote}, ${badNote}, ${standupNote}`);
