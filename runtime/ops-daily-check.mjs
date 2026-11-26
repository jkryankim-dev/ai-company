// 두레 - 일일 실측 3종 (콘솔 무입력·inbox/pending·무인증 REST)
// 사용법: node runtime/ops-daily-check.mjs
// 출력: 테스트 일지 묶음 행 실측 근거 양식(test-journal.md 기록 규칙)과 동일 구성의 1행.
//   일지 양식 부가 항목(최종 커밋)도 함께 출력한다.
// 근거: org/proposals.md 큐 #12 채택(2026-10-07 종합) 이행 — 검증: 당일 수동 실측 결과와 대조.
// 2026-10-30 큐 #51 자체 채택(2026-10-29) 이행: '검증 대기 48시간 초과' 항 추가(아래 §5).
// 2026-11-02 큐 #32 이행(채택 2026-10-22 종합): '직전 세션 스탠드업 산출물 존재 점검' 항 추가(아래 §6).
// 2026-11-12 큐 #74③ 자체 채택 이행: '검증 대기 상태값 불일치' 항 추가(아래 §5).
// 2026-11-18 큐 #84·#85 자체 채택 이행: '종합절 오류 감지 시 판정 기한 도래 무판정 큐'·
//   '배정표↔열린 이슈 담당 불일치' 항 추가(아래 §8).
// 2026-11-18 큐 #81② 자체 채택 이행: 열린 이슈 전문 org/issues-open.md 매일 덠프(아래 §7).
// 2026-11-23 큐 #98·#99 자체 채택 이행: '마찰보고 예고 처방 미접수' 감지 항 추가(아래 §8)·
//   §5·§8 감지 그룹 전일 스냅숏 대비 무변동 압축(runtime/state/ops-daily-snap.json 보관).
// 2026-11-23 큐 #96·#97② 자체 채택 이행: '기한 미도래 무판정 큐' 나열 추가(판정칸 공란 전체를
//   1회 출력으로)·approvals #14 '직전 재상신 실행일' 경과 탐지(주 1회 규정 초과 시 — 아래 §8).
// 2026-11-23 큐 #91 자체 채택 이행: §6 섹션 파일명 정규식 슬러그부 한글 허용(개인별 섹션 파일 대응).
// 2026-11-25 큐 #108① 자체 채택 이행: §8 '규칙 3 요건 성립(기한 경과+판정칸 공란)' 태그 행 추가.
// 2026-11-26 큐 #116 자체 채택 이행: §8 '대표 전용 대기 전제 무변경 확인'(approvals #14 미병합
//   팁 증감 + APP_REPO 빈값 여부) 항 추가(아래 §8).
// 2026-11-26 큐 #117·#118 자체 채택 이행: §6 병합본 역방향(병합본 기재·원문 부재) 탐지 + 점검 대상
//   주간 병합본(allhands — 원문 주간결과 개인 파일) 확장.
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
let openList = null; // §7 덤프용 원본 목록(큐 #81②)
if (m) {
  try {
    const r = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}/issues?state=open&per_page=30`, {
      headers: { 'User-Agent': 'doore', Accept: 'application/vnd.github+json' },
    });
    if (!r.ok) restNote = `측정 불가(HTTP ${r.status})`;
    else {
      const list = (await r.json()).filter(i => !i.pull_request);
      const open = list.length;
      openList = list;
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
// ---- 5b. 감지 그룹 전일 스냅숏 대비 압축 (org/proposals.md 큐 #99, 2026-11-23) ----
// §5·§8 감지 그룹(초과·상태값 불일치·무판정·담당 불일치)을 직전 실행 스냅숏과 대비해 변화 행만
// 상세 출력하고 무변동 그룹은 '잔여 N건(무변동)' 1행으로 압축한다. 산식(초과 판정·기한 계산·대조
// 로직) 불변 — 출력 양식만. 스냅숏은 runtime/state/ops-daily-snap.json(gitignore)에 보관.
const snapFile = path.join(ROOT, 'runtime/state/ops-daily-snap.json');
const prevSnap = fs.existsSync(snapFile) ? JSON.parse(fs.readFileSync(snapFile, 'utf8')) : null;
const cmp = (label, cur, key) => {
  const prev = prevSnap && Array.isArray(prevSnap[key]) ? prevSnap[key] : null;
  if (!prev) return `${label} ${cur.length}건 — ${cur.join(' · ')}(스냅숏 기준 없음 — 큐 #99 첫 회)`;
  const added = cur.filter(x => !prev.includes(x));
  const gone = prev.filter(x => !cur.includes(x));
  const stay = cur.length - added.length;
  const parts = [];
  if (added.length) parts.push(`신규 편입 ${added.length}: ${added.join(' · ')}`);
  if (gone.length) parts.push(`해소 ${gone.length}: ${gone.join(' · ')}`);
  if (stay) parts.push(`잔여 ${stay}건(무변동)`);
  if (!parts.length) parts.push('0건(전일 대비 변화 없음)');
  return `${label} ${cur.length}건 — ${parts.join(' · ')}`;
};
const waitNote = cmp('검증 대기 48시간 초과', over, 'over');
const badNote = cmp('검증 대기 상태값 불일치(큐 #74③)', badState, 'bad');

// ---- 6. 직전 세션 스탠드업 산출물 존재 점검 (org/proposals.md 큐 #32) ----
// 직전 세션 = 금일 이전 중 스탠드업 산출물(메인·부서별 섹션)이 마지막으로 존재한 날.
// 점검: 메인 회의록 파일 · 섹션 파일 제출(기준선 = 그 직전 세션 제출 부서) · 섹션 파일 상단 각주.
// 한계: 섹션 '미제출' 탐지 단위는 부서(큐 #45 dry-run 차이 ①과 동일 한계) — 제출된 파일 내
// 개인 서브섹션의 병합본 공란은 아래 #102② 탐지로 보완한다.
const mins = path.join(ROOT, 'meetings/minutes');
// 직원 명부(가이드 §1 부서 슬러그 표 소속 9인 — org/standup-section-guide.md). 병합본의 직원
// 서브섹션 판별에 쓴다(큐 #117·#118, 2026-11-26).
const STAFF = ['김기획', '박빌드', '이빌드', '오운영', '서카피', '최감사', '정지표', '남기록', '한실장'];
const seen = {};
for (const f of fs.readdirSync(mins)) {
  const fm = f.match(/^(\d{4}-\d{2}-\d{2})-standup(?:-([a-z가-힣-]+))?\.md$/);
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
  // 큐 #102②(2026-11-23): 병합본 서브섹션 공란(원문 존재) 탐지 — 원문 섹션 파일의 개인
  // 서브섹션(## 이름)이 메인 회의록에 없으면 나열한다(가이드 §3 7번 즉시 편입 대상의 자동 탐지).
  // 2026-11-24 정정(남기록): 헤더 존재 유무만 보아 '헤더 있음·본문 공란'(2026-11-23 정지표 사례)이
  // 미탐지였다 — 서브섹션별 본문 비어 있지 않은 행 수까지 세어 0행이면 공란으로 탐지한다.
  const blank = [];
  let ghost = [];
  if (cur.main) {
    const mainBody = {};
    const mainHeads = new Set();
    let head = null;
    for (const l of fs.readFileSync(path.join(mins, `${sdates.at(-1)}-standup.md`), 'utf8').split(/\r?\n/)) {
      if (l.startsWith('## ')) { head = l.slice(3).split(/\s*[(:：]/)[0].trim(); mainHeads.add(head); }
      else if (head && l.trim()) mainBody[head] = (mainBody[head] || 0) + 1;
    }
    const filed = new Set(cur.slugs.flatMap(s =>
      fs.readFileSync(path.join(mins, `${sdates.at(-1)}-standup-${s}.md`), 'utf8')
        .split(/\r?\n/).filter(l => /^## [^\s(（:：]/.test(l))
        .map(l => l.slice(3).split(/\s*[(:：]/)[0].trim()).filter(n => n)));
    blank.push(...[...filed].filter(n => !mainBody[n]));
    // 큐 #117(2026-11-26): 병합본 역방향 오기 탐지 — 메인 회의록에 직원 서브섹션이 기재됐는데(라이브
    // digest 수집분 포함) 당일 섹션 파일(원문)에 그 서브섹션이 부재하면 나열한다. 원문 없는 수집분은
    // 실측 대조가 불가하다(2026-11-23 병합본에 8월 시점 보고가 재수록된 사례 — #102②는 역방향 공백).
    ghost = STAFF.filter(n => mainHeads.has(n) && !filed.has(n));
  }
  const lost = [
    ...(cur.main ? [] : ['메인 회의록 부재']),
    ...(missing.length ? [`섹션 미제출 ${missing.join('·')}(직전 세션 제출분)`] : []),
    ...(noNote.length ? [`상단 각주 없음 ${noNote.join('·')}`] : []),
  ];
  standupNote = `직전 세션(${sdates.at(-1)}) 산출물 메인 ${cur.main ? '존재' : '부재'}·섹션 ${cur.slugs.length}부 제출`
    + (lost.length ? ` — 소실 의심: ${lost.join(' / ')}` : '·이상 없음')
    + (cur.main ? `·병합본 공란(원문 존재) ${blank.length}건${blank.length ? ` — ${blank.join('·')}` : ''}(큐 #102②)` : '')
    + (cur.main ? `·병합본 기재·원문 부재 ${ghost.length}건${ghost.length ? ` — ${ghost.join('·')}` : ''}(내용 검증 불가 — 큐 #117)` : '');
}

// 큐 #118(2026-11-26): §6 점검 대상 확장 — 주간 단위 병합본. allhands 병합본(-allhands.md)이
// 주간결과 개인 원문(-주간결과-{이름}.md)의 병합처다(별도 '-주간결과.md' 병합 파일은 부재 —
// 2026-11-26 실측). 공란·누락(원문 존재·병합본 서브섹션 부재/본문 0행)과 역방향(#117과 동일 산식)을
// 직전 allhands에 적용한다(기록관 복구 범위 정렬 — 가이드 §3 7번·librarian.md, 큐 #82).
const ahDates = fs.readdirSync(mins)
  .map(f => f.match(/^(\d{4}-\d{2}-\d{2})-allhands\.md$/))
  .filter(Boolean).map(m => m[1]).filter(d => d < ktoday).sort();
let weeklyNote = '주간 병합본 점검 대상 부재(직전 allhands 파일 없음 — 큐 #118)';
if (ahDates.length) {
  const ad = ahDates.at(-1);
  const ahBody = {};
  const ahHeads = new Set();
  let ah = null;
  for (const l of fs.readFileSync(path.join(mins, `${ad}-allhands.md`), 'utf8').split(/\r?\n/)) {
    if (l.startsWith('## ')) { ah = l.slice(3).split(/\s*[(:：]/)[0].trim(); ahHeads.add(ah); }
    else if (ah && l.trim()) ahBody[ah] = (ahBody[ah] || 0) + 1;
  }
  const filedW = new Set(fs.readdirSync(mins)
    .map(f => f.match(new RegExp(`^${ad}-주간결과-(.+)\\.md$`)))
    .filter(Boolean).map(m => m[1]));
  const missW = STAFF.filter(n => filedW.has(n) && !(ahBody[n] > 0));
  const ghostW = STAFF.filter(n => ahHeads.has(n) && !filedW.has(n));
  weeklyNote = `주간 병합본(${ad} allhands) 점검 — 공란·누락 ${missW.length}건${missW.length ? `(${missW.join('·')})` : ''}·역방향 ${ghostW.length}건${ghostW.length ? `(${ghostW.join('·')})` : ''}(큐 #118)`;
}

// ---- 7. 열린 이슈 전문 덤프 (org/issues-open.md — 큐 #81②, 2026-11-18) ----
// 사실 확인 인용용 스냅숏(사규 2·3조 이슈 본문 열람 전제). 배정 정본은 org/assignments.md —
// 이 파일은 정본 아님(gh 쓰기 불능 기간 운용, approvals#11 대기 — 큐 #87 방향과 동일 전제).
let dumpNote = '열린 이슈 덤프 불가(REST 조회 실패 — 큐 #81②)';
if (openList) {
  const dump = [
    '# 열린 이슈 전문 (자동 덤프)',
    '',
    `- 기준 ${ktoday} ${pad(kst.getHours())}:${pad(kst.getMinutes())} KST · open ${openList.length}건 · 무인증 REST per_page=30 상한`,
    '- 사실 확인 인용용 스냅숏 — 배정 정본은 org/assignments.md (runtime/ops-daily-check.mjs §7, 큐 #81②)',
    '',
    ...openList.flatMap(i => [
      '---', '',
      `## #${i.number} ${i.title}`, '',
      `[${(i.labels || []).map(l => l.name).join(',') || '라벨 없음'}] 담당:${i.assignee?.login || '없음'}`, '',
      `${i.body || '(본문 없음)'}`, '',
    ]),
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, 'org/issues-open.md'), dump);
  dumpNote = `열린 이슈 덤프 ${openList.length}건(org/issues-open.md — 큐 #81②)`;
}

// ---- 8. 종합절 오류 감지 + 배정표↔열린 이슈 담당 불일치 (org/proposals.md 큐 #84·#85, 2026-11-18) ----
// #84: 직전 세션 병합본 '## 종합' 절에 오류(401 등)가 남아 있으면 종합 불능으로 보고하고 판정 기한
// (제출일+48시간) 도래 무판정 큐를 나열한다(운영 규칙 3 재실측 근거 — 수동 대조는 §5와 동일 몫).
// #85: 배정 정본(assignments.md 상단 표) 활성 행 담당 ↔ 열린 이슈 assignee('담당:없음' 표기) 대조.
const summSec = sdates.length
  ? (fs.readFileSync(path.join(mins, `${sdates.at(-1)}-standup.md`), 'utf8').split('## 종합')[1] || '')
  : '';
const summErr = /실패|401/.test(summSec);
const props = fs.readFileSync(path.join(ROOT, 'org/proposals.md'), 'utf8');
const dueQ = [];
for (const line of props.split(/\r?\n/)) {
  const c = line.split('|').map(s => s.trim());
  if (!/^\d+$/.test(c[1] || '') || !/^\d{4}-\d{2}-\d{2}$/.test(c[5] || '') || c[6]) continue;
  if (ktoday >= c[5]) dueQ.push(`#${c[1]}`);
}
// 큐 #96(2026-11-23): 기한 미도래 무판정 행(번호·기한)도 나열해 판정칸 공란 전체를 1회 출력으로
// 제공(일일 수동 보충 폐지 — analyst.md 2026-11-20 조항의 출력 원천).
const pendQ = [];
for (const line of props.split(/\r?\n/)) {
  const c = line.split('|').map(s => s.trim());
  if (!/^\d+$/.test(c[1] || '') || !/^\d{4}-\d{2}-\d{2}$/.test(c[5] || '') || c[6]) continue;
  if (ktoday < c[5]) pendQ.push(`#${c[1]}(기한 ${c[5].slice(5)})`);
}
// 큐 #97②(2026-11-23): approvals #14 상주 표기 '직전 재상신 실행일'(#97①) 경과 탐지 — 주 1회
// 규정(7일) 초과 시 1행. 표기 부재도 1행으로 드러낸다(원천 결측 감지 — ops-env.md §4 '0건=경로 의심' 준용).
const rm = fs.readFileSync(path.join(ROOT, 'org/approvals.md'), 'utf8')
  .match(/직전 재상신 실행일: (\d{4}-\d{2}-\d{2})/);
let resentNote;
if (!rm) resentNote = `직전 재상신 실행일 표기 부재(approvals #14 — 큐 #97②)`;
else {
  const days = Math.round((Date.parse(`${ktoday}T00:00:00Z`) - Date.parse(`${rm[1]}T00:00:00Z`)) / 86400e3);
  resentNote = days > 7
    ? `직전 묶음 재상신 실행일(${rm[1]}) 경과 ${days}일 — 주 1회 규정 초과(큐 #97②)`
    : `직전 재상신 실행일 ${rm[1]}(${days}일 — 규정 내, 큐 #97②)`;
}
const synthNote = (sdates.length ? `직전 종합절(${sdates.at(-1)}) ` : '직전 종합절 부재 ')
  + (summErr ? '오류 감지 — 종합 불능' : '오류 없음')
  + `, ` + cmp(`판정 기한 도래 무판정 큐`, dueQ, 'dueQ')
  + `, ` + cmp(`기한 미도래 무판정 큐`, pendQ, 'pendQ')
  + `, ${resentNote}`;
// 큐 #108①(2026-11-25): '규칙 3 요건 성립(기한 경과+판정칸 공란)' 태그 — dueQ 집합을 자체 채택
// 발동 요건 관점으로 상시 노출한다(종합절 오류 유무와 무관 — #84는 오류 감지 조건부 나열).
// 제출자 발견까지 1~2일 걸리던 규칙 3 발동 지연 처방(2026-11-20 마찰보고 마찰 2).
const rule3Note = dueQ.length
  ? `규칙 3 요건 성립(기한 경과+판정칸 공란) ${dueQ.length}건(${dueQ.join('·')}) — 자체 채택 발동 대상(큐 #108①)`
  : `규칙 3 요건 성립 0건(큐 #108①)`;
// 큐 #116(2026-11-26): '대표 전용 대기 전제 무변경 확인' — approvals #14 등록 팁 대비 미병합
// 증감(행 파싱+merge-base)·APP_REPO 빈값 여부를 매일 자동 실측한다. 근거: 대기 전제 4종(QA 판정·
// APP_REPO·미병합 스택·401)을 매 세션 수동 재실측하는 비용이 값 무변경과 무관하게 상수인 문제
// (2026-11-20-마찰보고-박빌드.md 마찰 3 — 사규 10조). #112(무변동 전제 '소비' 인용)의 원천 출력,
// #92(팁 등록 '의무')와 상이 — 본 행은 등록부 '관찰' 자동화. 파싱 실패·0건도 1행으로 드러낸다
// (ops-env.md §4 '0건=경로 의심' 준용).
const tipRow = fs.readFileSync(path.join(ROOT, 'org/approvals.md'), 'utf8')
  .split(/\r?\n/).find(l => /^\|\s*14\s*\|/.test(l)) || '';
const tipM = tipRow.match(/미병합 (\d+)팁\(([^)]*)\)/);
const tipDecl = tipM ? parseInt(tipM[1], 10) : 0;
// 토큰별 첫 필드만 취한다 — 팁 목록 뒤 주석(', 최장 … — main(…')이 같은 토큰에 붙는 경우(중첩 괄호로
// [^)]* 가 닫는 괄호 앞에서 끊김) 대비. 11/26 실측: 이 가드 없으면 e02e4b5 1팁이 탈락해 7건으로 소진.
const tips = tipM
  ? tipM[2].split('·').map(s => s.trim().split(/[\s,]/)[0]).filter(s => /^[0-9a-f]{7,40}$/.test(s))
  : [];
const unmerged = tips.filter(h => {
  try { execSync(`git merge-base --is-ancestor ${h} HEAD`, GIT_OPT); return false; }
  catch { return true; } // 비종료(미병합)·해시 소실 모두 '미병합'으로 센다
});
let tipNote;
if (!tipM) tipNote = '#14 미병합 팁 행 파싱 불가(형식 변경 의심 — ops-env.md §4 준용)';
else if (tips.length !== tipDecl) tipNote = `#14 미병합 팁 파싱 ${tips.length}건(행 표기 ${tipDecl}팁과 불일치 — 중첩 괄호 등 형식 변경 의심 — ops-env.md §4 준용)`;
else tipNote = cmp(`#14 미병합 팁(등록 ${tips.length} 중 미병합 ${unmerged.length})`, unmerged, 'unmergedTips');
const appRepoNote = env.APP_REPO
  ? 'APP_REPO 값 설정(전제 해소 — 착수 가능)'
  : 'APP_REPO 빈값(무변경)';
const premiseNote = `대표 전용 대기 전제 무변경 확인 — ${tipNote}, ${appRepoNote}(큐 #116)`;
const assignByN = {}; // 상단 배정 표만 — '## ' 절(검증 대기 등) 도달 시 중단, 분할 행은 활성 행 우선
for (const line of asg.split(/\r?\n/)) {
  if (line.startsWith('## ')) break;
  const c = line.split('|').map(s => s.trim());
  const nm = (c[1] || '').match(/^#(\d+)/);
  if (!nm) continue;
  // 종결 판정은 행 단위 표식만: 완료 조건 칼럼 선두 '종결 —' 또는 상태칸 '종료 처리 승인'.
  // (#8처럼 칼럼 본문에 '하위(1) 종결' 서술이 있는 활성 행의 오탐지 방지 — 11/18 수동 대차 정정)
  const closed = /^종결/.test(c[3] || '') || /종료 처리/.test(c[4] || '');
  if (!assignByN[nm[1]] || (assignByN[nm[1]].closed && !closed)) {
    assignByN[nm[1]] = closed ? { closed } : { name: c[2] || '(담당 공란)', closed };
  }
}
const mismatch = [];
if (openList) {
  for (const g of openList) {
    if (g.assignee) continue; // assignee 있음 — gh 쓰기 확보 전제가 깨져 대상 아님
    const a = assignByN[String(g.number)];
    if (!a) mismatch.push(`#${g.number} 정본 행 부재↔open`);
    else if (a.closed) mismatch.push(`#${g.number} 정본 종결↔open·담당:없음`);
    else mismatch.push(`#${g.number} 정본 ${a.name}↔담당:없음`);
  }
}
const assignNote = openList
  ? cmp(`배정표↔열린 이슈 담당 불일치(큐 #85)`, mismatch, 'mismatch')
  : '배정표↔열린 이슈 담당 불일치 측정 불가(REST 조회 실패 — 큐 #85)';

// ---- 8b. 마찰보고·주간결과 '다음 세션 큐 접수' 예고 미접수 감지 (org/proposals.md 큐 #98, 2026-11-23) ----
// 직전 영업일(두 보고서 유형 파일이 존재하는 직전 날짜) 보고서에 '(차기|다음|M/D) 세션 … 접수' 예고가
// 있는데 금일 proposals 갱신 로그에 해당 제출자의 접수 행이 없으면 미접수로 출력한다(세션 프롬프트·
// 회고 가동과 무관하게 매 영업일 발동 — #3 상시 루틴에 실린 장치). 예고 판별: 행내 '미접수' 표기
// (#67① 처방 규격 준용 — 제목·인용문의 '다음 세션 큐 접수' 언급은 제외) + '세션' 뒤 6자 이내 '접수'.
// 과거 공약 인용("차기 세션(11/17) 큐 접수한다"(같은 파일:196) 식)은 세션 뒤 날짜 괄호로 6자 초과라
// 제외된다. 한계: 줄바꿈에 걸린 예고 미탐지·병렬 세션 진행 중 인원은 측정 시점 기준 미접수로 출력.
const rptByDate = {};
for (const f of fs.readdirSync(mins)) {
  const rm = f.match(/^(\d{4}-\d{2}-\d{2})-(?:마찰보고|주간결과)-(.+)\.md$/);
  if (!rm || rm[1] >= ktoday) continue;
  (rptByDate[rm[1]] ??= []).push({ who: rm[2].replace(/\.md$/, ''), file: f });
}
const rdates = Object.keys(rptByDate).sort();
let promiseNote;
if (!rdates.length) promiseNote = '마찰보고 예고 미접수 측정 불가(보고서 파일 부재 — 큐 #98)';
else {
  const rd = rdates.at(-1);
  const logToday = props.split(/\r?\n/).filter(l => l.includes(`, ${ktoday} —`) && l.includes('접수'));
  const missWho = [];
  for (const { who, file } of rptByDate[rd]) {
    const promised = fs.readFileSync(path.join(mins, file), 'utf8').split(/\r?\n/).some(l =>
      l.includes('미접수') && /(?:차기|다음|\d{1,2}\/\d{1,2})\s*세션.{0,6}접수/.test(l)
      && !/같은 파일:\d+/.test(l));
    if (promised && !logToday.some(l => l.includes(`갱신: ${who},`))) missWho.push(who);
  }
  promiseNote = missWho.length
    ? `마찰보고 예고 처방 미접수 ${missWho.length}건(${rd} 보고 — ${missWho.join('·')})(큐 #98)`
    : `마찰보고 예고 처방 미접수 0건(${rd} 보고 기준 — 큐 #98)`;
}

// ---- 출력 (일지 묶음 행 실측 근거 양식) + 스냅숏 기록(큐 #99) ----
fs.writeFileSync(snapFile, JSON.stringify({
  date: ktoday,
  over, bad: badState, dueQ, pendQ, unmergedTips: unmerged,
  // REST 실패 시 mismatch=[]는 측정 부재 — 스냅숏은 직전 실측값을 유지(다음 실행 대비 보존)
  mismatch: openList ? mismatch : (prevSnap && Array.isArray(prevSnap.mismatch) ? prevSnap.mismatch : []),
}));
console.log(`${stamp} 실측: inbox/pending ${inboxNote}, ${commitNote}, console-input.md 붙여넣기 칸 ${consoleNote}, ${restNote}, ${waitNote}, ${badNote}, ${standupNote}, ${weeklyNote}, ${dumpNote}, ${synthNote}, ${rule3Note}, ${assignNote}, ${premiseNote}, ${promiseNote}`);
