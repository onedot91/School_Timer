import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { getAuctionBidAmountIssue, getStudentBankAmountIssue } from './studentAmountIssue.js';

test('은행 금액은 버튼을 막는 규칙과 같은 이유를 한 줄로 알려 준다', () => {
  assert.equal(getStudentBankAmountIssue('deposit', ''), null);
  assert.deepEqual(getStudentBankAmountIssue('deposit', '5'), { reason: 'below_minimum', message: '10고마부터 맡길 수 있어요.' });
  assert.equal(getStudentBankAmountIssue('deposit', '10'), null);
  assert.deepEqual(getStudentBankAmountIssue('deposit', '12.5'), { reason: 'format', message: '소수점 없이 숫자만 써요.' });
  assert.deepEqual(getStudentBankAmountIssue('loan', '0'), { reason: 'below_minimum', message: '1고마부터 빌릴 수 있어요.' });
  assert.deepEqual(getStudentBankAmountIssue('loan', '51'), { reason: 'above_maximum', message: '50고마까지 빌릴 수 있어요.' });
  assert.equal(getStudentBankAmountIssue('loan', '50'), null);
  assert.deepEqual(getStudentBankAmountIssue('transfer', '31'), { reason: 'above_maximum', message: '30고마까지 보낼 수 있어요.' });
  assert.equal(getStudentBankAmountIssue('transfer', ' 30 '), null);
});

test('입찰 금액은 최소·최대 범위와 모자란 고마를 알려 준다', () => {
  assert.equal(getAuctionBidAmountIssue({ draft: '', amount: 0, minimumBid: 10, maxBid: 50 }), null);
  assert.equal(getAuctionBidAmountIssue({ draft: '5', amount: 5, minimumBid: 10, maxBid: 50 }), '10고마부터 입찰할 수 있어요.');
  assert.equal(getAuctionBidAmountIssue({ draft: '60', amount: 60, minimumBid: 10, maxBid: 50 }), '50고마까지 입찰할 수 있어요.');
  assert.equal(getAuctionBidAmountIssue({ draft: '20', amount: 20, minimumBid: 10, maxBid: 50 }), null);
  assert.equal(getAuctionBidAmountIssue({ draft: '', amount: 0, minimumBid: 30, maxBid: 20 }), '고마가 모자라요. 30고마가 있어야 입찰할 수 있어요.');
});

test('은행 창은 이미 적힌 규칙을 강조하고, 규칙에 없는 이유만 한 줄로 보여 주며 입력칸과 연결한다', async () => {
  const [bank, page, css] = await Promise.all([
    readFile(new URL('../components/student/StudentBankPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../pages/AuctionPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../index.css', import.meta.url), 'utf8'),
  ]);
  assert.match(bank, /deposit: \{ below_minimum: '최소 금액' \},\n  loan: \{ above_maximum: '대출 한도' \},\n  transfer: \{ above_maximum: '송금 한도' \},/);
  assert.match(bank, /lineMessage: issue && !highlightedTerm \? issue\.message : null,/);
  for (const kind of ['deposit', 'loan', 'transfer']) {
    const view = `${kind}Issue`;
    assert.match(bank, new RegExp(`aria-describedby=\\{${view}\\.describedBy\\}`));
    assert.match(bank, new RegExp(`<AmountIssue id="student-bank-${kind}-issue" issue=\\{${view}\\.lineMessage\\} />`));
    assert.match(bank, new RegExp(`highlightedTerm=\\{${view}\\.highlightedTerm\\} highlightId="student-bank-${kind}-rule"`));
  }
  assert.match(page, /aria-describedby="auction-bid-amount-issue"/);
  assert.match(page, /<p id="auction-bid-amount-issue" className="student-amount-issue auction-bid-amount-issue" aria-live="polite">/);
  assert.match(css, /\.auction-bid-amount-issue \{ min-height: 1\.4em; margin-top: \.4rem; \}\n\.auction-bid-amount-issue:empty \{ display: block; \}/);
  const keyframesStart = css.indexOf('@keyframes student-amount-settle');
  assert.doesNotMatch(css.slice(keyframesStart, css.indexOf('\n}', keyframesStart)), /opacity/);
});
