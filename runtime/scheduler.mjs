// 두레 근태 관리. 의존성 없이 1분마다 시각을 확인한다. (Asia/Seoul 기준)
import { spawn } from 'node:child_process';
import { log } from './lib/core.mjs';

const SCHEDULE = [
  { days: [1,2,3,4,5], time: '09:00', task: 'standup',  label: '데일리 스탠드업' },
  { days: [1],         time: '10:00', task: 'allhands', label: '주간 전사회의' },
  { days: [5],         time: '17:00', task: 'retro',    label: '스프린트 회고' },
];

const fired = new Set();

function seoul() {
  const d = new Date();
  const s = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return { day: s.getDay(), hm: `${String(s.getHours()).padStart(2,'0')}:${String(s.getMinutes()).padStart(2,'0')}`,
           date: s.toLocaleDateString('sv-SE') };
}

function run(task, label) {
  log(`▶ ${label} 실행`);
  const c = spawn('node', ['runtime/meeting.mjs', task], { shell: true, stdio: 'inherit' });
  c.on('close', code => log(`◀ ${label} 종료 (code ${code})`));
}

log('두레 근태 시스템 가동. 스케줄:');
for (const s of SCHEDULE) log(`  ${s.label} — ${['일','월','화','수','목','금','토'].filter((_,i)=>s.days.includes(i)).join('')} ${s.time}`);

setInterval(() => {
  const { day, hm, date } = seoul();
  for (const s of SCHEDULE) {
    const key = `${date}-${s.task}`;
    if (s.days.includes(day) && hm === s.time && !fired.has(key)) {
      fired.add(key);
      run(s.task, s.label);
    }
  }
}, 30000);
