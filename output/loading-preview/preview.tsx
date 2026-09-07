import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import StudentActionProgress from '../../src/components/student/StudentActionProgress';
import LoadingLabel from '../../src/components/LoadingLabel';
import GomaLoadingAnimation from '../../src/components/GomaLoadingAnimation';
function Preview() {
 const [active, setActive] = useState(false);
 const pose = new URLSearchParams(window.location.search).get("foot");
 const footTime = pose === "peak" ? .45 : pose === "back" ? .2 : null;
 return <>{footTime !== null && <style>{`.goma-foot-kick { animation-delay: -${footTime}s; animation-play-state: paused; }`}</style>}<nav style={{padding:16,display:'flex',gap:16}}><button onClick={()=>{setActive(true);window.setTimeout(()=>setActive(false),6000);}}>6초 처리 미리보기</button></nav>{active ? <StudentActionProgress isActive /> : <main className="runtime-fallback-page"><section className="runtime-fallback-surface"><GomaLoadingAnimation /><p role="status"><LoadingLabel /></p></section></main>}</>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
