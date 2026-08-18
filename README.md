# 두레 (doore)

사람 직원 0명, AI 직원단으로 운영하는 회사.

- 대표(사람): 1명 — 승인·방향 결정만
- AI 직원: 9명 — 실무 전량
- 사옥: Discord / 업무 SSOT: GitHub Issues
- 엔진: z.ai GLM Coding Plan(실무진) + Claude Max(임원진)

## 구조
```
org/        직원 인사기록카드 + 사규
meetings/   회의 진행 스크립트, minutes/ 회의록
decisions/  ADR — 왜 그렇게 정했는지
metrics/    주간 KPI
runtime/    스케줄러·디스코드 게이트웨이·임원 프로세스
projects/   실제 제품 코드 (worktree로 개발자별 격리)
```

## 운영 원칙 3줄
1. 말은 Discord에서, 일은 GitHub Issue에 존재한다.
2. 자기 보고를 믿지 않는다 — 완료는 기계가 검증한다.
3. 외부로 나가는 모든 행위는 대표 승인 후에만.
