// 직원 1명 = 웹훅 1개. 봇은 하나지만 이름과 아바타가 각자 다르게 보인다.
import { env, readState, saveState, log } from './core.mjs';

const API = 'https://discord.com/api/v10';
const h = () => ({ Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' });

let channelCache = null;
export async function channels() {
  if (channelCache) return channelCache;
  const r = await fetch(`${API}/guilds/${env.DISCORD_GUILD_ID}/channels`, { headers: h() });
  if (!r.ok) throw new Error(`채널 조회 실패 HTTP ${r.status}`);
  channelCache = (await r.json()).filter(c => c.type === 0);
  return channelCache;
}

async function channelId(name) {
  const c = (await channels()).find(c => c.name === name);
  if (!c) throw new Error(`채널 #${name} 없음`);
  return c.id;
}

async function webhookFor(channelName) {
  const store = readState('webhooks.json', {}) || {};
  if (store[channelName]) return store[channelName];
  const id = await channelId(channelName);
  const existing = await (await fetch(`${API}/channels/${id}/webhooks`, { headers: h() })).json();
  let hook = Array.isArray(existing) ? existing.find(w => w.name === 'doore') : null;
  if (!hook) {
    const r = await fetch(`${API}/channels/${id}/webhooks`, { method: 'POST', headers: h(), body: JSON.stringify({ name: 'doore' }) });
    if (!r.ok) throw new Error(`웹훅 생성 실패 #${channelName} HTTP ${r.status} (봇에 웹훅 관리 권한 필요)`);
    hook = await r.json();
  }
  store[channelName] = `${API}/webhooks/${hook.id}/${hook.token}`;
  saveState('webhooks.json', store);
  return store[channelName];
}


// 표시명: 이름(엔진) · 직함   예) 한실장(claude) · 비서실장 / 김기획(glm-5.3) · 프로덕트 매니저
function engineLabel(engine) {
  const e = String(engine || '').toLowerCase();
  if (!e) return '';
  if (e.startsWith('claude')) return 'claude';
  return e.replace(/^zai\//, '');
}
function nameTag(staff) {
  const eng = engineLabel(staff.engine);
  return eng ? `${staff.name}(${eng}) · ${staff.title}` : `${staff.name} · ${staff.title}`;
}

const chunk = (s, n = 1900) => {
  const out = [];
  for (const para of s.split('\n')) {
    if (!out.length || (out[out.length - 1] + '\n' + para).length > n) out.push(para);
    else out[out.length - 1] += '\n' + para;
  }
  return out;
};

/** 특정 직원 이름으로 채널에 말하기 */
export async function say(channelName, staff, text) {
  if (!text?.trim()) return;
  const url = await webhookFor(channelName);
  for (const part of chunk(text.trim())) {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: nameTag(staff), content: part }),
    });
    if (!r.ok) log(`  ! 디스코드 게시 실패 #${channelName} HTTP ${r.status}`);
    await new Promise(s => setTimeout(s, 400)); // rate limit 여유
  }
}

export async function announce(channelName, text) {
  await say(channelName, { name: '두레', title: '시스템' }, text);
}
