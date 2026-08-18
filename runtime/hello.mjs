// 두레 첫 출근일. 전 직원이 자기 자리를 확인하고 대표에게 인사한다.
import fs from 'node:fs';
import { loadOrg, systemFor, log, p, today } from './lib/core.mjs';
import { ask, usage } from './lib/engine.mjs';
import { say, announce } from './lib/discord.mjs';

const staff = loadOrg();
const boss  = staff.find(s => s.id === 'chief_of_staff');
const crew  = staff.filter(s => s.id !== 'chief_of_staff');

log(`두레 첫 출근 — 직원 ${staff.length}명`);
await announce('전사공지', `**두레 개소**\n오늘부터 회사가 가동됩니다. 직원 ${staff.length}명이 출근합니다. (${today()})`);

// 1) 전 직원 자기소개 (병렬)
log('1단계 — 자기소개 수집');
const intros = await Promise.all(crew.map(async s => {
  const r = await ask(s, systemFor(s),
    `오늘은 두레의 첫 출근일이다. 대표에게 하는 첫 인사를 작성하라.
형식:
1줄 - 내가 이 회사에서 책임지는 것
1줄 - 내가 절대 하지 않을 것 (인사기록카드의 금지 조항 중 가장 중요한 것)
1줄 - 대표에게 지금 당장 필요한 정보 하나 (질문 형태)
총 3줄. 인사말이나 이모지 없이 바로 본론.`);
  return { s, text: r.text, ok: r.ok };
}));

for (const { s, text, ok } of intros) {
  if (ok) await say('스탠드업', s, text);
}

// 2) 비서실장 종합 (Claude 1회)
log('2단계 — 비서실장 종합');
const digest = intros.filter(i => i.ok).map(i => `## ${i.s.name} (${i.s.title})\n${i.text}`).join('\n\n');
const brief = await ask(boss, systemFor(boss),
  `오늘은 두레의 첫 출근일이다. 아래는 전 직원의 첫 인사다.

${digest}

대표 브리핑을 작성하라. 인사기록카드의 출력 형식을 따르되 첫날에 맞게 조정한다.
- 직원들이 던진 질문 중 대표가 지금 답해야 할 것 2~3개로 추려라 (중복 제거)
- 회사가 아직 갖추지 못한 것 중 가장 시급한 것 하나를 지목하라
- 이번 주에 시작할 일 3개를 제안하라
전체 15줄 이내. 원문을 옮기지 말고 압축하라.`);

if (brief.ok) {
  await say('전사공지', boss, brief.text);
  await say('대표실', boss, `**첫날 브리핑**\n${brief.text}`);
  fs.mkdirSync(p('meetings', 'minutes'), { recursive: true });
  fs.writeFileSync(p('meetings', 'minutes', `${today()}-개소.md`),
    `# 두레 개소 (${today()})\n\n## 전 직원 첫 인사\n\n${digest}\n\n## 비서실장 브리핑\n\n${brief.text}\n`);
}

log('완료. 호출 사용량:', JSON.stringify(usage()));
