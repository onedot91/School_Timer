import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import TeacherInvestmentStatus from '../src/components/teacher/TeacherInvestmentStatus';
import { createStudentEconomyState, normalizeStudentEconomyStates } from '../src/lib/studentEconomy';
const base = createStudentEconomyState();
const position = (investedAmount: number, currentAmount: number, lastChangeAmount: number) => ({investedAmount, currentAmount, lastChangeAmount, lastStage: 'flat', lastSettledDateKey: '2026-10-01'});
const states = normalizeStudentEconomyStates({
  1: {...base, investments: {sunny: position(100,120,20), sprout: position(100,90,-10), cloud: position(200,200,0), star: position(50,55,5)}},
  2: {...base, investments: {sunny: position(100,80,-20)}},
  3: {...base, investments: {sunny: position(100,100,0)}},
  23: {...base, investments: {star: position(100,0,-100)}},
});
const market = {sunny:[{dateKey:'2026-10-01',stage:'rise' as const,returnPercent:20,comment:'연습용: 신제품 판매량이 늘었어요.'}]};
createRoot(document.getElementById('root')!).render(
  <div className="teacher-settings-theme" style={{height:'100dvh',padding:'5dvh 5vw'}}>
    <div className="settings-dialog app-settings-modal" style={{height:'90dvh',width:'90vw',maxHeight:'none',display:'grid',gridTemplateRows:'62px minmax(0,1fr)',margin:0}}>
      <header className="settings-header" style={{padding:'1rem'}}>투자 현황 · 연습용 데이터</header>
      <div style={{display:'grid',gridTemplateColumns:'208px minmax(0,1fr)',minHeight:0}}>
        <aside style={{padding:'1rem'}}>증권 · 투자 현황</aside>
        <section className="settings-content"><div className="settings-body teacher-stock-investments-body" style={{padding:13}}>
          <section className="settings-card teacher-stock-settings">
            <nav className="teacher-stock-tabs"><button>주간 등락</button><button>일괄 등록</button><button>운영 규칙</button><button aria-selected="true">투자 현황</button></nav>
            <div className="teacher-stock-week"><div className="teacher-stock-tab-panel" id="teacher-stock-panel-students"><TeacherInvestmentStatus states={states} market={market}/></div></div>
          </section>
        </div></section>
      </div>
    </div>
  </div>
);
