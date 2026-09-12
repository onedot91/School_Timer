import { STUDENT_HOUSE_DESIGNS, type StudentEconomyAction } from './studentEconomy.js';
import { formatStudentNumberLabel } from './studentIdentity.js';
import type { StudentLetter } from './studentLife.js';

export const HOUSE_CREATOR_REWARD = 10;
export const HOUSE_MAIL_SENDER = '목수 고키리';
export const HOUSE_MAIL_STAMP = '/(편지용) 고키리.png';

export const createHousePurchaseLetter = ({ action, studentNumber, applied, createdAt }: {
  action: StudentEconomyAction;
  studentNumber: number;
  applied: boolean;
  createdAt: string;
}): Omit<StudentLetter, 'readAt' | 'replyToId'> | null => {
  if (!applied || action.type !== 'buy_house') return null;
  const house = STUDENT_HOUSE_DESIGNS.find(({ id }) => id === action.houseId);
  if (!house || !('creatorStudentNumber' in house) || house.creatorStudentNumber === studentNumber) return null;
  return {
    id: `house-sale-${house.id}-${studentNumber}`,
    recipient: house.creatorStudentNumber,
    senderLabel: HOUSE_MAIL_SENDER,
    senderStudentNumber: null,
    title: '멋진 집이 팔렸어요!',
    content: `${formatStudentNumberLabel(studentNumber)} 친구가 네가 만든 ‘${house.name}’을 샀어! 멋진 집을 만들어 준 보답으로 ${HOUSE_CREATOR_REWARD}고마를 넣어 두었단다. 앞으로도 멋진 집을 만들어 줘!`,
    createdAt,
  };
};
