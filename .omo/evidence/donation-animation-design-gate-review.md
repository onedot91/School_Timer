# Donation animation design gate review

- recommendation: APPROVE
- blockers: none
- originalIntent: `#student-store-donation`에서 제공된 GIF를 현재 즉시 표시하고 재생 속도를 약 `0.75x`로 낮춘다. 기부 완료 시에만 재생하는 트리거는 후속 작업으로 명시적으로 제외하며, 실제 기부 데이터는 변경하지 않는다.
- desiredOutcome: 기존 기부 페이지의 캐릭터 영역에 투명 배경 감사 애니메이션이 Chromebook 1024/1280/1366 폭에서 잘림·오버플로 없이 표시되고, reduced-motion에서는 정지 첫 프레임을 제공한다.
- userOutcomeReview: 사용자 요청과 일치한다. GIF는 8프레임, 512x512이며 원본 800ms 대비 1070ms로 재생되어 `800 / 1070 = 0.7477x`이다. 현재 반복 미리보기는 의도된 현 단계 동작이고 완료 전용 트리거는 추가되지 않았다. 세 필수 뷰포트 캡처에서 레이아웃, 텍스트, 진행률, 버튼이 모두 온전히 보이며 두 1280 프레임은 캐릭터 포즈 변화가 실제로 진행됨을 보여준다.

## Success criteria

| ID | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| SC-1 | 제공 GIF의 시각 내용을 기부 페이지에 적용 | PASS | `src/components/student/StudentDonationPage.tsx:16-19`; `public/donation-thanks-075x.gif`; 직접 본 4개 캡처 |
| SC-2 | 재생 속도 약 `0.75x` | PASS | Pillow 직접 검사: 원본 8x100ms=800ms, 출력 `[130,130,140,130,130,140,130,140]`=1070ms, 0.7477x |
| SC-3 | 완료 시에만 트리거하는 후속 동작을 이번 범위에 넣지 않음 | PASS | 컴포넌트에서 `<picture>`가 현재 상시 렌더링되며 완료 트리거 로직 추가 없음 |
| SC-4 | 1024/1280/1366 Chromebook 화면에서 온전한 반응형 표시 | PASS | `tmp/donation-animation-qa/1024.jpg`, `1280-frame-a.png`, `1280-frame-b.png`, `1366.jpg` 직접 검사; 잘림/겹침 없음. DOM 검사 기록은 각 뷰포트 overflow 없음 |
| SC-5 | 접근성/reduced motion | PASS | `StudentDonationPage.tsx:17`의 media source; poster가 GIF 첫 프레임과 RGBA 픽셀 단위 exact match |
| SC-6 | 투명 배경 보존 | PASS | GIF 89a 투명성 정보 및 poster RGBA alpha extrema `(0,255)`; 캡처에서 사각 배경 artifact 없음 |
| SC-7 | 기존 기부 기능 무결성 | PASS | 기존 `triggerRef`, disabled 조건, `onDonate` 호출, 금액/진행률 UI가 그대로 유지됨; 기부 클릭은 금지 조건에 따라 수행하지 않음 |

## Animation review

| Before | After | Why |
| --- | --- | --- |
| Finding 없음 | 변경 불필요 | 축하/감사 피드백이라는 정당한 목적, 현재 명시적 preview, 실제 모션 증거, reduced-motion 정지 프레임을 모두 충족 |

Decision: Approve. GIF 자체의 1070ms는 일반 UI 전환이 아니라 제공된 축하 캐릭터 시퀀스이므로 sub-300ms UI 규칙의 위반이 아니다. 현재 반복은 후속 완료 트리거 작업 전의 명시적 preview 요구사항이다.

## Programming and AI-slop pass

- 추가된 TSX는 네이티브 `<picture>`/`<source media>`를 사용해 별도 JS 상태, effect, 파서, 정규화, 의존성을 만들지 않는다.
- 불필요한 추상화, 중복 헬퍼, 타입 억제, `any`, dead code, debug 코드가 없다.
- 삭제만 검증하는 테스트, 요청 문구 pin, tautological/implementation-mirroring test가 추가되지 않았다.
- 기존 컴포넌트가 작고 범위가 좁으며 공용 API와 기부 mutation 경로는 그대로다.
- `npm run lint` (`tsc --noEmit`) 직접 실행: PASS.

## Checked artifacts

- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentDonationPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/public/donation-thanks-075x.gif`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/public/donation-thanks-poster.png`
- `/Users/ibyeonghyeon/Downloads/기부 애니메이션.gif`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/donation-animation-qa/1024.jpg`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/donation-animation-qa/1280-frame-a.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/donation-animation-qa/1280-frame-b.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/tmp/donation-animation-qa/1366.jpg`

## Evidence gaps and notes

- [evidence] `omo ulw-loop status --json` 실행 파일이 환경에 없어 fallback 경로에 보고서를 기록했다.
- [evidence] 별도의 reduced-motion 브라우저 캡처는 없다. 다만 네이티브 picture media 경로와 poster/첫 GIF 프레임의 exact RGBA 일치로 해당 기준은 직접 검증되었다.
- [evidence] 1280 캡처의 실제 PNG 폭은 1281px이다. 1024 및 1366 정확 폭 캡처와 DOM overflow 검사, 1281px의 온전한 레이아웃을 함께 볼 때 성공 기준 위반 증거는 아니다.
- [evidence] 독립 code-review report/manual-QA markdown 경로는 입력에 제공되지 않았다. 직접 소스·diff·자산·캡처·타이밍·typecheck를 재검증했으므로 승인 근거는 충분하다.
- [product] `DESIGN.md`와 `src/index.css`에는 동시에 진행 중인 서점 관련 변경이 섞여 있으나, 이 판정은 기부 애니메이션 관련 hunk와 산출물만 대상으로 했다.
