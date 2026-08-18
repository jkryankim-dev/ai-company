// 두 개의 노동력을 각각 다른 통로로 부른다.
//  - z.ai  : Anthropic 호환 엔드포인트로 직접 호출 (플랜 쿼터 차감)
//  - Claude: Claude Code CLI 헤드리스(claude -p)로만 호출 (구독 인증, 공식 통로)
import { spawn } from 'node:child_process';
import { env, log } from './core.mjs';

const budget = { calls: {}, add(id) { this.calls[id] = (this.calls[id] || 0) + 1; } };
export const usage = () => budget.calls;

async function askZai(system, prompt, { model = 'glm-5.3', maxTokens = 1500 } = {}) {
  const r = await fetch((env.ZAI_ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic') + '/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ZAI_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`z.ai HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
}

function askClaude(system, prompt, { timeoutMs = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'text'], {
      shell: true,
      env: { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: env.CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_API_KEY: '' },
    });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('claude 응답 시간 초과')); }, timeoutMs);
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude 종료코드 ${code}: ${err.slice(0, 300)}`));
      resolve(out.trim());
    });
    child.stdin.write(`${system}\n\n---\n\n${prompt}`);
    child.stdin.end();
  });
}

/** 직원 한 명에게 일을 시킨다. 실패해도 회사는 멈추지 않는다. */
export async function ask(staff, system, prompt, opts = {}) {
  budget.add(staff.id);
  const engine = String(staff.engine || '').toLowerCase();
  const t0 = Date.now();
  try {
    const text = engine.startsWith('claude')
      ? await askClaude(system, prompt, opts)
      : await askZai(system, prompt, { model: engine.replace(/^zai\//, '') || 'glm-5.3', ...opts });
    log(`  ✓ ${staff.name} (${engine}, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    return { ok: true, text };
  } catch (e) {
    log(`  ✗ ${staff.name} 실패: ${e.message}`);
    return { ok: false, text: '', error: e.message };
  }
}
