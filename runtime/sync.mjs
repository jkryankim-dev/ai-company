// 남기록의 자동 커밋. 회의록·결정·현황 변경을 스스로 저장소에 남긴다.
// 대표가 터미널에서 git 을 칠 일이 없도록 하는 것이 목적이다.
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const EVERY_MS = 15 * 60 * 1000;
const stamp = () => new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
const log = (m) => console.log(`[${stamp()}] ${m}`);

const git = (args) => new Promise((resolve) => {
  const c = spawn('git', args, { cwd: ROOT, shell: true });
  let out = '', err = '';
  c.stdout.on('data', d => out += d);
  c.stderr.on('data', d => err += d);
  c.on('close', code => resolve({ code, out: out.trim(), err: err.trim() }));
  c.on('error', e => resolve({ code: -1, out: '', err: e.message }));
});

async function sync() {
  await git(['pull', '--rebase', '--autostash']);   // 다른 곳(PC/VPS)의 변경을 먼저 수신
  const st = await git(['status', '--porcelain']);
  if (st.code !== 0) return log(`git 사용 불가: ${st.err}`);
  if (!st.out) return;                       // 바뀐 게 없으면 조용히 넘어간다

  const files = st.out.split('\n').length;
  await git(['add', '-A']);
  const msg = `기록: ${stamp()} 자동 저장 (${files}개 변경)`;
  const c = await git(['commit', '-m', `"${msg}"`]);
  if (c.code !== 0) return log(`커밋 실패: ${c.err || c.out}`);
  log(`커밋 완료 — ${files}개 변경`);

  const p = await git(['push']);
  if (p.code !== 0) log(`푸시 실패(로컬 커밋은 유지됨): ${p.err || p.out}`);
  else log('푸시 완료');
}

log('자동 기록 시작 — 15분마다 변경사항을 저장소에 남깁니다.');
await sync();
setInterval(sync, EVERY_MS);
