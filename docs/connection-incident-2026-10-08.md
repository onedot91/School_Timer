# 2026-10-08 저장 응답 오류 조사

## 운영 확인

현재 운영은 Vercel + Seoul Supabase이다. 루트·API·서버 AGENTS.md를 이 기준으로 정정했다. Netlify 설정은 기존 호환 경로이다.

사용자가 제공한 오전 09:31–09:39 KST 오류 6건은 모두 HTTP 502 / STORAGE_DATABASE_TIMEOUT이다. 고마 거래 4건과 경매 입찰 2건이며, 화면의 오류만으로 실제 미저장을 단정할 수 없다.

Supabase 로그를 2026-10-08 00:30–00:41 UTC로 제한하여 조회했다. SQLSTATE 57014(statement timeout) 52건:

| RPC | 건수 |
| --- | ---: |
| storage_load_snapshot | 22 |
| storage_load_scope | 16 |
| storage_poll_scope | 6 |
| storage_load_scope_metadata | 5 |
| storage_reward_audit_source | 2 |
| 분류되지 않은 SQL | 1 |

조회 시점에 제공된 요청 ID 6개 중 5개는 이후 커밋된 영수증이 있었다. 나머지 1개는 영수증이 없었다. 이는 해당 요청의 커밋 확인 여부이며, 다른 요청으로 동일 행동이 수행됐는지까지 판정하지 않는다. 학생 답변·편지 내용·잔액은 조회하지 않았고, 재지급·재입찰·확인 처리도 실행하지 않았다.

Supabase 대시보드에서 Free/Nano(t4g.nano), 메모리 최대 0.5GB를 확인했다. 09:17–10:17 KST 메모리 그래프는 500MB 이상의 swap 사용을 보였고 오류 시간대 CPU 그래프에는 큰 IOwait 상승이 있었다. DB 자체 조회 timeout과 함께 자원 경합을 지지한다. swap만으로 단일 원인이나 증설 후 해결을 확정하지 않는다. 현재 DB 상태 ACTIVE_HEALTHY는 과거 오류가 없었다는 뜻이 아니다.

## 수정 후보와 검증

`supabase/storage_selector_reads.sql`은 두 읽기 함수의 resource-first EXISTS를 selector-first LATERAL 조회로 바꾸는 후보이다. 함수 원문 hash guard, transaction 원자성, 재적용 안전성을 포함한다. 기존 범위·권한·삭제 기록·readVersion·8초 timeout·write/receipt 경로는 보존한다. **운영에는 적용하지 않았다.**

격리 PostgreSQL에서 가짜 학생 23명, 편지 800개, 이력 4,830개로 검사했다. `tests/storage/selectorReads.integration.test.ts`는 23명 HTTP/SQL 투영, 경계 범위 7개, metadata, 삭제 기록, 늦은 revision, service_role 전용 실행, 잘못된 함수 버전 거절과 재적용을 검증한다.

최종 측정에서 selector JSON 함수 반복은 27회에서 4회로 감소했다. 25세션 × 3회 실제 HTTP 요청은 전후 각각 75회, 오류 0건이었다. 전체 p95는 166→178ms, 학생 p95는 124→123ms로 **전체 속도 개선은 입증되지 않았다**. 이 후보를 장애 해결 완료로 제시하거나 운영에 적용하지 않는다. 운영 데이터나 운영 부하의 재현 시험이 아니다.

검증: `npm test` 1,443개 통과·1개 건너뜀, `npm run lint`, `npm run build`, 추가 PostgreSQL 통합 검증 통과. 기존 신문 DB 테스트는 전용 런타임 미설정으로 건너뛰었다. 화면/layout 변경이 없어 화면 크기별 QA는 수행하지 않았다. 원본 측정 자료는 `.omo/evidence/storage-selector-reads/`에 있다.

```sh
STORAGE_TEST_PG_PORT=55448 \
STORAGE_TEST_PG_MODULE=/private/tmp/school-timer-concurrency-20261006/runtime/node_modules/pg/lib/index.js \
node --import tsx --test tests/storage/selectorReads.integration.test.ts
```

## 다음 결정

DB 자원 증설은 비용과 DB 재시작 가능성이 있어 사용자 결정이 필요하다. Free에서는 compute 설정이 비활성화돼 있다. 우선 Pro + Small(2GB)을 검토하되, 적용 뒤 같은 수업 시간대의 57014/502, IOwait, swap, p95를 비교해야 한다. 최소 비용 선택지는 Pro + Micro(1GB)이며 충분한지는 운영 부하 검증이 필요하다.

2026-10-08 공식 가격표 기준 Pro 월 US$25, 포함 compute credit US$10, Micro 약 US$10/월, Small 약 US$15/월이다. 프로젝트 1개와 기본 포함량 기준 총액은 Micro 약 US$25/월, Small 약 US$30/월이며 세금·추가 프로젝트·초과 사용량은 별도이다. 조직의 다른 프로젝트는 조사하지 않았다. 결제 및 실제 compute 변경은 실행하지 않았다. Vercel 배포도 실행하지 않았다.

- 운영 지표: https://supabase.com/dashboard/project/dxibhawclfhoabfgwria/observability/database
- 변경 화면: https://supabase.com/dashboard/project/dxibhawclfhoabfgwria/settings/infrastructure
- 공식 가격: https://supabase.com/pricing
- 공식 compute 안내: https://supabase.com/docs/guides/platform/compute-and-disk
