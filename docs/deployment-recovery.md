# 배포 후 화면 파일 보호

Vercel 빌드의 `VERCEL_DEPLOYMENT_ID`가 있으면 생성된 JS import, preload 경로와 HTML의 JS/CSS 경로에 `?dpl=<배포 ID>`를 붙입니다. API와 전체 페이지 이동은 최신 배포를 사용합니다. 이전 API 계약의 호환성은 별도로 유지해야 합니다.

운영 배포와 관리 화면 설정은 사용자가 수행합니다.

1. Vercel 프로젝트의 System Environment Variables 접근을 활성화합니다.
2. Settings → Advanced → Skew Protection을 활성화합니다. 공식 문서 기준 Pro/Enterprise 기능이며, Vite는 자동 지원 프레임워크가 아니므로 이 저장소의 빌드 처리가 필요합니다.
3. Maximum Age와 Deployment Retention을 사용 중인 탭을 보호할 기간에 맞춥니다. 삭제되거나 보호 기간이 지난 배포는 접근할 수 없습니다.
4. 배포 A를 연 탭을 유지한 채 배포 B를 올린 뒤, 기존 탭에서 아직 방문하지 않은 기능을 엽니다. 개발자 도구에서 `/assets/…?dpl=<A의 ID>` 요청의 200 응답을 확인합니다. 새 탭은 B의 ID를 사용해야 합니다.

이 변경 이전에 이미 열린 탭에는 보호 코드가 없으므로 한 번 새로고침이 필요합니다. Netlify와 로컬 빌드에는 Vercel ID를 주입하지 않습니다. Skew Protection 비활성화 또는 미지원 환경에서는 이전 파일 유지가 보장되지 않습니다.

HTML과 초기 로딩 스크립트는 `no-cache`로 재검증합니다. 청크 로딩 실패 시 온라인이고 아직 사용자 조작이나 앱 화면 표시가 없으며 기존 임시 저장 보호 검사를 통과한 경우에만 탭당 한 번 자동 새로고침합니다. 저장소 접근이 차단되거나 이미 작업을 시작했다면 기존 수동 복구 안내를 유지합니다. 시간 초과나 일반 실행 오류에는 자동 새로고침하지 않습니다.

공식 근거: https://vercel.com/docs/skew-protection , https://vite.dev/guide/build#load-error-handling
