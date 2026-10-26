# 입찰 실패 장애 (2026-10-26)

## 증상

2026-10-26 10:25~10:39 KST 수업 중 학생 입찰이 실패했다. Vercel `icn1` 로그에서 `student.auction.bid`가 8초 후 `STORAGE_DATABASE_TIMEOUT`(502)으로 끝났다. 같은 시간 야구 저장, 펫 먹이, 학생 읽기, 보상 감사도 같은 코드로 실패했다. 입찰 검증 로직 오류가 아니라 데이터베이스 포화였다. 같은 시간에 일부 입찰은 저장되었다.

## 원인

주간 마감과 물품 제거는 입찰 기록 항목을 묘비(`deleted=true`)로 남긴다. 정리 경로가 없어 `auctionBidHistory` 1,433행 중 1,415행이 묘비였다. 모든 학생 읽기(개요·전체)와 입찰 명령이 `/auctionBidHistory`를 묘비와 함께 읽는다.

| 측정 (유휴 상태, 운영 DB) | 입찰 기록 포함 | 입찰 기록 제외 |
|---|---:|---:|
| 입찰 범위 응답 크기 | 383 KB (deletedKeys 1,494개) | 10 KB |
| 입찰 범위 `storage_load_scope` | 약 150 ms | 37 ms |
| 학생 개요 읽기 `storage_load_scope` | 207 ms | 57 ms |

학생 읽기 비용의 약 73%가 지난 주 묘비였다. 분당 150~250개 요청에서도 DB가 포화되어 문장 시간 초과가 연쇄로 발생했다.

## 조치

`supabase/storage_auction_history_tombstones.sql`

- `storage_purge_auction_history_tombstones(retention)`: 1일 이상 지난 입찰 기록 항목 묘비를 `storage_purged_tombstones`에 백업한 뒤 삭제한다. service_role 전용이며 maintenance 상태에서는 거부한다.
- 항목 키에 금액·입찰자·시각이 들어 있어 같은 키가 다시 쓰이지 않는다. 클라이언트 캐시의 revision이 거꾸로 가지 않는다. 매주 재사용되는 물품 컨테이너(`/auctionBidHistory/item-a`) 묘비는 남긴다.
- 적용 시 한 번 정리하고, pg_cron으로 매일 03:17 KST에 정리한다.
- 되돌리기: `supabase/storage_auction_history_tombstones_rollback.sql` (일정·함수 제거, 백업에서 묘비 복원).

## 검증

- PGlite 테스트 `tests/api/auctionHistoryTombstones.postgres.test.ts`: 대상 선택, 백업, 재실행, 보존 기간 하한, maintenance 거부, 권한, 롤백 복원.
- `npm run lint`, `npm test` 통과.
- 운영 적용 후 효과(입찰 지연, 시간 초과 빈도)는 적용 후 측정해야 한다.

## 남은 위험

`studentLife` 묘비 708개도 학생 편지 읽기에 포함된다. 이번 조치 범위 밖이다.
