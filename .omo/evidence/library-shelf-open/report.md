# 책장 열기 통일

`CanvasLibraryGame.tsx`에서 shelf/placed-book의 직접 상호작용을 하나로 합쳤다. 운반 여부와 관계없이 `책장 열기` cue와 slots modal을 사용한다. 열린 책장 내부에서 책을 고르면 기존 details modal을 보여준다. 저장·대상 판정·캐릭터·레이아웃은 변경하지 않았다.

실패 증거: `before.json`의 네 책장 모두 cue=책 정보, openedShelf=false.
최종 증거: `after.json` 네 책장 모두 cue=책장 열기, openedShelf=true. E/ㄷ/Enter/클릭, 내부 책 선택 및 Escape 포커스 복귀를 실제 컴포넌트 브라우저에서 실행했다. 24개의 최신 PNG는1280×800이고 소스 해시 불변, 페이지 오류0. 합성 책/책 가장자리 시작점만 주입한 fixture이며 실데이터 쓰기는 없다.

타입 검사·전체 테스트669개·빌드 통과. 초기 QA fixture import/첫 프레임 대기는 하네스에서 수정했으며 제품 코드 원인으로 취급하지 않았다.

독립 검토 `integrity.md`, `visual.md` 모두 PASS. 두 검토 모두 현재 소스 해시와 24개 최신 캡처를 확인했다. 기능 검토자가 타입 검사·669개 테스트·빌드를 재실행하여 통과했다.

정리: QA 전용 서버 PID72169 종료 후 `lsof -nP -iTCP:3046 -sTCP:LISTEN` 결과 없음 확인. 격리 Chrome은 QA 스크립트의 finally에서 종료했다. 사용자 localhost3000 서버와 실데이터는 변경하지 않았다.
