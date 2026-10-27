#!/usr/bin/env node
// 주간 쿼터 집계 스크립트 (큐 #27 — 2026-10-19 채택, 2026-10-20 이행: 정지표)
// weekly.json quota 몫(주간 세션 수·직원별 호출 수·기준선 대비)의 마감 수작업 대체.
// 2026-10-22 확장(큐 #37 — 2026-10-21 채택 이행): 대표 전용 대기 항목 경과일 산출 추가.
//   원천 org/approvals.md 표 — 실행주체 '대표 전용'·상태 '대기' 행의 최초 상신일(복수일 때
//   최소값, #12 '2026-08-19(구 #1)·2026-08-26(구 #7)' 방식)에서 종료일 인자까지의 일수.
//   approvals 표 '대기' 열(2026-10-27 ADR 0010 이행으로 폐지 — 폐지 전 값도 미갱신 과거값이었다)을
//   대체하는 재계산값이다. 칼럼 폐지에 맞춰 파서 열 위치를 조정했다(2026-10-27 남기록).
//
// 원천: runtime/logs/scheduler.log — 각 세션 '…시작 (YYYY-MM-DD)' 행 아래 종료 시
//   '…완료. 호출 사용량: {"직원키":호출수,…}' 행(runtime/meeting.mjs:106). JSON 행에 날짜가
//   없어 직전 '시작' 행의 날짜에 귀속한다. '완료' 행이 없는 진행 중 세션은 제외(확정분만 집계).
// 사용법: node runtime/quota-weekly.mjs <시작일> <종료일>  (YYYY-MM-DD, 종료일 포함)
// 검증(이행 시): W8 수동 실측분(세션 6회·직원당 6호출·전체 54, weekly.json quota 노트
//   2026-10-12문)과 대조 — 2026-10-20 일치 확인. 경과일 몫은 10/19 수작업값(weekly.json
//   ceo_interventions_note·#37 안건칸: 콘솔값 61일·APP_REPO 61일·토큰 28일)과 대조 —
//   2026-10-22 일치 확인.
// 실행 경로 전제: /opt/doore main 체크아웃(runtime/docs/ops-env.md §4 — 결과 0건은 경로 오류 의심).

import { readFileSync } from 'node:fs';

const [start, end] = process.argv.slice(2);
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRe.test(start ?? '') || !dateRe.test(end ?? '') || start > end) {
  console.error('사용법: node runtime/quota-weekly.mjs <시작일 YYYY-MM-DD> <종료일 YYYY-MM-DD> (종료일 포함)');
  process.exit(1);
}

const logPath = new URL('./logs/scheduler.log', import.meta.url);
const lines = readFileSync(logPath, 'utf8').split('\n');

const sessions = [];
let current = null;
for (const line of lines) {
  const s = line.match(/\] (.+?) 시작 \((\d{4}-\d{2}-\d{2})\)\s*$/);
  if (s) {
    current = { date: s[2], type: s[1].trim() };
    continue;
  }
  const c = line.match(/완료\. 호출 사용량: (\{.*\})/);
  if (c && current) {
    sessions.push({ ...current, calls: JSON.parse(c[1]) });
    current = null;
  }
}

const week = sessions.filter((x) => x.date >= start && x.date <= end);
const perEmployee = {};
for (const x of week) {
  for (const [who, n] of Object.entries(x.calls)) perEmployee[who] = (perEmployee[who] ?? 0) + n;
}
const employees = Object.keys(perEmployee).length;
const counts = Object.values(perEmployee);
const uniform = counts.length > 0 && counts.every((v) => v === counts[0]);
const total = counts.reduce((a, b) => a + b, 0);
const baseline = employees * 7; // 주 7세션 전제 기준선(metrics/quota-increment-note.md)

console.log(`집계 범위: ${start} ~ ${end} (weekly.json quota 몫 기입 양식)`);
console.log(`sessions_completed: ${week.length}`);
console.log(`session_calls_per_employee: ${uniform ? counts[0] : '비균일(상세 참조)'}`);
console.log(`employees: ${employees}`);
console.log(`total_calls: ${total}`);
console.log(`기준선 대비: ${total - baseline} (기준선 ${baseline} = 직원 ${employees} × 주 7세션 — metrics/quota-increment-note.md)`);
if (!uniform) console.log(`직원별 상세: ${JSON.stringify(perEmployee)}`);
console.log('세션 목록:');
for (const x of week) console.log(`  ${x.date} ${x.type}`);
if (week.length === 0) console.log('  (범위 내 완료 세션 없음)');

// 대표 전용 대기 경과일 (큐 #37 — 원천 org/approvals.md, 기준일 = 종료일 인자)
const approvalsPath = new URL('../org/approvals.md', import.meta.url);
const rows = readFileSync(approvalsPath, 'utf8').split('\n');
const day = (d) => Math.round((Date.parse(d) - Date.parse(end)) / 86400000);
console.log(`대표 전용 대기 경과일 (원천: org/approvals.md 최초 상신일, 기준일 ${end}):`);
let waiting = 0;
for (const line of rows) {
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length < 7 || !/^\d+$/.test(cells[1])) continue;
  const [id, item, firstAsked, owner, actor, status] = cells.slice(1, 7);
  if (actor !== '대표 전용' || !status.startsWith('대기')) continue;
  const dates = firstAsked.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  if (dates.length === 0) continue; // 상신일 파싱 불능 행은 원천 결함 — 수작업 대조 대상
  const oldest = dates.sort()[0];
  if (oldest > end) continue; // 기준일 이후 상신 행 — 그 시점엔 대기 항목이 아니었다
  waiting += 1;
  const label = item.replace(/\s+/g, ' ').slice(0, 40);
  console.log(`  #${id} ${label}: ${-day(oldest)}일 (${oldest} 상신, 당번 ${owner})`);
}
if (waiting === 0) console.log('  (대표 전용 대기 행 없음 — approvals.md 상태·실행주체 열 확인)');
