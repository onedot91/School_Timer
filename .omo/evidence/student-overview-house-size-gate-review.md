# Student Overview House Size — Gate Review

- recommendation: APPROVE
- blockers: []
- originalIntent: 현재 및 향후 중앙 집 자산을 일회성 이미지 배율이 아닌 공용 프레임으로 조금 크게 표시하면서 지면 정렬을 유지하고 클리핑과 겹침을 방지한다.
- desiredOutcome: 데스크톱 학생 개요에서 집이 46% × 85% 공용 프레임을 사용하고, 캔버스 하단 12% 기준에 정렬되며 주변 캐릭터·건물·캔버스 경계를 침범하지 않는다.
- userOutcomeReview: 캡처의 집은 637×358px 캔버스 안에서 292×303px이며 하단 간격은 44px이다. 이는 46%/85% 토큰 및 bottom 12%와 일치한다. 집은 캔버스에 잘리지 않고, 우체통·곰·책방과 시각적으로 분리되어 있으며 지면선에 자연스럽게 놓인다. `StudentPetStage`의 수리 전·후 자산이 모두 같은 `student-home-house` 요소를 사용하므로 특정 이미지에만 적용된 배율이 아니다.

## Checked artifacts

- `/private/tmp/school-timer-overview-house-size.png`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/DESIGN.md:76`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:15297`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/index.css:16233`
- `/Users/ibyeonghyeon/Documents/GitHub/School_Timer/src/components/student/StudentPetStage.tsx:112`

## Direct slop / programming pass

- 공용 크기 값은 `DESIGN.md`와 CSS custom properties에 정의되고 단일 공용 클래스에서 소비된다.
- 자산별 배율 분기, 불필요한 추출·정규화, 삭제 검증용·동어반복·구현 복제 테스트는 이 변경 범위에서 발견되지 않았다.
- 기존 하단 정렬 방식(`bottom`, `object-position: center bottom`)을 유지해 범위 이탈이나 유지보수 부담을 만들지 않는다.

## Evidence gaps / notes

- `omo ulw-loop status --json`은 로컬에서 `omo` 명령을 찾지 못해 실행되지 않았다. ULW 계획 경로를 확인할 수 없어 규정된 fallback 경로를 사용했다.
- 제공된 범위는 데스크톱 한 페이지·한 상태이며, 이 범위에서 판정을 막는 증거 공백은 없다.
