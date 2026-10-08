import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TeacherInvestmentStatus, { getTeacherInvestmentSummary } from '../components/teacher/TeacherInvestmentStatus.tsx';
import { createStudentEconomyState, type StudentInvestmentPosition } from './studentEconomy.ts';

const position = (investedAmount: number, currentAmount: number, lastChangeAmount = 0): StudentInvestmentPosition => ({
  investedAmount, currentAmount, lastChangeAmount, lastSettledDateKey: '2026-10-01', lastStage: 'flat',
});

test('전체 등락은 종목별 마지막 등락이 아니라 보유 투자 전체의 원금 대비 손익으로 계산한다', () => {
  const summary = getTeacherInvestmentSummary({
    ...createStudentEconomyState(),
    investments: { sunny: position(100, 150, -10), sprout: position(200, 180, 10) },
  });
  assert.deepEqual(summary, { count: 2, invested: 300, current: 330, profit: 30, percent: 10, trend: 'up' });
});

test('손실, 상쇄된 손익, 전액 손실과 미투자를 구분한다', () => {
  const state = createStudentEconomyState();
  assert.equal(getTeacherInvestmentSummary({ ...state, investments: { sunny: position(100, 80) } }).trend, 'down');
  assert.equal(getTeacherInvestmentSummary({ ...state, investments: { sunny: position(100, 120), sprout: position(100, 80) } }).trend, 'flat');
  assert.equal(getTeacherInvestmentSummary({ ...state, investments: { sunny: position(100, 0) } }).percent, -100);
  assert.deepEqual(getTeacherInvestmentSummary(undefined), { count: 0, invested: 0, current: 0, profit: 0, percent: 0, trend: 'flat' });
});

test('23명의 번호와 수익·손실·미투자 상태를 표시하고 상세에는 종목별 금액과 반영 이유를 제공한다', () => {
  const state = createStudentEconomyState();
  const markup = renderToStaticMarkup(createElement(TeacherInvestmentStatus, {
    dateKey: '2026-10-01',
    states: {
      '1': { ...state, investments: { sunny: position(100, 120, 20) } },
      '2': { ...state, investments: { sunny: position(100, 80, -20) } },
      '3': { ...state, investments: { sunny: position(100, 100) } },
    },
    market: { sunny: [{ dateKey: '2026-10-01', stage: 'rise', returnPercent: 20, comment: '연습용: 판매량 증가' }] },
  }));
  assert.equal((markup.match(/aria-label="\d+번, /g) ?? []).length, 23);
  assert.match(markup, /class="is-up" aria-label="1번, 수익 20 고마"/);
  assert.match(markup, /class="is-down" aria-label="2번, 손실 20 고마"/);
  assert.match(markup, /class="is-flat" aria-label="3번, 변동 없음"/);
  assert.match(markup, /aria-label="23번, 투자 없음"/);
  assert.match(markup, /1번 세부 투자 현황/);
  assert.match(markup, /2026-10-01 반영/);
  assert.match(markup, /마지막 등락 \+20 고마/);
  assert.match(markup, /연습용: 판매량 증가/);
  assert.match(markup, /\+20%/);
});

test('학생이 다시 접속하지 않아도 등록한 등락을 즉시 표시하고 저장 상태는 보존한다', () => {
  const state = { ...createStudentEconomyState(), investments: { sunny: position(100, 100) } };
  const before = structuredClone(state);
  const render = (returnPercent: number, dateKey = '2026-10-02') => renderToStaticMarkup(createElement(TeacherInvestmentStatus, {
    states: { '1': state }, dateKey,
    market: { sunny: [{ dateKey: '2026-10-02', stage: returnPercent > 0 ? 'rise' : 'fall', returnPercent, comment: '' }] },
  }));
  assert.match(render(20), /class="is-up" aria-label="1번, 수익 20 고마"/);
  assert.match(render(-20), /class="is-down" aria-label="1번, 손실 20 고마"/);
  assert.match(render(20), /2026-10-02 반영/);
  assert.match(render(20), /마지막 등락 \+20 고마/);
  assert.match(render(20, '2026-10-01'), /class="is-flat" aria-label="1번, 변동 없음"/);
  assert.deepEqual(state, before);
});
