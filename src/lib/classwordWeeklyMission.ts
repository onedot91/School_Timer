interface ClasswordMissionData {
  readonly studentNumber: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly wordEntryDates: readonly string[];
  readonly quizCorrectDates: readonly string[];
}

export interface ClasswordMissionStatus {
  readonly data: ClasswordMissionData;
}

export interface KoreanWeekDateRange {
  readonly startDate: string;
  readonly endDate: string;
  readonly today: string;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const formatUtcDateKey = (date: Date) => date.toISOString().slice(0, 10);

export const getKoreanWeekDateRange = (date = new Date()): KoreanWeekDateRange => {
  const koreanTime = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const today = new Date(Date.UTC(
    koreanTime.getUTCFullYear(),
    koreanTime.getUTCMonth(),
    koreanTime.getUTCDate(),
  ));
  const weekday = today.getUTCDay() || 7;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - weekday + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    startDate: formatUtcDateKey(monday),
    endDate: formatUtcDateKey(sunday),
    today: formatUtcDateKey(today),
  };
};

const parseDateList = (value: unknown) => {
  if (!Array.isArray(value) || !value.every((date) => typeof date === 'string' && DATE_KEY_PATTERN.test(date))) {
    throw new Error('CLASSWORD_MISSION_INVALID_RESPONSE');
  }
  return value;
};

export const parseClasswordMissionStatus = (
  value: unknown,
  studentNumber: number,
  startDate: string,
  endDate: string,
): ClasswordMissionStatus => {
  if (!isRecord(value) || !isRecord(value.data)) {
    throw new Error('CLASSWORD_MISSION_INVALID_RESPONSE');
  }

  const data = value.data;
  if (
    data.studentNumber !== studentNumber ||
    data.startDate !== startDate ||
    data.endDate !== endDate
  ) {
    throw new Error('CLASSWORD_MISSION_INVALID_RESPONSE');
  }

  return {
    data: {
      studentNumber,
      startDate,
      endDate,
      wordEntryDates: parseDateList(data.wordEntryDates),
      quizCorrectDates: parseDateList(data.quizCorrectDates),
    },
  };
};

export const getClasswordMissionEvidence = (
  status: ClasswordMissionStatus,
  today: string,
) => ({
  wordEntryEventDate: status.data.wordEntryDates.find((date) => (
    date >= status.data.startDate && date <= status.data.endDate && date < today
  )) ?? null,
  quizCorrectEventDate: status.data.quizCorrectDates.find((date) => (
    date >= status.data.startDate && date <= status.data.endDate && date <= today
  )) ?? null,
});
