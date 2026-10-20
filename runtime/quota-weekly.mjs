#!/usr/bin/env node
// 주간 쿼터 집계 스크립트 (큐 #27 — 2026-10-19 채택, 2026-10-20 이행: 정지표)
// weekly.json quota 몫(주간 세션 수·직원별 호출 수·기준선 대비)의 마감 수작업 대체.
//
// 원천: runtime/logs/scheduler.log — 각 세션 '…시작 (YYYY-MM-DD)' 행 아래 종료 시
//   '…완료. 호출 사용량: {"직원키":호출수,…}' 행(runtime/meeting.mjs:106). JSON 행에 날짜가
//   없어 직전 '시작' 행의 날짜에 귀속한다. '완료' 행이 없는 진행 중 세션은 제외(확정분만 집계).
// 사용법: node runtime/quota-weekly.mjs <시작일> <종료일>  (YYYY-MM-DD, 종료일 포함)
// 검증(이행 시): W8 수동 실측분(세션 6회·직원당 6호출·전체 54, weekly.json quota 노트
//   2026-10-12문)과 대조 — 2026-10-20 일치 확인.
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
