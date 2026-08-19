# Final Gate Review: personal-question-reward-10

- recommendation: APPROVE
- confidence: high
- blockers: []

## originalIntent

주간 미션 `신문에 개인 질문하기`의 보상을 10고마로 변경한다.

## desiredOutcome

- 미션 화면에서 `신문에 개인 질문하기`는 `+10 고마`로 보인다.
- 두 Classword 주간 미션은 각각 `+5 고마`를 유지한다.
- 개인 질문 완료 시 실제 지급액도 10고마이며, 같은 학생·주차·미션의 재시도는 중복 지급되지 않는다.
- 지급으로 잔액 상한 999999를 넘지 않는다.
- 1024/1280/1366 CSS px와 좁은 화면에서 CJK 잘림, 겹침, 가로 오버플로가 없다.

## userOutcomeReview

APPROVE. `WEEKLY_MISSION_DEFINITIONS`와 `getWeeklyMissionRewardAmount`가 개인 질문 10, 두 Classword 미션 5를 반환하며, 학생 미션 카드가 해당 정의의 `rewardAmount`를 직접 렌더링한다. 서버 RPC 경로도 미션 종류로 10/5를 결정하고 같은 `(student_number, week_key, mission_type)` 기본 키로 중복 지급을 막는다. 로컬 fallback도 동일한 분기와 결정적 reward id를 사용한다. SQL과 fallback 모두 `999999 - rewardAmount` 경계에서 전체 보상 지급만 허용한다.

최신 캡처 5장을 직접 확인했다. 개인 질문은 `+10 고마`, 두 Classword 미션은 각각 `+5 고마`로 보이고, 1024/1280/1366 및 effective 512 화면에서 한글 잘림·텍스트 겹침·가로 오버플로는 관찰되지 않았다.

## checkedArtifacts

- `src/lib/weeklyMission.ts`
- `api/weekly-missions.ts`
- `supabase/app_settings.sql`
- `src/lib/weeklyMission.test.ts`
- `api/weekly-mission.test.ts`
- `api/weekly-missions.test.ts`
- `src/lib/weeklyMissionSql.test.ts`
- `DESIGN.md`
- `.omo/evidence/personal-question-reward-10/current/missions-1024.jpg`
- `.omo/evidence/personal-question-reward-10/current/missions-1280.jpg`
- `.omo/evidence/personal-question-reward-10/current/missions-1366.jpg`
- `.omo/evidence/personal-question-reward-10/current/missions-effective-512.jpg`
- `.omo/evidence/personal-question-reward-10/current/missions-weekly-effective-512.jpg`

## reproducedVerification

- `npm test`: 116/116 pass
- `npm run lint`: pass (`tsc --noEmit`)
- `npm run build`: pass; 기존 500 kB 초과 chunk 경고만 있음
- `git diff --check`: pass

## directProgrammingAndSlopPass

- 새 `any`, 타입 억제, 불필요한 추상화, 죽은 코드, 디버그 출력 없음.
- 보상 분기 helper는 UI 정의, fallback 지급, API 실패 응답이 함께 소비하므로 단일 사용 추상화가 아니다.
- 테스트는 단순 삭제 여부나 구현 문자열만 확인하지 않는다. 정의별 10/5 결과, 실제 fallback 잔액 변화, 중복 방지, 상한에서 부분 지급 금지를 검증한다.
- SQL 테스트는 SQL 실행 통합 테스트가 아니라 정규식 계약 검사이므로 단독으로는 제한적이나, 실제 SQL 지급 분기와 잠금/기본 키를 직접 검토했고 TypeScript fallback 행동 테스트가 보완한다. 사용자 성공 기준을 위반하는 증거는 없다.

## evidenceGaps

- 별도 executor report, code-review report, manual-QA matrix, notepad path는 제공되지 않았다. 직접 diff·소스·테스트·최신 캡처를 재검증해 완료 판단을 지지하므로 차단하지 않는다.
- 실제 원격 Supabase에 마이그레이션을 적용해 RPC를 실행한 증거는 없다. 저장소 산출물 변경 요청의 범위에서는 SQL 정의와 테스트를 검토했으며, 배포 적용 여부는 별도 운영 단계다.

## notes

- 빌드는 성공했으나 기존 대형 번들 경고가 남아 있다. 이번 보상 변경의 명시된 성공 기준과 무관하다.
