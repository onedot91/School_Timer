# 책장 동시 등록 수정과 적용 절차

사용자가 2026-09-15 구조 변경을 승인한 범위의 수정이다. 최초 검증 시점에는 운영 DB 변경·배포·커밋·푸시를 수행하지 않았다. 이후 사용자 요청에 따른 운영 SQL 적용 결과는 문서 마지막에 기록했다. 이전 `CONCURRENCY_REVIEW_20260915.md`의 실패 재현을 아래 실제 PostgreSQL 검증으로 후속 처리했다.

## 변경

- `supabase/storage_library_placement_v2.sql`: `storage_place_library_book(integer,jsonb,text,integer)` RPC 추가. 최신 빈자리/시즌/학생 책을 잠금 후 확인하고 책, 대회 placement, 주간 보상, 장부, 영수증을 하나의 트랜잭션으로 기록한다. 기존 테이블 데이터 삭제나 새 테이블은 없다.
- `src/server/libraryCompetitionRepository.ts`, `api/shared-settings.ts`: 정상 등록은 RPC 한 번으로 저장과 학생 범위의 확정 결과를 받는다. 공용 버전 충돌을 네트워크 왕복으로 다섯 번 재시도하던 루프를 제거했다. 전송 응답 유실은 동일 requestId로 한 번 재확인한다. 월 전환은 기존 정산 경로를 실행한 뒤 새 트랜잭션을 다시 호출한다.
- 기존 CAS/보상/정산과 같은 `receipt → wallet → sorted scopes → resources` 순서를 사용한다. 같은 칸은 한 명만 성공하고, 동일 요청은 한 번만 반영한다. 기존 책의 추가 속성과 다른 학생 잔액·편지·기록을 통째로 교체하지 않는다.
- 손상된 대회 이벤트·설정·기존 책은 기록 전에 거절한다. 대회 이벤트의 시각 순서, 한국 시간 월/ISO 주차, 기존 주간 보상 ID를 유지한다. 미확인 응답을 저장 성공으로 처리하지 않는다.
- `tests/storage/libraryPlacementConcurrency.ts`는 실제 PostgreSQL과 두 API 프로세스 검증이다. `dev/verifyRelease.mjs`의 release 검사에 포함했다. mock API fixture도 새 RPC 계약을 지원한다.

## 사용자가 적용할 순서

1. 해당 프로젝트의 Supabase SQL Editor에서 **`supabase/storage_library_placement_v2.sql` 전체를 먼저 실행**한다. 이미 `storage_v2.sql`과 `storage_scoped_v2.sql`이 적용된 현재 프로토콜 2 DB가 대상이다. 과거 bootstrap/전환 스크립트는 다시 실행하지 않는다.
2. 아래 조회 결과가 `storage_place_library_book(integer,jsonb,text,integer)`인지 확인한다. `NULL`이면 앱을 먼저 배포하지 않는다.

```sql
select to_regprocedure('public.storage_place_library_book(integer,jsonb,text,integer)');
```

3. SQL 적용 성공을 확인한 뒤 사용자가 Netlify 앱을 배포한다. 새 환경변수나 브라우저 저장 데이터 초기화는 필요하지 않다. SQL은 추가 함수이므로 기존 앱의 CAS 경로를 유지하며 재실행도 가능하다. 앱이 먼저 배포되면 RPC 부재로 책장 등록이 503으로 실패한다.
4. 배포 후 학생 책장 등록의 응답 상태/처리 시간을 확인한다. 진단용으로 실제 학생 보상·잔액을 변경하지 말고, 실제 이용 중 정상 처리 결과를 관측한다. 일반 접속 장애 전체의 해결이나 운영 최대 수용 인원을 이번 검증만으로 확정하지 않는다.

## 실 PostgreSQL 결과

환경: PostgreSQL 17.11, Node 24.16.0, 합성 학급, localhost:55439. DB RPC 처리 전후 각각 80ms의 통신 지연. 기존 5회 CAS 경로도 동일한 PostgreSQL에서 실행해 비교했다.

| 경로/조건 | 성공 | 충돌 실패 | DB RPC | 전체 처리 시간 |
| --- | ---: | ---: | ---: | ---: |
| 기존 경로, 23명 서로 다른 칸 | 5 | 18 | 215 | 2,169ms |
| 새 경로, 두 API 프로세스에 46건 분산 | 46 | 0 | 46 | 1,620ms |

46건은 23명의 학생이 각 두 권을 서로 다른 칸에 등록한 경우다. 실제 저장된 책·영수증 46개, 주간 보상 23건, 모든 지갑 장부 대사 일치. 요청 수가 다르므로 위 시간을 같은 부하의 속도 배율로 해석하지 않는다.

추가 통과: 같은 요청 23회 중복, 같은 칸 23명 경쟁, 동일 requestId의 다른 내용 거절, HTTP 응답 유실 뒤 재조회, 타인 책 이동 거절, 구시즌 요청 거절, 손상된 seed/이벤트/설정/기존 책 거절, 서버 시계보다 앞선 대회 이벤트의 순서 유지, 같은 학생 잔액 차감과 동시 등록, maintenance 중 쓰기 거절과 복구, anon/authenticated RPC 실행 권한 없음. 월 전환 중 23명 모두 등록에 성공했고 지난달 책의 원본 추가 속성을 아카이브에 보존했다. 이후 기존 책 이동에서도 보상을 중복 지급하지 않았다.

SQL 파일을 같은 로컬 DB에 다시 실행하는 검사도 통과했다. 운영 DB·실제 학생 데이터·Netlify 관리 API를 이용한 검증은 하지 않았다.

## 재현

프로젝트 의존성을 추가하지 않았다. 테스트용 `pg`는 `/private/tmp/school-library-pg-runtime/node_modules/pg`에 설치했고 Homebrew PostgreSQL 17을 로컬 도구로 설치했다. 자동 시작 서비스는 등록하지 않았다. 격리 DB 데이터는 `/private/tmp/school-library-pg-data`에 보존하며 검증 종료 후 해당 서버를 정지한다. 기존 localhost:3000 개발 서버는 유지한다.

```sh
STORAGE_TEST_PG_MODULE=/private/tmp/school-library-pg-runtime/node_modules/pg/lib/index.js \
node --import tsx tests/storage/libraryPlacementConcurrency.ts
```

테스트는 매번 고유한 로컬 DB를 생성하며 기존 DB를 삭제하지 않는다. 다른 컴퓨터에서는 로컬 PostgreSQL과 `pg` 드라이버를 먼저 준비해야 한다. 운영 주소를 테스트 대상으로 사용하지 않는다.

## 검증 범위와 식별

- 관련 단위/API 테스트 **83/83 통과**, 프로덕션 빌드 통과, `git diff --check` 통과.
- 전체 테스트 **1,293 통과 / 기존 실패 2 / 건너뜀 1**. 기존 `tests/api/storageCommands.test.ts:67,73` 편지 개수 기대값 실패가 남아 있다.
- 타입 검사는 기존 `src/lib/studentPet.test.ts:204` TS2740으로 실패한다. 이번 수정 파일의 타입 오류는 해결했다. 전체 release 검사가 통과했다고 주장하지 않는다.
- 기준 HEAD `3d8b30184f316a7e59122d702d689704790766dd` + 미커밋 변경.
- tracked binary diff SHA256 `8d844dbd9da9df4c33f74644eb5cff05257245a6437c640ddce3acb3670b6ead`.
- 새 SQL SHA256 `16597184512349b0a48e80240338bd7bbdb2199a2db938ffdae819f28f3d8930`.
- 실 DB 검증 스크립트 SHA256 `b5f4b340f8997c30d957d2c5f40486dc2d21c7cf41261e7c1f55f973a27017b4`.
- Debugging runtime audit: 위 HEAD/소스 식별에 대해 **PASS (격리 PostgreSQL의 책장 등록 경로)**. 운영 전체 수용량 인증이 아니다.
- 증거: `/private/tmp/library-atomic-verified.log`, `/private/tmp/library-atomic-related-final.log`, `/private/tmp/library-atomic-full-tests.log`, `/private/tmp/library-atomic-lint-final.log`, `/private/tmp/library-atomic-build.log`, `/private/tmp/library-release-tests.log`.

작업 상태: 구조/잠금 설계 완료, 구현 완료, 단일 및 다중 프로세스 HTTP/DB 검증 완료, 사용자 적용 절차 작성 완료. 운영 SQL 적용과 앱 배포는 사용자 수행 단계로 남는다.

## 운영 SQL 적용 완료 — 2026-09-15 10:51 KST

사용자의 “Supabase SQL Editor에서 실행해줘” 요청에 따라 Supabase 연결 도구의 migration 기능으로 적용했다. 로컬 프로젝트 URL과 운영 프로젝트 `School_Timer` (`dxibhawclfhoabfgwria`, Seoul)가 일치함을 확인했다. 적용 직전 storage active=true, maintenance=false 및 필요한 기존 함수/receipt scope 컬럼이 있음을 확인했다.

- Migration: `20260915015102_storage_library_placement_v2`, 적용 결과 success=true.
- 운영 함수 본문 MD5 `e568d6b695affa12ab39f0aa8df98b9a`: 검증한 로컬 SQL 본문과 일치.
- 생성된 함수: `storage_place_library_book(integer,jsonb,text,integer)`.
- security_definer=true, search_path=pg_catalog/public, jit=off 확인.
- 실행 권한: anon=false, authenticated=false, service_role=true 확인.
- SQL은 함수 정의와 권한/스키마 갱신만 적용했다. 실제 학생 책·잔액·보상으로 저장 테스트하지 않았다.

**운영 SQL 적용은 완료했다. 앱 배포는 아직 수행하지 않았으며 사용자 수행 단계로 남는다.** 위 적용 절차 1·2는 완료했고 3부터 진행하면 된다. 운영 부하에서의 기능 정상 동작은 앱 배포 후 확인이 필요하다.
