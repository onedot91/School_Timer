# 운영 저장 오류 조사 — 2026-09-20

## 조사 후 로컬 수정

- `AuctionPage.tsx`: 자동 정산 완료 후 화면 복귀 재요청 간격을 5초에서 30~35초로 분산했다. 최초 접속 정산은 유지한다. 신문 변경 이벤트는 기존에 예약된 화면 복귀 타이머를 취소하고 5초 이내 재확인하도록 한다. 클라이언트의 진행 중 요청 공유와 실패 backoff는 유지한다.
- `weeklyMissionClient.ts`: HTTP 상태와 허용된 `WEEKLY_MISSION(S)_*` 서버 코드만 오류 진단에 보존한다. 임의 응답 원문은 수집하지 않는다.
- `api/weekly-missions.ts`: 증거 조회 및 보상 정산 실패를 단계·안전한 코드·오류 종류·요청 시작부터의 경과 시간으로 기록한다. 모든 보상 요청이 실패해도 개별 실패가 먼저 기록된다. 학생 번호, 보상 요청 본문, 원문 오류 메시지를 로그에 남기지 않는다.
- DB 함수와 보상 지급 규칙, 8초 DB 요청 제한은 변경하지 않았다. 이번 수정은 반복 요청 억제와 진단 보강이며 장애 해결의 최종 검증은 아니다.
- 검증: 스케줄링 실행 테스트, 23명 병렬 API 테스트 및 진단 회귀 테스트 통과. localhost 실제 HTTP에서 정상 200·합성 DB TimeoutError 시 502 및 안전한 로그를 관찰했다. 타입 검사·빌드·diff 검사 통과. 전체 테스트 1,330 통과·1 실패·1 skip. 기존 `studentMissionPresentation.test.ts`의 역할명 표시 실패는 그대로다.

### 내일 확인

사용자가 수정 소스를 배포한 뒤 실제 접속 시각과 인원을 기록한다. 문제가 생기면 1시간 안에 Vercel 프로젝트 Logs에서 `/api/weekly-missions`와 `Weekly mission failure`를 조회한다. `stage`, `errorName`, `code`, `elapsedMs`, Vercel 실행 시간·HTTP 상태를 함께 확인한다. 학생 내용이나 쿠키는 복사하지 않는다. 저장 오류 알림의 진단 정보도 같이 비교하되, 미확인 저장을 반복 실행하거나 알림 확인을 기록 복구로 취급하지 않는다.

## Vercel 관리 화면 직접 확인 (후속)

로그인된 Vercel 대시보드에서 `onedot9191s-projects/school-timer`를 직접 열었다.

- 운영 배포는 9월 17일 생성, commit `d979ad02c2868bdc4c733895e3e917363b2d682d`, deployment `dpl_3XVT53Ays5Ni3sRA9r2bNNCzLGWT`, 상태 Ready다.
- Hobby Logs의 선택 가능 기간은 최근 30분·1시간이며, 12시간·1일은 Upgrade to Pro, 3일 이상은 Observability Plus로 표시됐다. 사용자 지정 달력의 9월 18일은 비활성화되어 당시 요청 상세를 열 수 없었다.
- Observability도 현재 12시간까지 선택 가능하며, 3일은 Observability Plus 영역이다. 확인 시 최근 12시간의 Function Error/Timeout 지표는 각각 0%였다. 이는 금요일 장애에 대한 판단 근거가 아니다.
- 이번 테스트 입장의 `/api/weekly-missions` POST 400 로그는 직접 열었다. Firewall Allowed, Seoul icn1, 함수 실행 293ms, 응답 완료 499ms, 함수 최대 실행 시간 5분이었다. 따라서 앞서 말한 8초는 Vercel 함수 제한이 아니라 애플리케이션의 Supabase 요청 제한이다.
- 요금제 변경, 유료 기능 활성화, 설정 변경, 재배포는 하지 않았다. 당시 로그를 조회할 수 없는 이유는 이번에는 도구 부재가 아니라 관리 화면에서 확인한 조회 기간 제한이다. 업그레이드로 과거 로그가 복구된다고 확인한 바도 없다.

관리 화면: https://vercel.com/onedot9191s-projects/school-timer/logs

## 확인 방법

사용자 요청으로 `https://school-timer-five.vercel.app`에 실제 브라우저로 접속했다. 번호 선택과 테스트 입장 화면이 표시됐다. 테스트 입장 후 자동 요청의 콘솔에 `WEEKLY_MISSIONS_HTTP_400`이 기록됐다. 테스트 번호는 API의 1~23 검증에 해당하지 않으므로, 이 400을 실제 학생들의 502·연결 실패와 같은 원인으로 취급하지 않는다.

현재 프로젝트의 Supabase `School_Timer`에서 오류 알림과 DB 통계를 읽기 전용으로 집계했다. 학생 이름·작성 내용·잔액은 조회 결과에 포함하지 않았다. 운영 부하 테스트, 보상·입찰·거래 실행, 알림 확인 처리, 배포, DB 변경은 하지 않았다. 테스트 입장 시 앱 자체의 자동 정산 요청은 위 400으로 거절됐다.

## 첨부 화면과 일치하는 기록

- 발생: 2026-09-18 13:15:44.844 KST
- 접수: 2026-09-18 13:15:46.011 KST
- 화면 분류: `economy` / `network` (고마 거래 / 연결 실패)
- 실제 endpoint: `/api/weekly-missions`
- 오류: `WEEKLY_MISSIONS_NETWORK`, `TypeError`
- 브라우저 online: true. 이 값만으로 Wi-Fi 및 인터넷 연결 품질을 보장하지 않는다.
- HTTP 상태와 원인 코드는 남아 있지 않다.

즉, 해당 항목은 은행 거래 API 실패가 아니라 주간 미션 자동 정산 요청의 연결 실패다. `src/lib/weeklyMissionClient.ts`가 이 경로를 `withSaveFailureReporting('economy', ...)`로 보고해서 화면에서는 고마 거래로 표시한다.

## 9월 18일 오류 집계

저장된 알림 117건. 기록된 HTTP 429는 0건이며 TimeoutError는 6건이다. 오류 보고 자체가 유실되거나 제한될 수 있으므로, 429 기록이 없다는 이유만으로 실제 429가 전혀 없었다고 단정하지 않는다.

주요 그룹:

| 경로·오류 | 건수 |
| --- | ---: |
| WEEKLY_MISSIONS_NETWORK | 25 |
| WEEKLY_MISSIONS_HTTP_502 | 15 |
| 경매 STORAGE_CONFIRMATION_REQUIRED | 25 |
| STUDENT_ECONOMY_CONFIRMATION_REQUIRED | 16 |
| LIBRARY_COMPETITION_SAVE_FAILED | 9 |

## 실제 배포와 DB 상태

- 현재 HTTP 응답: `server: Vercel`, `x-vercel-id: icn1::icn1::…`.
- 인증 없이 조회한 `/api/device-session`은 정상적인 401 응답. 로그인 성공이나 저장 성공의 증거로 사용하지 않았다.
- Supabase 상태: ACTIVE_HEALTHY, `ap-northeast-2`.
- 현재 응답은 서울 Vercel 및 서울 DB다. 과거 문서의 Netlify 미국 리전 문제를 현재 장애 원인으로 재사용할 수 없다.
- 조회 순간 DB 활동 표본에는 활성 잠금 대기가 없었다. 수업 시간의 상태는 알 수 없다.

DB 누적 통계 (`stats_reset`: 2026-08-06 19:49:51 UTC):

| 함수 | 호출 수 | 평균 | 최대 |
| --- | ---: | ---: | ---: |
| storage_load_scope | 12,261 | 522.0ms | 7,983.4ms |
| storage_load_scope_metadata | 2,336 | 302.6ms | 7,485.8ms |
| claim_weekly_mission_reward_v2 | 2,824 | 212.4ms | 7,915.7ms |
| storage_commit_scoped_mutation | 1,524 | 329.1ms | 7,869.9ms |

これは障害時刻に限定された測定値ではない。各サーバー側 fetch の8秒制限に近い実行時間が記録されており、通信時間を加えると時間超過が起きる可能性がある。CPU不足・接続枯渇・ロック競合のいずれかをこの統計だけで確定することはできない。

## コード上の負荷経路と判断

`api/weekly-missions.ts`は1回の同期で4系統の証拠照会を行い、さらに個人質問・納言登録の報酬RPCを呼ぶ。過去の未精算日がある場合は日付ごとの追加処理もある。学生23人の同期が重なると、初段だけで最大92件のDB要求が発生し得る。報酬RPCは学生のwallet行をロックするため、同じ学生の別の保存と競合し得る。

確認済みなのは、実際の失敗経路・エラー種別・複数機能でのサーバーエラー・8秒近いDB実行時間である。負荷集中と時間超過は有力な仮説だが、添付項目の接続切断を最終確定するには9月18日13:15:44 KST前後のVercelリクエストログが必要。利用可能な接続ツールにはVercelログ取得がなく、今回は取得できていない。

先行の25セッション試験はsettings/economyの読み書きが中心で、運用画面の全自動同期を含む試験ではない。従って今回のミッション障害を解消した証拠にはならない。次の修正・検証は週次ミッションの要求集中、実行時間、失敗時の原因保持、全自動同期を含む負荷条件を対象にする必要がある。
