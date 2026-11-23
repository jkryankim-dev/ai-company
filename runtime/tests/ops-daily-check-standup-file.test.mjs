// 큐 #91 자체 채택 이행(2026-11-23): ops-daily-check.mjs §6 섹션 파일명 정규식이 개인별
// 섹션 파일(가이드 §1, 큐 #80 — standup-{부서}-{이름}.md, 이름 한글)의 슬러그부를 매칭하는지
// 검증한다. 스크립트는 import 시 전체 실행되는 구조라 소스에서 정규식 리터럴을 추출해 실측한다
// (소스 텍스트 검증 — feat/23 runtime/tests/meeting-section-merge.test.mjs 방식 준용).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../ops-daily-check.mjs', import.meta.url), 'utf8');
const line = src.split(/\r?\n/).find(l => l.includes('standup(?:-'));
assert.ok(line, '§6 파일명 정규식(standup(?:-) 행이 소스에 있어야 한다');
const re = new RegExp(line.slice(line.indexOf('/') + 1, line.lastIndexOf('/')));

test('§6 정규식: 메인 회의록·부서 섹션 파일 기존 매칭 유지 (회귀 방지)', () => {
  const main = re.exec('2026-11-21-standup.md');
  assert.ok(main, '메인 회의록 파일 매칭 필요');
  assert.equal(main[2], undefined);
  const dept = re.exec('2026-11-21-standup-dev.md');
  assert.ok(dept, '부서 섹션 파일 매칭 필요');
  assert.equal(dept[2], 'dev');
});

test('§6 정규식: 개인별 섹션 파일 한글 슬러그 매칭 (큐 #91 본체)', () => {
  assert.equal(re.exec('2026-11-23-standup-dev-이빌드.md')?.[2], 'dev-이빌드');
  assert.equal(re.exec('2026-11-23-standup-ops-오운영.md')?.[2], 'ops-오운영');
});

test('§6 정규식: 비대상 파일 미매칭', () => {
  assert.equal(re.test('2026-11-23-standup-dev-이빌드.txt'), false);
  assert.equal(re.test('2026-11-23-마찰보고-이빌드.md'), false);
});
