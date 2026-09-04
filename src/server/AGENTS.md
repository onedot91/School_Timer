# SERVER-SIDE MODULE KNOWLEDGE

## OVERVIEW

Node/Vercel Function 전용 코드. `api/*.ts`가 HTTP 경계를 맡고, 이 폴더는 세션·요청 제한·입력 파싱·PostgREST 저장소 로직을 제공한다.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| 기기 등록 세션 | `deviceSession.ts` | HMAC 서명, 만료 검증, `__Host-` 쿠키 생성/해제 |
| 요청 남용 방지 | `requestRateLimit.ts` | IP/route/student 단위 메모리 제한, cross-site 판별 |
| 낱말장 DB 작업 | `classwordRepository.ts` | 보드·퀴즈·보상 PostgREST/RPC 호출 |
| 낱말장 주간 정산 조회 | `classwordMissionSettlement.ts` | 페이지네이션된 항목·보상 키 로드 |
| 오늘의 친구 요청 파싱 | `todayFriendRequest.ts` | action별 크기·날짜·학생 번호·문항 검증 |
| 오늘의 친구 DB 작업 | `todayFriendRepository.ts` | 계획 상태, 제출, 검토, 보상 RPC |
| 오늘의 친구 row 변환 | `todayFriendRows.ts` | DB snake_case와 도메인 타입 사이 검증/직렬화 |

## BOUNDARIES

- `node:crypto`, `Buffer`, service-role key를 사용하는 Node 전용 모듈이다. React 페이지나 브라우저용 `src/lib`에서 import하지 않는다.
- HTTP method, response status, env 구성, 세션 역할 권한은 `api/*.ts`에서 결정한다.
- 이 폴더는 검증된 요청 action과 저장소 연산을 제공하며 Vercel response 객체를 직접 다루지 않는다.
- `deviceSession.ts`의 서명 비교는 `timingSafeEqual`을 유지하고, 쿠키의 `Secure; HttpOnly; SameSite=Strict; Path=/` 속성을 약화하지 않는다.
- rate limit은 serverless 인스턴스 로컬 메모리 기반 방어선이다. 영구적·전역적으로 정확한 카운터로 간주하지 않는다.

## CONVENTIONS

- ESM 런타임 해석을 위해 상대 TypeScript import에도 `.js` 확장자를 붙인다.
- PostgREST 요청은 `AbortSignal.timeout(8000)`을 유지하고, 빈 본문과 `204`를 명시적으로 처리한다.
- 외부 JSON과 DB row는 항상 `unknown`에서 시작해 배열·record·필드 범위를 검증한 뒤 도메인 타입으로 변환한다.
- 저장소 오류는 안정적인 `status`와 `code`를 가진 전용 Error로 바꿔 API 계층이 응답을 매핑하게 한다.
- URL filter 값은 `encodeURIComponent`로 인코딩한다. SQL 문자열이나 신뢰되지 않은 값을 직접 조합하지 않는다.
- PostgREST `select` 목록과 row parser는 함께 변경한다. 반환 shape가 어긋나면 `*_DATABASE_INVALID_RESPONSE`로 실패시킨다.
- 오늘의 친구는 request parser, row codec, repository 책임을 섞지 않는다.

## DIRECT TESTS

- 세션 변경: `node --import tsx --test tests/api/deviceSession.test.ts`
- 오늘의 친구 변경: `node --import tsx --test tests/api/today-friend.test.ts`
- 낱말장 변경: `node --import tsx --test tests/api/classword.test.ts src/lib/classwordDailyMission.test.ts`
- 공용 세션 소비 경로: 관련 `tests/api/{shared-settings,student-economy,weekly-mission,weekly-missions}.test.ts`를 선택 실행한다.
- import 경계 변경: `node --import tsx --test src/lib/vercelFunctionImports.test.ts`
- 테스트에서는 실제 Supabase 데이터나 학생 잔액을 변경하지 말고 fetch/mock 기반 경계를 사용한다.

## ANTI-PATTERNS

- service-role key, 세션 secret, 서명 token을 로그·오류 본문·클라이언트 번들에 노출하지 않는다.
- PostgREST 성공 응답을 shape 검증 없이 type assertion으로 신뢰하지 않는다.
- 저장소 함수에 브라우저 fallback, localStorage, React 상태를 추가하지 않는다.
- API 권한 검사를 repository 내부로 숨기거나, 학생 번호 범위 `1..23` 검증을 우회하지 않는다.
- rate-limit Map을 요청마다 새로 만들거나 무제한으로 성장시키지 않는다.
