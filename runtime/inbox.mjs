// 지시함 워커. 본사가 git 으로 넣은 지시를 집어 실행한다.
import fs from 'node:fs';
import path from 'node:path';
import { loadOrg, systemFor, log, p, today } from './lib/core.mjs';
import { ask } from './lib/engine.mjs';
import { say, announce } from './lib/discord.mjs';

const PEND = p('inbox', 'pending');
const DONE = p('inbox', 'done');
fs.mkdirSync(PEND, { recursive: true });
fs.mkdirSync(DONE, { recursive: true });

const staff = loadOrg();
const boss  = staff.find(s => s.id === 'chief_of_staff');
const roster = staff.filter(x => x.id !== 'chief_of_staff')
  .map(x => `${x.id} = ${x.name} (${x.title})`).join('\n');

let busy = false;

async function processOne(file) {
  const text = fs.readFileSync(path.join(PEND, file), 'utf8').trim();
  log(`지시 접수: ${file}`);
  await announce('대표실', `📥 **본사 지시 접수** — ${file.replace(/\.md$/, '')}`);

  const r = await ask(boss, systemFor(boss),
    `본사에서 대표의 지시가 내려왔다.\n\n# 지시 전문\n${text}\n\n비서실장으로서 처리하라. 답하기 전에 관련 파일을 읽어 사실을 확인하라 (사규 12조).
실무를 직접 하지 마라. 10줄 이내로 판단을 적어라.

# 직원 명단
${roster}

# 위임 방법 (중요)
실무가 필요하면 답 맨 끝에 아래 블록을 붙여라. 블록이 있어야 해당 직원이 실제로 즉시 일한다.
[위임]
pm: (할 일. 완료 조건 포함)
[/위임]
위임할 것이 없으면 블록 생략. 존재하지 않는 id 금지.`);

  const results = [];
  if (r.ok) {
    const m = r.text.match(/\[위임\]([\s\S]*?)\[\/위임\]/);
    const visible = r.text.replace(/\[위임\][\s\S]*?\[\/위임\]/, '').trim();
    await say('대표실', boss, visible);
    results.push(`## 한실장 판단\n${visible}`);

    if (m) {
      const orders = m[1].split('\n').map(line => {
        const i = line.indexOf(':');
        if (i < 0) return null;
        const id = line.slice(0, i).trim().replace(/^[-*\s]+/, '');
        const task = line.slice(i + 1).trim();
        const who = staff.find(x => x.id === id);
        return who && task ? { who, task } : null;
      }).filter(Boolean);

      if (orders.length) {
        await say('대표실', boss, `위임: ${orders.map(o => o.who.name).join(', ')} — 착수.`);
        await Promise.all(orders.map(async ({ who, task }) => {
          const res = await ask(who, systemFor(who),
            `본사 지시가 너에게 위임됐다.\n\n# 지시 원문\n${text}\n\n# 너의 몫\n${task}\n\n관련 파일을 직접 읽고 (사규 12조), 실제로 할 수 있는 일은 실제로 하라. 결과와 증거를 보고하라.`);
          const ch = (Array.isArray(who.channels) && who.channels[0]) || '전사공지';
          if (res.ok) { await say(ch, who, res.text); results.push(`## ${who.name} 결과 (#${ch})\n${res.text}`); }
          else results.push(`## ${who.name} — 실패: ${res.error}`);
        }));
      }
    }
  } else {
    results.push(`## 실패\n${r.error}`);
    await announce('대표실', `⚠️ 지시 처리 실패: ${r.error}`);
  }

  fs.writeFileSync(path.join(DONE, file),
    `# 처리 완료 (${today()})\n\n## 지시 원문\n${text}\n\n${results.join('\n\n')}\n`);
  fs.rmSync(path.join(PEND, file));
  log(`지시 완료: ${file}`);
}

log('지시함 워커 시작 — inbox/pending 을 1분 간격 감시');
setInterval(async () => {
  if (busy) return;
  const files = fs.readdirSync(PEND).filter(f => f.endsWith('.md')).sort();
  if (!files.length) return;
  busy = true;
  try { for (const f of files) await processOne(f); }
  catch (e) { log('지시함 오류: ' + e.message); }
  finally { busy = false; }
}, 60000);
