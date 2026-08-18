// 두레 관리자. pm2 없이 직원들을 상시 근무시킨다.
// 자식이 죽으면 되살리고, 무슨 일이 있었는지 runtime/logs 에 남긴다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOGS = path.join(ROOT, 'runtime', 'logs');
fs.mkdirSync(LOGS, { recursive: true });

const stamp = () => new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
const mainLog = fs.createWriteStream(path.join(LOGS, 'supervisor.log'), { flags: 'a' });
function log(m) {
  const line = `[${stamp()}] ${m}`;
  console.log(line);
  mainLog.write(line + '\n');
}

const WORKERS = [
  { name: 'gateway',   script: 'runtime/gateway.mjs',   label: '대표실 게이트웨이' },
  { name: 'scheduler', script: 'runtime/scheduler.mjs', label: '근태 스케줄러' },
  { name: 'sync',      script: 'runtime/sync.mjs',      label: '자동 기록(git)' },
];

const state = {};

function start(w) {
  const s = state[w.name] ||= { restarts: 0, delay: 3000 };
  const out = fs.createWriteStream(path.join(LOGS, `${w.name}.log`), { flags: 'a' });
  out.write(`\n===== ${stamp()} 기동 =====\n`);

  const child = spawn(process.execPath, [w.script], { cwd: ROOT, env: process.env });
  s.pid = child.pid;
  log(`▶ ${w.label} 기동 (pid ${child.pid})`);

  child.stdout.on('data', d => out.write(d));
  child.stderr.on('data', d => out.write(d));

  child.on('exit', (code, sig) => {
    out.write(`===== ${stamp()} 종료 code=${code} sig=${sig} =====\n`);
    log(`◀ ${w.label} 종료 (code ${code}). ${Math.round(s.delay / 1000)}초 뒤 재기동`);
    s.restarts++;
    setTimeout(() => start(w), s.delay);
    s.delay = Math.min(s.delay * 2, 60000);   // 계속 죽으면 간격을 늘린다
  });

  // 60초 넘게 살아 있으면 정상으로 보고 백오프를 되돌린다
  setTimeout(() => { if (s.pid === child.pid) s.delay = 3000; }, 60000);
}

log('두레 관리자 시작. 창을 닫으면 회사가 퇴근합니다.');
WORKERS.forEach(start);

setInterval(() => {
  fs.writeFileSync(path.join(ROOT, 'runtime', 'state', 'supervisor.json'),
    JSON.stringify({ alive: stamp(), workers: state }, null, 2));
}, 30000);

process.on('SIGINT', () => { log('종료 신호 수신. 퇴근합니다.'); process.exit(0); });
