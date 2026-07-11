# Apple Design UI Refresh Draft

- intent: unclear
- review_required: true
- classification: architecture
- status: superseded
- pending_action: none; canonical plan is `.omo/plans/apple-ui-refresh-plan.md`

## Goal

기존 기능, 한국어 문구, 캐릭터 자산, 저장 데이터 계약을 유지하면서 관리자 타이머, 학생 경매, 랜덤 추첨, 설정·보조 화면의 시각 체계와 상호작용을 Apple Design 원칙에 맞게 통일한다. 불필요한 설명 문구는 추가하지 않는다.

## Components

1. 공통 디자인 토큰과 접근성: 색상, 시스템 서체, 재질, 그림자, 포커스, 눌림 피드백, reduced motion/transparency/contrast.
2. 관리자 타이머: 주 타이머, 일정 패널, 하단 도구 모음, 공지·메모·보조 화면의 계층과 반응형 배치.
3. 학생 경매: 상태 요약, 입찰 흐름, 결과 연출, 모바일 조작 영역의 명료성.
4. 랜덤 추첨: 추첨 무대, 기록, 설정 패널의 정보 계층과 모션 절제.
5. 진입 화면과 공통 오버레이: 선택 화면, 모달·시트의 공간적 출처와 닫힘 경로.
6. 검증: TypeScript/build, 실제 브라우저 흐름, 데스크톱·모바일, CJK 줄바꿈, 콘솔 오류, 접근성 미디어 쿼리.

## Open Assumptions

| Assumption | Adopted default | Rationale | Reversible |
| --- | --- | --- | --- |
| Apple식 표현의 범위 | macOS/iPadOS의 차분한 생산성 UI를 기준으로 적용 | 교실 운영 도구의 높은 정보 밀도와 큰 화면 사용에 적합 | yes |
| 브랜드 자산 | 학생 캐릭터와 따뜻한 녹색 포인트는 유지 | 제품 정체성과 수업 맥락을 보존 | yes |
| 장식 밀도 | 배경 오브·점무늬·중첩 테두리는 축소 | 내용과 조작 대상의 우선순위를 강화 | yes |
| 타이포그래피 | 플랫폼 시스템 서체 우선, 숫자만 등폭 유지 | Apple 원칙의 가독성과 광학 크기 대응 | yes |
| 모션 | 직접 조작 피드백은 즉시, 상태 전환은 무반동 스프링, 축하 연출만 제한적 탄성 | 과한 움직임 없이 인과성과 연속성 확보 | yes |
| 문구 | 기존 문구 유지, 접근성 이름 외 새 안내 문구 금지 | 사용자 제약 준수 | yes |
| 데이터·기능 | 저장 키, Supabase 계약, 화폐·입찰·추첨 로직은 변경하지 않음 | UI 범위 밖의 회귀 방지 | yes |

## Approach

1. `src/index.css`의 후반 중복 오버라이드까지 정리해 공통 토큰과 재사용 가능한 surface/control 상태를 만든다.
2. `TimerPage.tsx`와 관련 오버레이를 새 토큰에 연결하고, 큰 화면과 모바일에서 타이머 우선순위를 유지한다.
3. `AuctionPage.tsx`와 `AuctionRoom.tsx`의 카드 중첩을 줄이고 입찰 상태·행동의 대비를 강화한다.
4. `RandomDrawPage.tsx`와 진입 화면을 같은 재질·타이포그래피·모션 체계로 통일한다.
5. `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast`를 전 화면에 적용한다.
6. `npm run lint`, `npm run build` 후 실제 브라우저에서 관리자·학생·추첨 화면을 데스크톱과 모바일로 검증하고, 독립 리뷰를 통과할 때까지 수정한다.

## Must Not Have

- 새 기능, 새 라이브러리, 새 설명 문구
- 저장 데이터·Supabase·화폐·입찰·추첨 로직 변경
- 캐릭터 자산 제거 또는 외부 이미지 추가
- 반투명 표면의 중첩, 과도한 블러, 반복 루프 애니메이션 증가
- 모바일 텍스트 잘림, 한국어 조사·어절의 부자연스러운 단독 줄바꿈
