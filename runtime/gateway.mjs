// 대표의 말을 듣는 귀. #대표실 을 지켜보다가 지시를 접수한다.
// REST 폴링 방식 — 재접속 로직이 필요 없고 의존성도 없다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { env, loadOrg, systemFor, log, p, today, readState, saveState } from './lib/core.mjs';
import { ask } from './lib/engine.mjs';
import { say } from './lib/discord.mjs';

const API = 'https://discord.com/api/v10';
const h = () => ({ Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' });
const WATCH = '대표실';
const POLL_MS = 4000;

const staff = loadOrg();
const boss  = staff.find(s => s.id === 'chief_of_staff');
const pm    = staff.find(s => s.id === 'pm');

let chanId = null;
async function channelId() {
  if (chanId) return chanId;
  const r = await fetch(`${API}/guilds/${env.DISCORD_GUILD_ID}/channels`, { headers: h() });
  const c = (await r.json()).find(c => c.type === 0 && c.name === WATCH);
  if (!c) throw new Error(`#${WATCH} 채널을 찾을 수 없음`);
  chanId = c.id;
  return chanId;
}

const HELP = `**두레 지시 방법**
\`!지시 <내용>\` — 김기획이 실행 가능한 업무 지시서(이슈 초안)로 만들어 #기획에 올립니다
\`!회의\` — 지금 즉시 스탠드업 소집 (\`!회의 전사\`, \`!회의 회고\` 도 가능)
\`!상태\` — 오늘 회의가 열렸는지, 회의록이 쌓였는지 확인
\`!도움\` — 이 안내

명령어 없이 그냥 말을 걸면 한실장이 답합니다.`;

function runMeeting(kind, label) {
  const c = spawn('node', ['runtime/meeting.mjs', kind], { shell: true, stdio: 'inherit', cwd: p() });
  c.on('close', code => log(`${label} 종료 (code ${code})`));
}

async function handle(text) {
  const t = text.trim();

  if (/^!도움/.test(t)) return say(WATCH, boss, HELP);

  if (/^!회의/.test(t)) {
    const arg = t.replace(/^!회의\s*/, '');
    const kind  = /전사/.test(arg) ? 'allhands' : /회고/.test(arg) ? 'retro' : 'standup';
    const label = kind === 'allhands' ? '전사회의' : kind === 'retro' ? '회고' : '스탠드업';
    await say(WATCH, boss, `${label}를 지금 소집합니다. 결과는 #전사공지에 올라갑니다.`);
    runMeeting(kind, label);
    return;
  }

  if (/^!상태/.test(t)) {
    let list = [];
    try { list = fs.readdirSync(p('meetings', 'minutes')).filter(f => f.startsWith(today())); } catch {}
    return say(WATCH, boss,
      `**오늘(${today()}) 현황**\n` +
      (list.length ? `열린 회의: ${list.map(f => f.replace(today() + '-', '').replace('.md', '')).join(', ')}` : '오늘 아직 열린 회의 없음') +
      `\n누적 회의록: ${(() => { try { return fs.readdirSync(p('meetings','minutes')).length; } catch { return 0; } })()}건`);
  }

  if (/^!지시/.test(t)) {
    const body = t.replace(/^!지시\s*/, '');
    if (!body) return say(WATCH, boss, '무엇을 지시하실지 내용을 함께 적어주세요. 예: `!지시 온보딩에 게스트 모드 추가`');
    await say(WATCH, boss, '김기획에게 넘겼습니다.');
    const r = await ask(pm, systemFor(pm),
      `대표의 지시다:\n\n"${body}"\n\n이것을 사규 3조 형식의 GitHub Issue 초안으로 만들어라.
지시가 한 건 이상으로 쪼개져야 하면 여러 개로 나눠라. 하나는 반나절 분량.
각 이슈마다: 제목 / 목적 / 완료 조건 / 검증 방법 / 담당 제안.
지시가 모호해서 완료 조건을 못 쓰겠으면 이슈를 만들지 말고 대표에게 되물을 질문을 적어라.`);
    if (r.ok) { await say('기획', pm, r.text); await say(WATCH, pm, '#기획에 이슈 초안을 올렸습니다. 확인 후 승인해주세요.'); }
    else await say(WATCH, pm, `처리 실패: ${r.error}`);
    return;
  }

  // 명령어가 아니면 한실장에게
  const r = await ask(boss, systemFor(boss),
    `대표가 말했다:\n\n"${t}"\n\n비서실장으로서 답하라. 실무를 직접 하지 말고, 필요하면 어느 직원에게 무엇을 시킬지 제안하라. 10줄 이내.`);
  await say(WATCH, boss, r.ok ? r.text : `응답 실패: ${r.error}`);
}

// --- 폴링 루프 ---
const id = await channelId();
let last = readState('gateway.json', {})?.lastId || null;
if (!last) {
  const r = await fetch(`${API}/channels/${id}/messages?limit=1`, { headers: h() });
  last = (await r.json())[0]?.id || null;
  saveState('gateway.json', { lastId: last });
}
log(`#${WATCH} 청취 시작. \`!도움\` 으로 사용법 확인.`);
await say(WATCH, boss, `대표실 대기 중입니다.\n\n${HELP}`);

setInterval(async () => {
  try {
    const url = `${API}/channels/${id}/messages?limit=10` + (last ? `&after=${last}` : '');
    const r = await fetch(url, { headers: h() });
    if (!r.ok) return;
    const msgs = (await r.json()).reverse();
    for (const m of msgs) {
      last = m.id;
      saveState('gateway.json', { lastId: last });
      if (m.author?.bot || m.webhook_id || !m.content?.trim()) continue;
      log(`지시 접수: ${m.content.slice(0, 60)}`);
      await handle(m.content);
    }
  } catch (e) { log('폴링 오류: ' + e.message); }
}, POLL_MS);
