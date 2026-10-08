# 운영 환경 정본 (ops-env)

검증: 최감사 / 2026-10-08 / 재검증 대기(재제출) — 반려 사유 1건(§2 테스트 워크트리 의존) 정정, 근거 qa-log.md "ops-env.md 검증" 항

지시서·runbook의 §검증 방법은 이 문서에서 **인용만** 한다(사규 3조 — ADR 0012 '미실측' 규칙의
기준 문서). 신설: 2026-10-05, 근거 meetings/minutes/2026-10-02-마찰보고-김기획.md 마찰 1.
전 항목 2026-10-05 금일 실측(§각 항목의 실측 계기 병기). 이 문서를 고치기 전에 관련 ADR을 읽는다(사규 9조).

## 1. 구동 방식 (실측 10/2 김기획·10/5 재실측)

- 구동 주체는 **systemd `doore.service`** (enabled). 실행 체인:
  `/usr/bin/node /opt/doore/runtime/supervisor.mjs` → gateway.mjs·scheduler.mjs.
- 유닛 실물: `/etc/systemd/system/doore.service` + drop-in `doore.service.d/10-user.conf`.
  **base 유닛의 `User=root`·`/root/doore` 기재는 drop-in으로 전부 무효**다 — drop-in이
  `User=doore`·`Group=doore`·`WorkingDirectory=/opt/doore`·`ExecStart`(초기화 후 /opt/doore 경로)로
  덮는다. base 파일만 읽고 판단하지 않는다.
- 미사용 유물(실행 절차에 쓰지 않는다): `stop-doore.bat`·`start-doore.bat`(Windows 전용 —
  @echo off·powershell, 본 서버 Linux), `ecosystem.config.cjs`(pm2 — `command -v pm2` 부재,
  10/2·10/5 실측).

## 2. 런타임·권한 (실측 10/5)

- Node **v22.22.1** (`node --version`). 테스트는 glob 형식만 유효:
  `node --test "runtime/tests/*.test.mjs"` — 디렉터리 지정 `node --test runtime/tests/`는
  진입점 취급돼 실패(이빌드 10/1 실측, runtime/docs/issue-8-status-display-spec.md:33-34).
- 세션 계정 **doore**(uid 1001), **sudo 불가**(9/24 정지표·10/2 김기획 실측과 동일).
  따라서 `systemctl restart doore`(재기동), 서비스 배포·반영은 **대표 전용** 전제다.
- gh 2.63.2는 `~/.local/bin/gh` — PATH 비노출(비로그인 셸은 ~/.profile:26 미적용).
  호출은 전 경로 또는 `PATH="$HOME/.local/bin:$PATH"` 지정(정지표 9/24 실측).
- 운영 게이트웨이는 main 코드로 구동 — feature 브랜치 산출물의 실기동은 배포(대표 전용) 후.

## 3. 대표 전용 전제 목록 (사규 6조)

재기동(systemctl restart doore) / 배포·머지 반영 / `!지시` 발신 / 콘솔값 입력(org/console-input.md).
지시서의 검증 방법에 이 구분이 필요하면 "대표 발신 전제"로 표기한다(사규 3조, ADR 0012).
