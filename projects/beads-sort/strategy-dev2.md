# 전략회의 보고 — 프로덕션 심사 탈락 지점 전수 점검 (dev_2)

작성: 박빌드 (dev_2 몫) · 2026-08-19 · 경영전략회의 안건 «Beads Sort 성공 전략»

## 결론 (3줄)
1. **최대 리스크는 targetSdk 마감 교차다.** 구글 실측: 2026-08-31부터 신규 제출은 API 36 필수.
   우리 프로덕션 신청은 9월(14일 시계 미시작 상태) → 마감 **통과 후** 제출이다. API 36 빌드 준비를 지금 시작해야 한다.
2. **데이터 안전 양식은 미제출로 보인다**(context.md 미확인 항목). 등록정보 미비는 심사 자체가 차단된다 — 예외 없음.
3. 광고 SDK 최신성은 **실측 충족**(9.1.0 = pub.dev 최신). 남은 광고 리스크는 EEA 컨센트 통합 여부(코드 실측 불가).

## 점검 환경 (무엇을 읽었고 무엇을 못 읽었는가)
VPS에는 앱 소스가 없다 — 실측: `APP_REPO=` 빈값(.env), git 배포키는 ai-company 전용
(`git ls-remote jkryankim-dev/hanoi` → Repository not found), 조직 공개 저장소 4개(hanoi 없음,
GitHub API 조회). **매니페스트·build.gradle 실물 확인은 PC에서만 가능**하다. 대신 아래는 직접 읽었다.
- 개인정보처리방침 원문 전문: 공개 저장소 `beads-sort-policy` 복제 후 열독 (index.html, 3,701B)
- pub.dev API: google_mobile_ads / audioplayers / shared_preferences 최신 버전 조회
- 구글 플레이 정책 페이지 2종: target API 요건, Advertising ID 선언 정책

## A. targetSdk — 일정 리스크 (심사 관점 최우선)
| 항목 | 실측값 | 출처 |
|---|---|---|
| 신규 앱·업데이트 요건 | 2026-08-31부터 **API 36 이상** ("Starting August 31, 2026: New apps and app updates must target Android 16 (API level 36) or higher") | Play 정책 페이지 실측 |
| 기존 앱 요건 | API 35 이상 유지 (2025-08-31부터) | 상동 |
| 앱 현재 targetSdk | **확인 불가** (PC의 build.gradle 필요) | — |
| 추론 | 2026-08 비공개 트랙 업로드가 수용됐으므로 최소 35는 충족했을 것. 단 실측 아님 | 추론임을 명시 |

14일 시계가 오늘 시작해도 신청 가능일은 9/2 이후 = 마감 이후. 대응:
- **지금 할 일**: PC에서 `grep -n "targetSdk\|compileSdk" android/app/build.gradle*` 실측 + API 36 빌드 준비
  (Flutter 최신 stable 기준. **R8 비활성 유지** — context.md 기술 결정).
- **확인 필요(대표)**: 이미 업로드된 1.0.2+3 AAB를 새 업로드 없이 프로덕션으로 승격하는 것이
  마감 후에도 허용되는지 콘솔에서 확인. 허용되더라도 9월 중 업데이트는 API 36 필수다.

## B. 데이터 안전 (Data safety) 양식 — 게시된 방침과의 정합성
게시된 개인정보처리방침(2026-08-14 시행, 한/영, 패키지명 `com.jkryankim.beadssort` 일치) 원문 기준 답안 골격:

| 방침에 명시된 처리 | 양식 답변 방향 | 비고 |
|---|---|---|
| 광고 ID·기기 식별자 (AdMob) | 수집 = 예, **공유 = 예**, 목적 = 광고 | 맞춤 광고 시 개인 맞춤 설정도 예 |
| IP 기반 대략적 위치 (국가/도시) | 수집 = 예, 공유 = 예, 목적 = 광고 | 위치 권한 없이 IP 로 수집되도 선언 대상 |
| 기기 정보 (모델, OS 버전) | 수집 = 예, 공유 = 예, 목적 = 광고 | |
| 광고 상호작용 (조회·클릭) | 수집 = 예, 공유 = 예, 목적 = 광고 | |
| 게임 진행·설정 (기기 내부 저장만) | 수집 = **아님** (선언하지 않음) | shared_preferences 로컬 저장 — 방침과 일치 |
| 전송 중 암호화 | 예 (AdMob 트래픽 HTTPS) | |
| 아동 대상 여부 | 아니오 (만 13세 미만 비대상, 방침 4조) | |

- **금지**: "수집 없음"으로 통과 시도. SDK 실제 행동과 불일치는 적발 시 앱 삭제 사유다.
- Play 양식의 정확한 항목명·입력 순서는 이슈 #6(이빌드) `data-safety-draft.md` 답안에서 확정 — 본표는 골격과 근거.
- 제출 여부 자체가 미확인 → **대표 확인 1순위**.

## C. 권한 (AD_ID 포함)
| 항목 | 상태 | 근거/확인 방법 |
|---|---|---|
| AD_ID (`com.google.android.gms.permission.AD_ID`) | 병합 **추정 확실** | 구글 정책 문서 원문: "Google Mobile Ads SDK (play-services-ads) may already declare this permission in the SDK's library manifest" — GMA 9.1.0 포함. PC 확인: `flutter build appbundle` 후 `apkanalyzer manifest print` 또는 빌드 로그의 병합 매니페스트 |
| AD_ID **콘솔 선언** (App content → Advertising ID) | **미확인 — 탈락/삭제 위험** | targetSdk 33+ 에서 AD_ID 사용 시 콘솔 선언 필수 (정책 페이지 실측). 미선언 시 정책 위반. 대표 확인 |
| INTERNET | 필요 (광고 로드). 통상 문제 없음 | 매니페스트 실측은 PC |
| 기타 권한 전수 | 확인 불가 | audioplayers 구버전은 WAKE_LOCK 등 추가 가능. PC: 병합 매니페스트에서 예상 밖 권한(카메라·마이크·위치·저장) 없는지 점검 |

## D. 광고 SDK
- **최신성: 충족 (실측)** — pubspec `^9.1.0`(context.md 실측) ≥ 9.1.0 이고 pub.dev 최신 = 9.1.0 → 해석 버전은 9.1.0 확정.
- **EEA 컨센트: 미확인 — 심사·계정 위험**. EEA/영국 사용자에게 동의 흐름 없이 맞춤 광고 송출 시
  Google 유럽 사용자 동의 정책 위험. 코드 실측 불가(PC). 확인: `grep -rn "ConsentInformation\|UserMessaging" lib/`
  - 선택지 A: 콘솔에서 배포 국가에 EEA/영국 제외 — 코드 변경 없음, 시장 축소
  - 선택지 B: UMP 동의 흐름 구현 — 코드 작업, 신규 이슈 필요 (v1.1 후보)
  - 추천: A로 출시 + B를 v1.1 에. **대표 승인 필요**
- app-ads.txt: 심사 필수 아님(실측: 요건 문서에 없음). 수익 위생 관리라 후순위.

## E. 기타 심사 제출물 (범위 밖 분업 항목, 누락 방지 목록)
- 개인정보처리방침 URL 콘솔 등록 여부 — 미확인 (대표). 본문은 실측 완료: 한/영·AdMob 고지 포함, 요건 충족으로 보임
- 콘텐츠 등급(IARC) 설문 — 미확인 (이슈 #7, 오운영 몫)
- 사전 출시 보고서 크래시 방치 — 단독 거절 사유 (closed-test-playbook.md). 트랙 게시 완료 상태이므로 이미 리포트 생성돼 있을 것 — **대표 확인**
- 스토어 등록정보 문구 — `docs/store_listing.md` 존재(context.md). PC 전용이라 본 점검에서 제외

## 대표 승인·확인 필요 항목 (요약)
1. 확인: 데이터 안전 양식 제출 여부 / AD_ID 콘솔 선언 여부 / 방침 URL 등록 여부 (전부 콘솔 — 3분)
2. 확인: 마감 후 기존 AAB 프로모션 가능 여부 (API 36 전략 판단의 전제)
3. 승인: EEA 대응 A(국가 제외 출시) vs B(UMP 구현) — 추천 A 후 B 를 v1.1

## 출처
- 개인정보처리방침 원문: `github.com/jkryankim-dev/beads-sort-policy` index.html (복제 열독)
- target API 요건: support.google.com/googleplay/android-developer/answer/11926878 (2026-08-19 실측)
- Advertising ID 정책: 상동 /answer/6048248 (2026-08-19 실측)
- SDK 버전: pub.dev API (2026-08-19 실측)
- 사내 기록: context.md, ADR 0003, closed-test-playbook.md, issues-draft.md, sprint-01.md, test-journal.md
