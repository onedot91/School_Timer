import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import StudentShopPage from '../src/components/student/StudentShopPage';
import { applyStudentEconomyAction, createStudentEconomyState, type StudentEconomyAction } from '../src/lib/studentEconomy';
import { FAILURE_PROFILE_IMAGES } from '../src/lib/failureExhibition';
import { appDataMode } from '../src/lib/dataMode';
import '../src/index.css';

function Review() {
  const [state, setState] = useState(createStudentEconomyState);
  const [balance, setBalance] = useState(2000);
  const [saving, setSaving] = useState(false);
  const [response, setResponse] = useState('success');
  const [requests, setRequests] = useState(0);
  const [version, setVersion] = useState(0);
  const purchase = async (action: StudentEconomyAction) => {
    setSaving(true);
    setRequests(count => count + 1);
    try {
      await new Promise(resolve => setTimeout(resolve, response === 'slow' ? 2500 : 250));
      if (response === 'failure') return false;
      if (response === 'error') throw new Error('MOCK_SAVE_FAILED');
      const result = applyStudentEconomyAction({ state, action, wallet: balance, availableWallet: balance, requestId: `house-review-${requests}` });
      setState(result.state);
      setBalance(result.wallet);
      return true;
    } finally { setSaving(false); }
  };
  return <>
    <main style={{ height: '100dvh', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 12, padding: 20, background: '#fffaf0' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14 }}>
        <strong>집 모션 · 로컬 mock 검수</strong>
        <label>저장 응답 <select aria-label="저장 응답" value={response} onChange={event => setResponse(event.target.value)}><option value="success">성공</option><option value="failure">실패</option><option value="error">예외</option><option value="slow">2.5초 지연</option></select></label>
        <a href={location.search ? "/dev/house-review.html" : "/dev/house-review.html?motion=reduce"}>{location.search ? "일반 모션 검수" : "동작 줄이기 검수"}</a>
        <button disabled={saving} onClick={() => { setState(createStudentEconomyState()); setBalance(2000); setRequests(0); setVersion(value => value + 1); }}>처음부터</button>
        <output aria-label="검수 상태">잔액 {balance} · 요청 {requests} · {saving ? '저장 중' : '대기'}</output>
      </header>
      <StudentShopPage key={version} studentNumber={1} profileAssignments={{ '1': FAILURE_PROFILE_IMAGES[0] }} state={state} availableBalance={balance} isSaving={saving} onAction={purchase} onSelectProfile={async () => ({ ok: false, message: '집 모션 검수 전용입니다.' })} />
    </main>
  </>;
}
const root = document.getElementById('root');
if (root && import.meta.env.DEV && appDataMode === 'mock') {
  if (new URLSearchParams(location.search).get('motion') === 'reduce') {
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = query => {
      const media = matchMedia(query);
      if (!query.includes('prefers-reduced-motion')) return media;
      return new Proxy(media, { get: (target, key) => {
        if (key === 'matches') return true;
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      } });
    };
  }
  const reviewRoot = createRoot(root);
  reviewRoot.render(<Review />);
  import.meta.hot?.dispose(() => reviewRoot.unmount());
}
