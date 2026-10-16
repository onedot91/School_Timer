# 필수 저장 검증

## 자동 동작

- GitHub의 push/PR마다 `.github/workflows/storage-verify.yml`이 실행된다.
- Node 24에서 타입 검사, 단위/API 테스트, 차단 로직 테스트, 실제 PostgreSQL 저장 회귀 검사,
  학생 23명·교사 동시 저장과 동일 ID 재전송, 프로덕션 빌드를 검증한다.
- PostgreSQL이 없거나 필수 DB 테스트가 실패·생략되면 검증은 실패한다.
- Vercel의 buildCommand는 `npm run build`이며, 이 명령은 GitHub의 같은 커밋·브랜치에 대한
  해당 워크플로 결과와 전체 소스 지문이 일치해야 Vite를 실행한다.
- 파일·SQL·공개 자산·워크플로·테스트가 바뀌면 지문이 바뀐다. 이전 파일의 통과 결과는 재사용하지 못한다.
- 대기 중인 CI는 최대 4분 자동 대기한다. 실패·취소·생략·조회 오류·대기 시간 초과는 빌드 실패다.
  승인 버튼은 필요 없다. CI 완료가 늦어 빌드가 중단됐다면 완료 후 사용자가 재배포할 수 있다.

## 사용자가 처음 반영할 때

1. 이번 소스와 `.github/workflows/storage-verify.yml`을 함께 커밋·푸시한다.
   GitHub Actions에서 `Required storage verification`이 실행되는지 확인한다.
2. Vercel의 자동 시스템 환경변수 노출이 켜져 있어야 한다.
   빌드에는 `VERCEL_GIT_PROVIDER`, `VERCEL_GIT_REPO_OWNER`, `VERCEL_GIT_REPO_SLUG`,
   `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`가 필요하다.
3. 이후 기존 방식으로 직접 운영 배포한다. Codex는 커밋·푸시·운영 배포를 실행하지 않는다.

현재 저장소는 public이다. GitHub 공개 Actions 조회에 비밀키는 필요하지 않다.
공개 API의 요청 한도를 줄이거나 저장소를 private으로 변경한다면,
Vercel 서버 전용 `DEPLOYMENT_GITHUB_TOKEN`에 이 저장소의 **Actions: Read-only** 권한 토큰을 설정할 수 있다.
`VITE_` 접두어를 붙이지 않고 코드·로그·채팅에 토큰을 넣지 않는다. API 401/403/404/429는 안전하게 빌드를 중단한다.

## 로컬 검증

```bash
npm run build
```

로컬 build도 타입·테스트·실제 DB·동시 저장 검증을 거친다. `initdb`, `pg_ctl`, `psql`이 필요하다.
테스트 DB는 임시 디렉터리와 로컬 Unix 소켓만 사용하고 종료 시 자신이 시작한 서버를 정지한다.
운영 Supabase에는 연결하지 않으며 학생 실데이터도 사용하지 않는다.

동시 검증의 시간 기준은 원자 입찰을 포함한 저장 p95 2초, 모든 요청 최대 15초,
개별 DB RPC 8초 미만이다. 이전 경로와 비교할 때만 `CLASSROOM_ATOMIC_BIDS=0`으로 기존 입찰 p95 12초 기준을 사용한다.
낮은 입찰가 등 정상 업무 거절은 시스템 저장 오류와 구분한다.

## 보장 범위와 제한

- 현재 필수 PostgreSQL 회귀 검사는 경매 확정·재전송·범위 격리, 실패 글·도장 보존,
  중첩 교사 설정, 음수 고마 조정·예금 차감·차감 대기,
  도서관 API의 응답 유실 후 중복 보상 방지·슬롯 충돌·타인 책과 편지 보존,
  원자 입찰의 예약 잔액·재전송·낙찰 경합·기존 저장 경로 호환성을 포함한다.
- 동시 사용 검사는 23명 학생의 입찰·실패 글과 교사 설정, 2300개 합성 과거 내역을 사용한다.
- 모든 기능의 모든 조건을 검증한 것은 아니다. 새 저장 동작과 발견한 운영 오류는 이 검증에 추가한다.
- SQL 파일의 지문은 검증한 SQL 소스를 식별한다. 운영 DB에 수동으로 적용한 함수가 동일한지는 보장하지 않는다.
- GitHub 원격 실행 및 Vercel 연결은 변경사항을 사용자가 푸시한 후 처음 확인할 수 있다.
- 현재 브라우저 검수 정책에 따라 별도 Chromium을 실행하지 않는다. 실제 화면 변경은 iab 수동 검수가 별도로 필요하다.
- `verify:release`는 기존의 확장 검증 도구다. 별도 브라우저 전제가 있는 기존 도구를 이번 필수 경로에서 호출하지 않는다.

## 관련 문서

- [GitHub workflow runs API](https://docs.github.com/en/rest/actions/workflow-runs)
- [GitHub workflow jobs API](https://docs.github.com/en/rest/actions/workflow-jobs)
- [Vercel 시스템 환경변수](https://vercel.com/docs/environment-variables/system-environment-variables)
