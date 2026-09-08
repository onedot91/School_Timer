import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import TodayFriendMissionForm from '../../src/components/student/TodayFriendMissionForm.tsx';
import '../../src/index.css';
const original = { dateKey: '2000-01-03', studentNumber: 17, partnerNumber: 2, genre: 'interview', question: '격리된 QA 질문', submission: null };
function App() {
  const [mission, setMission] = useState(original);
  const [isSaving, setSaving] = useState(false);
  const [pendingPayload, setPending] = useState(undefined);
  const [outcome, setOutcome] = useState('');
  const [success, setSuccess] = useState(false);
  const save = async (payload) => {
    setSaving(true); setOutcome('saving');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    setPending(success ? undefined : payload);
    setOutcome(success ? 'confirmed' : 'unconfirmed');
    return success;
  };
  return <main style={{height:'100dvh',padding:12,display:'flex',flexDirection:'column',gap:8}}>
    <div style={{display:'flex',gap:12,flexShrink:0}}>
      <button onClick={() => setMission({...original, submission:{id:'fixture',revision:2,status:'draft',payload:{kind:'interview',answer:'늦게 도착한 서버 내용'}}})}>늦은 서버 응답</button>
      <button onClick={() => setSuccess(true)}>다음 저장 성공</button>
      <output aria-label="QA result">{outcome}</output>
    </div>
    <section className="student-today-friend-guide" style={{minHeight:0,flex:1}}>
      <TodayFriendMissionForm mission={mission} isSaving={isSaving} pendingPayload={pendingPayload} onSave={save} onSendRecommendation={async()=>true}/>
    </section>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
