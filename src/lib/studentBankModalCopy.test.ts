import assert from 'node:assert/strict';
import test from 'node:test';

import { STUDENT_BANK_RULES } from '../components/student/StudentBankPage.tsx';

test('은행 모달 규칙은 가운데점 없이 초3이 읽기 쉬운 항목으로 안내한다', () => {
  assert.deepEqual(STUDENT_BANK_RULES, {
    deposit: [
      { term: '예금 만기', explanation: '월요일부터 수요일에 맡기면 이틀 뒤에 받아요. 목요일이나 금요일에 맡기면 다음 주 월요일에 받아요.' },
      { term: '중도 해지', explanation: '약속한 날보다 일찍 찾으면 이자는 없고 맡긴 고마만 받아요.' },
    ],
    loan: [
      { term: '대출 한도', explanation: '한 번에 최대 50고마까지 빌릴 수 있어요.' },
      { term: '상환 기한', explanation: '빌린 날부터 일주일 안에 모두 갚아야 해요.' },
    ],
    repayment: [
      { term: '전액 상환', explanation: '남은 고마를 한 번에 모두 갚아요.' },
    ],
    transfer: [
      { term: '송금 한도', explanation: '한 번에 최대 30고마까지 보낼 수 있어요.' },
      { term: '송금 횟수', explanation: '하루에 한 명에게 한 번만 보낼 수 있어요.' },
    ],
  });

  assert.equal(Object.values(STUDENT_BANK_RULES).flat().some(({ term, explanation }) => `${term}${explanation}`.includes('·')), false);
});
