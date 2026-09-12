import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import StudentActionProgress from '../../src/components/student/StudentActionProgress';
import LoadingLabel from '../../src/components/LoadingLabel';
import GomaLoadingAnimation, { gomaLoadingVariants, type GomaLoadingVariant } from '../../src/components/GomaLoadingAnimation';

const names = { flight: '연필 비행', jumping: '통통 책 점프', parachute: '민들레 낙하산', skating: '스케이트 질주', sailing: '종이배 파도타기', bubble: '비눗방울 여행', train: '구름 기차', moon: '달 그네', rocket: '별 로켓', carrot: '당근 자동차', random: '랜덤' };
const descriptions = {
  random: '열 종류 중 하나를 선택합니다 · 각 10%',
  bubble: '둥실둥실 떠오르기 · 작은 비눗방울',
  train: '덜컹덜컹 달리는 기차 · 몽글몽글 구름',
  moon: '초승달을 타고 그네 타기 · 반짝이는 별',
  rocket: '별을 향해 가속 · 뒤로 흩어지는 별가루',
  carrot: '통통 달리는 당근 자동차 · 흩날리는 초록 잎',
  skating: '빠르게 질주 · 가벼운 점프 · 속도선과 별가루',
  sailing: '파도 따라 오르내리기 · 물결과 물방울',
  flight: '상하 비행 · 눈 깜빡임 · 구름 이동',
  jumping: '발 구르기 → 높이 점프 → 착지 · 별가루',
  parachute: '좌우 활공 · 바람에 떠오르기 · 흩날리는 씨앗',
};
function Preview() {
  const [variant, setVariant] = useState<GomaLoadingVariant | 'random'>('random');
  const [draw, setDraw] = useState(0);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setActive(false), 6000);
    return () => window.clearTimeout(timer);
  }, [active]);
  const [paused, setPaused] = useState(false);
  return <main className="goma-preview">
    <nav aria-label="로딩 종류">{(['random', ...gomaLoadingVariants] as const).map(value => <button key={value} aria-pressed={variant === value} onClick={() => {setVariant(value);}}>{names[value]}</button>)}</nav>
    <section className="runtime-fallback-surface goma-preview-card" data-paused={paused}>
      <GomaLoadingAnimation key={draw} variant={variant} />
      <p role="status"><LoadingLabel /></p>
    </section>
    <div className="goma-preview-controls">
      <button onClick={() => {setVariant('random'); setDraw(value => value + 1);}}>다시 뽑기</button>
      <button onClick={() => setActive(true)}>6초 처리 미리보기</button>
      <button onClick={() => {setPaused(!paused);}}>{paused ? '재생' : '일시정지'}</button>
    </div>
    <p>{descriptions[variant]}</p>
    {variant !== 'flight' && variant !== 'random' && <details><summary>구현 보기</summary><p>{descriptions[variant]} — 캐릭터와 주변 파티클의 속도·방향을 따로 조절합니다. 동작 줄이기 설정에서는 움직임을 멈춥니다.</p><img src={`/images/loading/goma-${variant === 'moon' ? 'moon-side' : variant === 'parachute' ? 'parachute-arms' : variant}.webp`} alt={`${names[variant]} 원화`} /></details>}
    <StudentActionProgress isActive={active} />
  </main>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
