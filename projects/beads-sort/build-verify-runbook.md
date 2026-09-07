# #5·#6-기술 실행 절차서 — targetSdk 확인 + 릴리즈 AAB 빌드·서명 + AD_ID

작성: 박빌드, 2026-09-07. 상태: **초안 (APP_REPO 확보 전 준비 몫)**.

이 문서는 9/4 회고 마찰 3의 처방("막힌 이슈의 준비 몫을 파일 경로 있는 산출물로 만든다")의
첫 적용 대상이다. APP_REPO 확보 시 이 절차대로 실행하고 결과를 §실행 기록에 append한다.

## 전제

| 항목 | 값 | 출처 |
|---|---|---|
| 배정 | #5, #6-기술 = 박빌드 | `org/assignments.md` (9/4 회고: 배정 정본) |
| APP_REPO | `.env:19` 빈 값 (2026-09-07 실측). 승인 상신 approvals #2, 2026-08-19 | `deploy/README.md:12` |
| 앱 소스 원본 | `C:\dev\hanoi` (Flutter) | `context.md` 기본 표 |
| 완료 조건 원문 | issues-draft.md #5·#6 항목 인용 | `issues-draft.md:48,60-63` |

## 실행 절차 (APP_REPO 확보 후, 순서대로)

각 단계는 명령 → 판정 기준 → 기록 위치. APP_REPO는 확보된 경로로 치환한다.
제품 코드 수정이 생기면 브랜치 `feat/5-<요약>`에서만 (인사기록카드 규칙).

### 0. 환경 확인
```bash
cd "$APP_REPO" && git log -1 --oneline && git status --short
flutter --version
```
- 판정: 작업 복제가 깨끗한지, Flutter 버전 기록(1단계 targetSdk 실측에 필요).

### 1. targetSdk 실측 (#5)
```bash
grep -n -i "targetsdk" android/app/build.gradle*
```
- 리터럴 숫자면 그 값이 실측값. `flutter.targetSdkVersion` 참조면 Flutter SDK 기본값에서 확인:
  ```bash
  FLUTTER_ROOT=$(dirname $(dirname $(which flutter)))
  grep -rn "TargetSdkVersion" "$FLUTTER_ROOT/packages/flutter_tools/gradle/"
  ```
  찾은 파일 경로와 해당 행을 함께 기록한다(버전 종속 값이라 출처 필수).
- **대조값(구글 현재 요건)은 이 문서 밖에서 조달 필요** — §외부 조회값 참조.

### 2. 릴리즈 AAB 빌드 (#5)
```bash
flutter build appbundle --release 2>&1 | tee build-release-$(date +%Y%m%d).log
ls -l build/app/outputs/bundle/release/app-release.aab
```
- 판정: 빌드 성공 + AAB 파일 존재. 로그 파일 경로를 §실행 기록에 남긴다.

### 3. 릴리즈 서명 확인 — debug 폴백 아님 (#5)
```bash
ls android/key.properties                       # (a) 키 존재
grep -n -A4 "signingConfigs" android/app/build.gradle   # (b) release가 참조
jarsigner -verify -certs -verbose build/app/outputs/bundle/release/app-release.aab | grep -m1 "CN="
```
- 판정: (a)+(b) 성립 && CN= 이 **Android Debug가 아님**. `CN=Android Debug`면 폴백 서명 →
  그 AAB는 업로드 금지(`context.md:30`).

### 4. R8 비활성 유지 (#5)
```bash
grep -n -E "minifyEnabled|shrinkEnabled|useProguard" android/app/build.gradle
```
- 판정: release 블록의 해당 값이 전부 `false` 실측. **비활성은 기존 결정이므로 켜는 변경을 하지 않는다**(`context.md:29`).

### 5. AD_ID 병합 매니페스트 확인 (#6-기술)
```bash
find build -path "*merged_manifests*release*" -name "AndroidManifest.xml"
grep -n "AD_ID" build/app/intermediates/merged_manifests/release/*/AndroidManifest.xml
```
- 판정: `com.google.android.gms.permission.AD_ID` 선언 존재 실물 확인.
  매니페스트 해당 행 발췌를 §실행 기록에 붙인다(검증 방법 원문: "매니페스트 발췌 첨부").
- google_mobile_ads ^9.1.0이 병합으로 넣는지가 확인 대상(`context.md:16,40`).

## 외부 조회값 (내 도구 범위 밖)

"구글 현재 targetSdk 요건 웹조회값"은 웹 접근이 필요하나 나는 파일·셸 도구만 사용
가능(사규 13조). 김기획 WebFetch 선례(`context.md:36` 개인정보처리방침 실측)를 준용해
스탠드업에서 조회를 요청하거나, 대표 확인 사항으로 남긴다. 이 값이 없으면 1단계는
"실측값 기록 완료, 대조 보류" 상태로 머문다 — 지어낸 값으로 대조하지 않는다.

## 유의 사항 (context.md 기술 결정 준수)

- R8 비활성 유지 — 되돌리는 이슈를 만들지 않는다.
- debug 폴백 서명 AAB 업로드 금지.
- 스토어 제출(업로드 포함)은 전부 대표 몫. 이 절차는 검증까지(`context.md:44`).

## 실행 기록

- (없음 — APP_REPO 확보 후 실행하며 이곳에 날짜·명령·출력 발췌를 append한다.
  gh 이슈 코멘트가 불가한 동안(approvals #3) 이 섹션이 완료 증거 위치다.)
