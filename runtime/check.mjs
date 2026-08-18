// 두레 - 입사 전 신체검사
// 사용법:  node runtime/check.mjs          (점검만)
//          node runtime/check.mjs --create (없는 채널 자동 생성)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CREATE = process.argv.includes('--create');

// ---- .env 로드 (의존성 없음) ----
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('=');
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const CHANNELS = ['전사공지','스탠드업','기획','개발','qa','마케팅','운영','대표실','감사로그'];
let fail = 0;
const ok   = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m);
const bad  = (m) => { fail++; console.log('  \x1b[31m✗\x1b[0m ' + m); };
const warn = (m) => console.log('  \x1b[33m!\x1b[0m ' + m);
const head = (m) => console.log('\n\x1b[1m' + m + '\x1b[0m');

const dapi = (p, opt = {}) => fetch('https://discord.com/api/v10' + p, {
  ...opt,
  headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json', ...opt.headers },
});

// ---- 1. 환경변수 ----
head('1. 환경변수');
for (const k of ['ZAI_API_KEY','DISCORD_BOT_TOKEN','DISCORD_GUILD_ID','GITHUB_REPO']) {
  env[k] ? ok(`${k} 설정됨`) : bad(`${k} 비어 있음`);
}
env.CLAUDE_CODE_OAUTH_TOKEN
  ? (env.CLAUDE_CODE_OAUTH_TOKEN.startsWith('sk-ant-oat')
      ? ok('CLAUDE_CODE_OAUTH_TOKEN 설정됨')
      : bad('CLAUDE_CODE_OAUTH_TOKEN 형식 이상 (sk-ant-oat... 이어야 함)'))
  : bad('CLAUDE_CODE_OAUTH_TOKEN 비어 있음 → Windows Terminal에서 `claude setup-token` 실행');

if (env.ANTHROPIC_API_KEY) bad('ANTHROPIC_API_KEY 가 채워져 있음 → 종량 과금으로 새어나감. 비우세요');
else ok('ANTHROPIC_API_KEY 비어 있음 (정상)');
if (process.env.ANTHROPIC_API_KEY) bad('시스템 환경변수에 ANTHROPIC_API_KEY 존재 → 반드시 삭제 (구독 인증을 덮어씀)');
else ok('시스템 환경변수 ANTHROPIC_API_KEY 없음 (정상)');

// ---- 2. z.ai ----
head('2. z.ai 실무진 엔진');
try {
  const r = await fetch((env.ZAI_ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic') + '/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ZAI_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'glm-5.3', max_tokens: 16, messages: [{ role: 'user', content: '핑' }] }),
  });
  if (r.ok) ok('z.ai 응답 정상 (glm-5.3)');
  else bad(`z.ai HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
} catch (e) { bad('z.ai 연결 실패: ' + e.message); }

// ---- 3. 디스코드 ----
head('3. 디스코드 사옥');
try {
  const me = await dapi('/users/@me');
  if (!me.ok) throw new Error(`HTTP ${me.status} — 봇 토큰 확인 필요`);
  ok(`봇 로그인 성공: ${(await me.json()).username}`);

  const g = await dapi(`/guilds/${env.DISCORD_GUILD_ID}`);
  if (!g.ok) throw new Error(`서버 접근 실패 (HTTP ${g.status}) — 봇이 서버에 초대되었는지, GUILD_ID가 맞는지 확인`);
  ok(`서버 확인: ${(await g.json()).name}`);

  const cr = await dapi(`/guilds/${env.DISCORD_GUILD_ID}/channels`);
  const chans = await cr.json();
  const names = new Set(chans.filter(c => c.type === 0).map(c => c.name));
  const missing = CHANNELS.filter(n => !names.has(n));

  if (!missing.length) ok('채널 9개 모두 존재');
  else if (CREATE) {
    for (const n of missing) {
      const c = await dapi(`/guilds/${env.DISCORD_GUILD_ID}/channels`, {
        method: 'POST', body: JSON.stringify({ name: n, type: 0 }),
      });
      c.ok ? ok(`채널 생성: #${n}`) : bad(`채널 생성 실패 #${n} (HTTP ${c.status}) — 봇에 채널 관리 권한 필요`);
    }
  } else {
    warn(`없는 채널: ${missing.map(n => '#' + n).join(' ')}`);
    warn('→ node runtime/check.mjs --create 로 자동 생성 가능');
  }
} catch (e) { bad('디스코드: ' + e.message); }

// ---- 4. GitHub ----
head('4. GitHub 업무 SSOT');
const m = (env.GITHUB_REPO || '').match(/(?:github\.com[/:])?([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
if (!m) bad('GITHUB_REPO 형식을 알 수 없음 (owner/repo 또는 전체 URL)');
else {
  ok(`레포 인식: ${m[1]}/${m[2]}`);
  try {
    const r = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}`, { headers: { 'User-Agent': 'doore' } });
    if (r.status === 404) warn('공개 조회 404 — private 레포면 정상. gh CLI 인증이 되어 있어야 함');
    else if (r.ok) ok('레포 존재 확인');
    else warn(`GitHub HTTP ${r.status}`);
  } catch (e) { warn('GitHub 조회 실패: ' + e.message); }
}

// ---- 결과 ----
head(fail ? `점검 완료 — 문제 ${fail}건` : '점검 완료 — 전부 정상. 출근 준비 끝');
process.exit(fail ? 1 : 0);
