// 회의 실행기.  사용법: node runtime/meeting.mjs standup | allhands | retro
import fs from 'node:fs';
import { loadOrg, systemFor, log, p, today, env } from './lib/core.mjs';
import { ask, usage } from './lib/engine.mjs';
import { say, announce } from './lib/discord.mjs';

const KIND = process.argv[2] || 'standup';

const SPEC = {
  standup: {
    title: '데일리 스탠드업',
    collect: `담당 중인 일의 상태를 확인하고 스탠드업 보고를 작성하라.
형식은 사규 5조를 따른다 (어제 / 오늘 / 블로커, 각 1줄).
아직 배정된 이슈가 없으면 "오늘"에 네가 먼저 시작할 수 있는 일을 스스로 제안하라.
3줄을 넘기지 마라.`,
    digest: `오늘자 스탠드업 보고다.
1) 오늘 회사 전체가 무엇을 하는지 5줄 요약
2) 24시간 넘은 블로커 표시
3) 충돌하거나 중복된 작업 지적
4) 대표 승인이 필요한 항목 (없으면 "없음")
원본을 옮기지 말고 압축하라. 12줄 이내.`,
  },
  allhands: {
    title: '주간 전사회의',
    collect: `지난 7일간의 결과를 정리하라.
형식:
완료: (한 줄씩)
미완: (이유 포함)
이번 주 제안: (2개, 각 한 줄)
필요한 결정: (다른 부서나 대표의 결정이 필요한 것)
변명을 쓰지 마라. 안 된 것은 안 됐다고 쓴다.`,
    digest: `지난주 부서별 보고다.
이번 주 우선순위 3개를 정하고, **하지 않을 일**도 명시하라.
부서 간 요청이 충돌하는 지점을 반드시 찾아내라.
대표 브리핑 형식으로 15줄 이내.`,
  },
  retro: {
    title: '스프린트 회고',
    collect: `이번 주 네가 겪은 마찰을 3개 이하로 적어라.
사람(대표)을 탓하지 말고 프로세스를 지목하라.
형식: 무슨 일이 있었나 / 왜 막혔나 / 무엇을 바꾸면 되나
잘된 일은 쓰지 마라.`,
    digest: `이번 주 수집된 마찰이다.
다음 중 하나로 결론지어라.
A) 사규 조항 추가·수정 — 구체적 문구 제시
B) 이슈 템플릿·회의 스크립트 수정
C) 조치 불필요 — 이유 명시
개정안은 최대 2건. 매주 사규가 늘어나면 아무도 안 읽는다.`,
  },
};

const spec = SPEC[KIND];
if (!spec) { console.error(`알 수 없는 회의: ${KIND}`); process.exit(1); }

// --- 회사 현황 (GitHub 이슈) ---
async function context() {
  const m = (env.GITHUB_REPO || '').match(/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (!m) return '(레포 정보 없음)';
  try {
    const r = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}/issues?state=open&per_page=30`, {
      headers: { 'User-Agent': 'doore', Accept: 'application/vnd.github+json' },
    });
    if (!r.ok) return '(이슈 조회 불가 — private 레포이거나 인증 필요)';
    const issues = (await r.json()).filter(i => !i.pull_request);
    if (!issues.length) return '(열린 이슈 없음 — 아직 배정된 일이 없다)';
    return issues.map(i => `#${i.number} ${i.title} [${(i.labels || []).map(l => l.name).join(',')}] 담당:${i.assignee?.login || '없음'}`).join('\n');
  } catch { return '(이슈 조회 실패)'; }
}

const staff = loadOrg();
const boss  = staff.find(s => s.id === 'chief_of_staff');
const crew  = staff.filter(s => s.id !== 'chief_of_staff');
const ctx   = await context();

log(`${spec.title} 시작 (${today()})`);

// 1단계 — 수집 (병렬, 서로의 답을 보지 않는다)
const reports = await Promise.all(crew.map(async s => {
  const r = await ask(s, systemFor(s), `# 현재 열린 이슈\n${ctx}\n\n# 사실 확인 의무\n답하기 전에 관련 파일을 직접 읽어라 (사규 12조). 수치는 저장소의 실측값을 쓰고 출처를 밝혀라.\n\n# 지시\n${spec.collect}`);
  return { s, text: r.text, ok: r.ok };
}));
const ok = reports.filter(r => r.ok);

for (const r of ok) await say(KIND === 'standup' ? '스탠드업' : '전사공지', r.s, r.text);

// 중단 조건 — 3명 이상 실패하면 종합을 건너뛴다 (쿼터 낭비 방지)
if (reports.length - ok.length >= 3) {
  await announce('전사공지', `⚠️ ${spec.title} 중단 — 직원 ${reports.length - ok.length}명 응답 실패. 종합 단계를 건너뜁니다.`);
  process.exit(1);
}

// 2단계 — 종합 (Claude 1회)
const digest = ok.map(r => `## ${r.s.name} (${r.s.title})\n${r.text}`).join('\n\n');
const sum = await ask(boss, systemFor(boss), `# ${spec.title}\n\n${digest}\n\n# 지시\n${spec.digest}`);

if (sum.ok) {
  await say('전사공지', boss, `**${spec.title} 종합 (${today()})**\n${sum.text}`);
  if (/승인|결정 필요|대표/.test(sum.text)) await say('대표실', boss, `**${spec.title}에서 올라온 건**\n${sum.text}`);
}

// 3단계 — 기록
fs.mkdirSync(p('meetings', 'minutes'), { recursive: true });
fs.writeFileSync(p('meetings', 'minutes', `${today()}-${KIND}.md`),
  `# ${spec.title} (${today()})\n\n## 현황\n\`\`\`\n${ctx}\n\`\`\`\n\n## 부서별 보고\n\n${digest}\n\n## 종합\n\n${sum.ok ? sum.text : '(실패: ' + sum.error + ')'}\n`);

log('완료. 호출 사용량:', JSON.stringify(usage()));
