import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../../src/index.css';
import Card from '../../src/components/student/TodayFriendPartnerCard';
function Preview() {
  const [take,setTake]=useState(0);
  const [session]=useState(()=>Date.now());
  return <main className="student-today-friend-view" style={{height:'100dvh',padding:20,display:'grid',gridTemplateRows:'auto minmax(0,1fr)',gap:12}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong>카드 뽑기 미리보기</strong><button type="button" style={{minHeight:44,padding:'0 18px',border:'1px solid #b5c8b8',borderRadius:24,background:'#fffaf0'}} onClick={()=>setTake(v=>v+1)}>다시 보기</button></header>
    <div style={{width:'100%',maxWidth:560,minHeight:0,justifySelf:'center',display:'grid'}}><Card key={take} mission={{dateKey:`preview-${session}-${take}`,studentNumber:1,partnerNumber:5}} profileAssignments={{}}/></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
