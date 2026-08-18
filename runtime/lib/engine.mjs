// 두 노동력을 각각 다른 통로로 부른다. 둘 다 Claude Code CLI 를 통한다.
//  - 실무진(z.ai): ANTHROPIC_BASE_URL 을 z.ai 로 돌린 Claude Code — 플랜 쿼터 차감
//  - 임원진(Claude): 구독 인증 Claude Code — 공식 통로
// 핵심: 두 세계는 환경변수를 절대 공유하지 않는다. 워커에 Claude 자격증명이 새면 정책 위반이다.
import { spawn } from 'node:child_process';
import { env, log, p } from './core.mjs';

const budget = { calls: {}, add(id) { this.calls[id] = (this.calls[id] || 0) + 1; } };
export const usage = () => budget.calls;

const APP_DIR = env.APP_REPO || '';

function runClaudeCode(system, prompt, opt) {
  const { model, forZai, cwd = p(), addDirs = [], timeoutMs = 600000, maxTurns = 40 } = opt;

  // --- 격리 ---
  // 직원에게는 파일과 셸만 준다. 대표 PC 에 연결된 MCP 커넥터는 절대 물려주지 않는다.
  //   --strict-mcp-config + 빈 설정 파일 → 사용자/프로젝트 MCP 전부 무시
  //   --tools                            → 내장 도구도 지정한 것만
  //   CLAUDE_CONFIG_DIR                  → 대표의 개인 설정·스킬·플러그인 격리
  const args = [
    '-p', '--output-format', 'text',
    '--dangerously-skip-permissions',
    '--strict-mcp-config',
    '--mcp-config', `"${p('runtime', 'empty-mcp.json')}"`,
    '--tools', 'Read,Write,Edit,Glob,Grep,Bash',
    '--max-turns', String(maxTurns),
  ];
  if (forZai) args.push('--bare');           // bare 는 OAuth 불가 → 실무진 전용
  if (model) args.push('--model', model);
  for (const d of addDirs) if (d) args.push('--add-dir', `"${d}"`);

  const e = { ...process.env };
  delete e.ANTHROPIC_API_KEY;
  e.CLAUDE_CONFIG_DIR = p('runtime', 'state', 'claude-home');
  e.DISABLE_TELEMETRY = '1';

  if (forZai) {
    e.ANTHROPIC_BASE_URL   = env.ZAI_ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic';
    e.ANTHROPIC_API_KEY    = env.ZAI_API_KEY;   // --bare 는 API 키 방식만 허용
    e.ANTHROPIC_AUTH_TOKEN = env.ZAI_API_KEY;
    delete e.CLAUDE_CODE_OAUTH_TOKEN;           // 워커에 Claude 자격증명 금지
  } else {
    e.CLAUDE_CODE_OAUTH_TOKEN = env.CLAUDE_CODE_OAUTH_TOKEN;
    delete e.ANTHROPIC_BASE_URL;
    delete e.ANTHROPIC_AUTH_TOKEN;
  }

  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { shell: true, cwd, env: e });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('응답 시간 초과')); }, timeoutMs);
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('error', ex => { clearTimeout(timer); reject(ex); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`종료코드 ${code}: ${(err || out).slice(0, 300)}`));
      resolve(out.trim());
    });
    child.stdin.write(`${system}\n\n---\n\n${prompt}`);
    child.stdin.end();
  });
}

// 도구 없이 텍스트만 필요한 경우의 예비 경로 (CLI 실패 시)
async function askZaiDirect(system, prompt, model = 'glm-5.3') {
  const r = await fetch((env.ZAI_ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic') + '/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ZAI_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 1500, system, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`z.ai HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
}

/** 직원 한 명에게 일을 시킨다. 이제 직원은 파일을 읽고 쓰고 명령을 실행할 수 있다. */
export async function ask(staff, system, prompt, opts = {}) {
  budget.add(staff.id);
  const engine = String(staff.engine || '').toLowerCase();
  const forZai = !engine.startsWith('claude');
  const model  = forZai ? (engine.replace(/^zai\//, '') || 'glm-5.3') : undefined;
  const t0 = Date.now();

  try {
    const text = await runClaudeCode(system, prompt, {
      model, forZai,
      addDirs: opts.addDirs ?? (APP_DIR ? [APP_DIR] : []),
      ...opts,
    });
    log(`  ✓ ${staff.name} (${engine}, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    return { ok: true, text };
  } catch (ex) {
    log(`  ! ${staff.name} 도구 경로 실패(${ex.message}) — 텍스트 경로로 재시도`);
    if (!forZai) return { ok: false, text: '', error: ex.message };
    try {
      const text = await askZaiDirect(system, prompt, model);
      log(`  ✓ ${staff.name} (예비 경로, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      return { ok: true, text, degraded: true };
    } catch (e2) {
      log(`  ✗ ${staff.name} 실패: ${e2.message}`);
      return { ok: false, text: '', error: e2.message };
    }
  }
}
