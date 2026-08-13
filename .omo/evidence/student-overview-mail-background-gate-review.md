# Gate Review: student overview mail backgrounds

- recommendation: APPROVE
- blockers: []
- originalIntent: 학생 개요의 16:9 캔버스 배경을 사용자가 지정한 읽지 않은 우편/일반 상태 PNG로 정확히 교체하고 기존 `data-unread-mail` 상태 연결을 유지한다.
- desiredOutcome: `#student-overview`에서 실제 DOM 오버레이와 핫스팟이 유지되고, 읽지 않은 우편 여부에 맞는 1920×1080 배경이 표시되며 1280×800에서 정렬과 overflow 문제가 없다.
- userOutcomeReview: 요구한 일반 상태가 localhost에서 정확히 렌더링되며, 소스의 unread 분기 역시 지정된 unread 자산으로 직접 매핑된다. 실제 DOM 오버레이와 두 핫스팟은 캔버스 내부에 있고 이미지의 우편함/책방 위치와 정렬된다. 페이지 전체 overflow는 없다.

## Success criteria review

1. Exact user assets: PASS. SHA-256가 원본과 public 복사본 사이에서 각각 일치한다.
   - no unread: `2f93ccc2e6e7414cfedfc40d95ef6a78d84d467d1c8902c0e61be0704554fa19`
   - unread: `775cd45e55bd108e8d9745a161528612408aaeae9aeb838901e0c7659027cef8`
2. State mapping: PASS. `.student-character-stage-card`는 `/student-home-mail.png`, `[data-unread-mail="true"]`는 `/student-home-mail-unread.png`를 사용한다. `StudentPetStage.tsx`가 boolean을 `true`/`false` 속성으로 전달한다. 런타임 일반 상태는 `false`와 일반 배경 URL을 함께 확인했다.
3. Real DOM overlay remains: PASS. stage에는 5개 자식이 있으며 house, goma, mailbox hotspot, library hotspot이 실제 DOM 요소로 존재한다.
4. 16:9: PASS. 두 자산은 1920×1080이며 실제 stage는 829.328×466.492px, ratio 1.777796, computed `aspect-ratio: 16 / 9`이다.
5. Hotspot alignment: PASS. 1280×800 screenshot과 DOM bounds에서 mailbox와 library hotspot이 이미지 대상 위에 놓이고 모두 stage 내부에 있다.
6. Overflow: PASS. document/body scroll size와 client/viewport가 모두 1280×800이며 stage `overflow: hidden`이다.
7. Functional integrity: PASS. `npm run lint`와 `npm run build` 성공. build에는 기존 성격의 chunk-size warning만 있다.

## Direct programming and remove-ai-slops pass

- 관련 변경은 두 binary asset 교체와 기존 CSS 상태 매핑이다. 새 parsing, normalization, production extraction, abstraction은 없다.
- 요청 제거만 검증하는 테스트, tautological/implementation-mirroring test, deletion-only test, 과도한 테스트 추가는 없다.
- 동일 background mapping 규칙이 CSS에 두 번 나타나는 중복은 있으나 동일 선언이고 이번 성공 기준을 위반하지 않아 NOTE로만 기록한다.
- 작업 트리에는 본 요청과 무관한 다수 변경이 함께 존재한다. 관련 파일과 렌더 경로만 범위로 삼았으며 범위 밖 변경은 승인 근거로 사용하지 않았다.

## Checked artifact paths

- `/Users/ibyeonghyeon/Downloads/집앞/집터2(알림).png`
- `/Users/ibyeonghyeon/Downloads/집앞/집터2(알림X).png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/public/student-home-mail-unread.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/public/student-home-mail.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentPetStage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentOverviewPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/pages/AuctionPage.tsx`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css`
- `http://localhost:3000/#student-overview` at 1280×800

## Evidence gaps

- `omo ulw-loop status --json`를 실행할 수 없었다 (`omo: command not found`), 따라서 지시된 fallback 경로에 이 보고서를 작성했다.
- 제공된 code review report/manual QA matrix/notepad는 이 좁은 요청에 대해 발견되지 않았다. 직접 source, binary hashes, computed DOM, screenshot, lint, build로 기준을 재현했다.
- 실제 저장 데이터를 변경하지 말라는 제약 때문에 unread 런타임 상태를 강제로 만들지 않았다. unread 매핑은 동일 DOM 속성의 production source와 CSS selector로 검증했다. 이는 명시된 읽기 전용 QA 제약에 따른 비차단 evidence gap이다.
