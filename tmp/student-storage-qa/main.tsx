import React, {useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import StudentMailboxPage from '../../src/components/student/StudentMailboxPage';
import StudentEmotionPage from '../../src/components/student/StudentEmotionPage';
import {FailureComposerDialog} from '../../src/components/student/FailureComposerDialog';
import {executeStudentStorageCommand,loadStudentStorageFormDraft,saveStudentStorageFormDraft,hasUnconfirmedStudentStorageDraft} from '../../src/lib/studentStorageCommand';
import {STUDENT_EMOTIONS,getKoreanLocalDateKey} from '../../src/lib/studentEmotion';
import '../../src/index.css';
let accepts=new URL(location.href).searchParams.has('allow');
const receipts=new Map();
const nativeFetch=globalThis.fetch;
globalThis.fetch=async (url,init)=>{
  if(!String(url).startsWith('/api/')) return nativeFetch(url,init);
  if(String(url).startsWith('/api/shared-settings')){
    if(init?.method==='POST'){
      const body=JSON.parse(String(init.body));
      if(new URL(location.href).searchParams.has('reject')&&!accepts)return Response.json({error:'STUDENT_COMMAND_INVALID'},{status:400});
      if(!accepts)return Response.json({error:'SIMULATED_TIMEOUT'},{status:502});
      const response={value:{studentLife:{letters:[]}},updatedAt:new Date().toISOString(),result:{applied:true}};
      receipts.set(body.requestId,response);
      return Response.json(response);
    }
    const id=new URL(String(url),'http://localhost').searchParams.get('requestId');
    return Response.json(receipts.get(id)??{status:'unknown'});
  }
  return Response.json({ok:true});
};
function Harness(){
  const [view,setView]=useState(new URL(location.href).searchParams.get('view')??'mail');
  const [saving,setSaving]=useState(false), [revision,refresh]=useState(0), [done,setDone]=useState('');
  const trigger=useRef(null),studentNumber=1,dateKey=getKoreanLocalDateKey();
  const action=view==='mail'?'student.letter.send':view==='emotion'?'student.emotion.save':'student.failure.create';
  const entity=view==='emotion'?dateKey:action;
  const raw=loadStudentStorageFormDraft(studentNumber,action,entity);
  const saveDraft=(payload)=>{saveStudentStorageFormDraft(studentNumber,action,payload,entity);refresh(x=>x+1);};
  const save=async(payload)=>{setSaving(true);try{await executeStudentStorageCommand(studentNumber,action,payload,entity);setDone('저장 확인 완료');return true;}catch{setDone('미확인 상태');return false;}finally{setSaving(false);refresh(x=>x+1);}};
  const pending=hasUnconfirmedStudentStorageDraft(studentNumber,action,entity);
  return <div style={{height:'100dvh',padding:8,background:'#f6f4ec'}}>
    <div style={{display:'flex',gap:8,height:44,alignItems:'center'}}>
      <button ref={trigger} onClick={()=>{accepts=true;setDone('성공 응답 준비');}}>저장 성공 허용</button><span role="status">{done}</span><a href="?view=mail">메일</a><a href="?view=emotion">감정</a><a href="?view=failure">실패</a>
    </div>
    <div style={{height:'calc(100% - 44px)'}}>
    {view==='mail'?<StudentMailboxPage studentNumber={1} profileAssignments={{}} letters={[]} sentLetters={[]} unreadCount={0} isSaving={saving} onRead={async()=>{}} onSend={(title,content,replyToId)=>save({recipient:0,title,content,...(replyToId?{replyToId}:{})})} onBack={()=>{}} draft={typeof raw.content==='string'?{title:String(raw.title??''),content:raw.content,...(raw.replyToId?{replyToId:String(raw.replyToId)}:{})}:undefined} hasPendingSave={pending} onDraftChange={d=>saveDraft({recipient:0,...d})}/>:null}
    {view==='emotion'?<StudentEmotionPage todayEntry={null} history={[]} isSaving={saving} onSave={(emotionId,comment,selfMessage)=>save({emotionId,comment,selfMessage})} onBack={()=>{}} draft={typeof raw.comment==='string'?{emotionId:STUDENT_EMOTIONS.find(e=>e.id===raw.emotionId)?.id??null,comment:raw.comment,selfMessage:String(raw.selfMessage??'')}:undefined} hasPendingSave={pending} onDraftChange={saveDraft}/>:null}
    {view==='failure'?<FailureComposerDialog isSaving={saving} onCreate={(failure,lesson)=>save({failure,lesson})} onClose={()=>setView('closed')} onSaved={()=>setView('closed')} returnFocusRef={trigger} savedDraft={typeof raw.failure==='string'?{failure:raw.failure,lesson:String(raw.lesson??'')}:undefined} hasPendingSave={pending} onDraftChange={saveDraft}/>:null}
    </div>
  </div>
}
createRoot(document.getElementById('root')).render(<Harness/>);
