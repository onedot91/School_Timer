export const PERSONAL_QUESTION_WEEKLY_MISSION_TYPE = 'personal_question';
export const CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE = 'classword_word_entry';
export const CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE = 'classword_quiz_correct';
export const FAILURE_EXHIBITION_WEEKLY_MISSION_TYPE = 'failure_exhibition';
export const BOOK_STACK_WEEKLY_MISSION_TYPE = 'book_stack';
export const PERSONAL_QUESTION_WEEKLY_REWARD = 15;
export const FAILURE_EXHIBITION_WEEKLY_REWARD = 10;
export const BOOK_STACK_WEEKLY_REWARD = 10;
export const CLASSWORD_WEEKLY_REWARD = 5;

export const WEEKLY_MISSION_TYPES = [
  PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
  CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
] as const;

export type WeeklyMissionType = typeof WEEKLY_MISSION_TYPES[number];
export type WeeklyMissionRewardType = WeeklyMissionType
  | typeof FAILURE_EXHIBITION_WEEKLY_MISSION_TYPE
  | typeof BOOK_STACK_WEEKLY_MISSION_TYPE;
export type WeeklyMissionHistoryType = WeeklyMissionRewardType
  | typeof CLASSWORD_QUIZ_WEEKLY_MISSION_TYPE;

export const getWeeklyMissionRewardAmount = (missionType: WeeklyMissionRewardType) => {
  if (missionType === PERSONAL_QUESTION_WEEKLY_MISSION_TYPE) return PERSONAL_QUESTION_WEEKLY_REWARD;
  if (missionType === FAILURE_EXHIBITION_WEEKLY_MISSION_TYPE) return FAILURE_EXHIBITION_WEEKLY_REWARD;
  if (missionType === BOOK_STACK_WEEKLY_MISSION_TYPE) return BOOK_STACK_WEEKLY_REWARD;
  return CLASSWORD_WEEKLY_REWARD;
};

const isWeeklyMissionType = (value: unknown): value is WeeklyMissionType => (
  typeof value === 'string' && WEEKLY_MISSION_TYPES.some((missionType) => missionType === value)
);

export const WEEKLY_MISSION_DEFINITIONS = [
  {
    type: PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
    label: '신문에 개인 질문하기',
    description: '이번 주 신문을 읽고 나만의 질문을 남겨 보세요.',
    rewardAmount: PERSONAL_QUESTION_WEEKLY_REWARD,
    destinationUrl: 'https://question-news.vercel.app/',
  },
  {
    type: CLASSWORD_WORD_ENTRY_WEEKLY_MISSION_TYPE,
    label: 'ㄱㄴㄷ 게임',
    description: '오늘의 주제에 맞는 낱말로 초성 한 칸을 채워 보세요.',
    rewardAmount: CLASSWORD_WEEKLY_REWARD,
  },
] as const satisfies readonly {
  readonly type: WeeklyMissionType;
  readonly label: string;
  readonly description: string;
  readonly rewardAmount: number;
  readonly destinationUrl?: string;
}[];

export type WeeklyMissionStatus = 'loading' | 'incomplete' | 'inProgress' | 'completed' | 'unavailable';
export type WeeklyMissionStatuses = Record<WeeklyMissionType, WeeklyMissionStatus>;

export const createWeeklyMissionStatuses = (status: WeeklyMissionStatus): WeeklyMissionStatuses => ({
  personal_question: status,
  classword_word_entry: status,
});

export const getWeeklyMissionStatus = (
  mission: Pick<WeeklyMissionResult, 'completed' | 'pending'>,
): WeeklyMissionStatus => {
  if (mission.completed) return 'completed';
  return mission.pending ? 'inProgress' : 'incomplete';
};

export interface WeeklyMissionResult {
  missionType: WeeklyMissionType;
  weekKey: string;
  completed: boolean;
  awarded: boolean;
  rewardAmount: number;
  balance: number;
  pending: boolean;
}

export interface WeeklyMissionClaim {
  value: Record<string, unknown>;
  awarded: boolean;
  balance: number;
}

export interface WeeklyMissionsResult {
  missions: WeeklyMissionResult[];
}

interface QuestionHistoryRecord {
  id: string;
  student_number: number;
  question_type: 'personal' | 'topic';
  week_key: string;
}

export interface QuestionStudentResponse {
  history: QuestionHistoryRecord[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

export const getKoreanIsoWeekKey = (date = new Date()) => {
  const koreanDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const utcDate = new Date(Date.UTC(
    koreanDate.getUTCFullYear(),
    koreanDate.getUTCMonth(),
    koreanDate.getUTCDate(),
  ));
  const weekday = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utcDate.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
};

export const parseQuestionStudentResponse = (value: unknown): QuestionStudentResponse => {
  if (!isRecord(value) || !Array.isArray(value.history)) {
    throw new Error('QUESTION_STUDENT_INVALID_RESPONSE');
  }

  const history = value.history.map((entry): QuestionHistoryRecord => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.student_number !== 'number' ||
      !Number.isInteger(entry.student_number) ||
      (entry.question_type !== 'personal' && entry.question_type !== 'topic') ||
      typeof entry.week_key !== 'string'
    ) {
      throw new Error('QUESTION_STUDENT_INVALID_HISTORY');
    }

    return {
      id: entry.id,
      student_number: entry.student_number,
      question_type: entry.question_type,
      week_key: entry.week_key,
    };
  });

  return { history };
};

export const findPersonalQuestionForWeek = (
  response: QuestionStudentResponse,
  studentNumber: number,
  weekKey: string,
) => response.history.find((entry) => (
  entry.student_number === studentNumber &&
  entry.question_type === 'personal' &&
  entry.week_key === weekKey
)) ?? null;

export const hasWeeklyMissionReward = (
  currencyHistory: unknown,
  studentNumber: number,
  weekKey: string,
  missionType: WeeklyMissionHistoryType,
) => (
  normalizeCurrencyHistory(currencyHistory)[String(studentNumber)] ?? []
).some((entry) => entry.id === getWeeklyMissionRewardId(studentNumber, weekKey, missionType));

export const getWeeklyMissionRewardIds = (currencyHistory: unknown) => new Set(
  Object.values(normalizeCurrencyHistory(currencyHistory))
    .flat()
    .filter((entry) => entry.reason === 'weekly_mission')
    .map((entry) => entry.id),
);

export const getAuctionAwardKeys = (auctionAwards: unknown) => new Set(
  Object.values(normalizeAuctionAwards(auctionAwards, AUCTION_ITEM_IDS))
    .filter((award) => award !== null)
    .map((award) => `${award.itemId}:${award.awardedAt}`),
);

const getWeeklyMissionRewardId = (
  studentNumber: number,
  weekKey: string,
  missionType: WeeklyMissionHistoryType,
) => missionType === PERSONAL_QUESTION_WEEKLY_MISSION_TYPE
  ? `weekly-mission-${studentNumber}-${weekKey}`
  : `weekly-mission-${missionType}-${studentNumber}-${weekKey}`;

export const claimWeeklyMissionRewardInSettings = (
  value: unknown,
  studentNumber: number,
  weekKey: string,
  missionType: WeeklyMissionRewardType,
  createdAt = new Date().toISOString(),
): WeeklyMissionClaim => {
  const currentValue = value && typeof value === 'object'
    ? { ...(value as Record<string, unknown>) }
    : {};
  const balances = normalizeCurrencyBalances(currentValue.currencyBalances);
  const history = normalizeCurrencyHistory(currentValue.currencyHistory);
  const studentKey = String(studentNumber);
  const rewardId = getWeeklyMissionRewardId(studentNumber, weekKey, missionType);
  const rewardAmount = getWeeklyMissionRewardAmount(missionType);
  const existingEntries = history[studentKey] ?? [];

  if (existingEntries.some((entry) => entry.id === rewardId)) {
    return { value: currentValue, awarded: false, balance: balances[studentKey] };
  }

  const before = balances[studentKey];
  if (before > CURRENCY_BALANCE_MAX - rewardAmount) {
    return { value: currentValue, awarded: false, balance: before };
  }

  const after = before + rewardAmount;
  const nextHistory = {
    ...history,
    [studentKey]: [
      {
        id: rewardId,
        studentNumber,
        delta: after - before,
        before,
        after,
        reason: 'weekly_mission' as const,
        createdAt,
      },
      ...existingEntries,
    ],
  };

  return {
    value: {
      ...currentValue,
      currencyBalances: { ...balances, [studentKey]: after },
      currencyHistory: nextHistory,
    },
    awarded: true,
    balance: after,
  };
};

export const claimPersonalQuestionRewardInSettings = (
  value: unknown,
  studentNumber: number,
  submitted: boolean,
  weekKey = getKoreanIsoWeekKey(),
  createdAt = new Date().toISOString(),
): WeeklyMissionClaim => {
  if (submitted) {
    return claimWeeklyMissionRewardInSettings(
      value,
      studentNumber,
      weekKey,
      PERSONAL_QUESTION_WEEKLY_MISSION_TYPE,
      createdAt,
    );
  }

  const currentValue = isRecord(value) ? { ...value } : {};
  return {
    value: currentValue,
    awarded: false,
    balance: normalizeCurrencyBalances(currentValue.currencyBalances)[String(studentNumber)],
  };
};

export const mergeConcurrentCurrencyUpdatesIntoSettings = (
  remoteValue: unknown,
  nextValue: unknown,
  knownRewardIds: ReadonlySet<string> | null = null,
  knownAwardKeys: ReadonlySet<string> | null = null,
  preserveRemoteAuctionActivity = true,
): Record<string, unknown> => {
  const remote = isRecord(remoteValue) ? remoteValue : {};
  const next = isRecord(nextValue) ? nextValue : {};
  const remoteHistory = normalizeCurrencyHistory(remote.currencyHistory);
  const nextHistory = normalizeCurrencyHistory(next.currencyHistory);
  const nextBalances = normalizeCurrencyBalances(next.currencyBalances);
  const remoteAwards = normalizeAuctionAwards(remote.auctionAwards, AUCTION_ITEM_IDS);
  const nextAwards = normalizeAuctionAwards(next.auctionAwards, AUCTION_ITEM_IDS);
  const remoteStudentEconomy = normalizeStudentEconomyStates(remote.studentEconomy);
  const nextStudentEconomy = normalizeStudentEconomyStates(next.studentEconomy);
  const mergedStudentEconomy = { ...nextStudentEconomy };

  const rebaseMissingEntries = (
    entries: readonly CurrencyHistoryEntry[],
    finalBalance: number,
  ): CurrencyHistoryEntry[] => {
    let after = finalBalance;
    return entries.map((entry) => {
      const before = after - entry.delta;
      const rebasedEntry = { ...entry, before, after };
      after = before;
      return rebasedEntry;
    });
  };

  const getLatestReset = (entries: readonly CurrencyHistoryEntry[]) => entries
    .filter((entry) => entry.reason === 'reset')
    .reduce<CurrencyHistoryEntry | null>((latest, entry) => {
      if (!latest) return entry;
      return (Date.parse(entry.createdAt) || 0) > (Date.parse(latest.createdAt) || 0) ? entry : latest;
    }, null);

  Object.keys(nextHistory).forEach((studentKey) => {
    const latestReset = getLatestReset(nextHistory[studentKey]);
    if (!latestReset) return;
    const resetTime = Date.parse(latestReset.createdAt) || 0;
    const balanceAfterReset = latestReset.after + nextHistory[studentKey]
      .filter((entry) => (Date.parse(entry.createdAt) || 0) > resetTime)
      .reduce((total, entry) => total + entry.delta, 0);
    if (balanceAfterReset < CURRENCY_BALANCE_MIN || balanceAfterReset > CURRENCY_BALANCE_MAX) {
      throw new Error('CURRENCY_RECONCILIATION_CONFLICT');
    }
    nextBalances[studentKey] = balanceAfterReset;
    nextHistory[studentKey] = rebaseMissingEntries(nextHistory[studentKey], balanceAfterReset);
  });

  Object.keys(nextHistory).forEach((studentKey) => {
    const existingIds = new Set(nextHistory[studentKey].map((entry) => entry.id));
    const missingRewards = remoteHistory[studentKey].filter((entry) => (
      entry.reason === 'weekly_mission' &&
      (
        entry.delta === PERSONAL_QUESTION_WEEKLY_REWARD
        || entry.delta === FAILURE_EXHIBITION_WEEKLY_REWARD
        || entry.delta === BOOK_STACK_WEEKLY_REWARD
        || entry.delta === CLASSWORD_WEEKLY_REWARD
      ) &&
      (knownRewardIds === null || !knownRewardIds.has(entry.id)) &&
      !existingIds.has(entry.id)
    ));

    if (missingRewards.length === 0) return;

    const rewardAmount = missingRewards.reduce((total, entry) => total + entry.delta, 0);
    const nextBalance = nextBalances[studentKey] + rewardAmount;
    if (nextBalance > CURRENCY_BALANCE_MAX) {
      throw new Error('CURRENCY_RECONCILIATION_CONFLICT');
    }
    nextBalances[studentKey] = nextBalance;
    nextHistory[studentKey] = [
      ...rebaseMissingEntries(missingRewards, nextBalance),
      ...nextHistory[studentKey],
    ];
  });

  Object.keys(nextHistory).forEach((studentKey) => {
    const existingIds = new Set(nextHistory[studentKey].map((entry) => entry.id));
    const missingSudokuRewards = remoteHistory[studentKey].filter((entry) => (
      entry.reason === 'sudoku_mission' && entry.delta > 0 && !existingIds.has(entry.id)
    ));

    if (missingSudokuRewards.length === 0) return;

    const rewardAmount = missingSudokuRewards.reduce((total, entry) => total + entry.delta, 0);
    const nextBalance = nextBalances[studentKey] + rewardAmount;
    if (nextBalance > CURRENCY_BALANCE_MAX) throw new Error('CURRENCY_RECONCILIATION_CONFLICT');
    nextBalances[studentKey] = nextBalance;
    nextHistory[studentKey] = [
      ...rebaseMissingEntries(missingSudokuRewards, nextBalance),
      ...nextHistory[studentKey],
    ];
  });

  Object.keys(nextHistory).forEach((studentKey) => {
    const existingIds = new Set(nextHistory[studentKey].map((entry) => entry.id));
    const missingNumberBaseballRewards = remoteHistory[studentKey].filter((entry) => (
      entry.reason === 'number_baseball_mission' && entry.delta > 0 && !existingIds.has(entry.id)
    ));

    if (missingNumberBaseballRewards.length === 0) return;

    const rewardAmount = missingNumberBaseballRewards.reduce((total, entry) => total + entry.delta, 0);
    const nextBalance = nextBalances[studentKey] + rewardAmount;
    if (nextBalance > CURRENCY_BALANCE_MAX) throw new Error('CURRENCY_RECONCILIATION_CONFLICT');
    nextBalances[studentKey] = nextBalance;
    nextHistory[studentKey] = [
      ...rebaseMissingEntries(missingNumberBaseballRewards, nextBalance),
      ...nextHistory[studentKey],
    ];
  });

  Object.keys(nextHistory).forEach((studentKey) => {
    const existingIds = new Set(nextHistory[studentKey].map((entry) => entry.id));
    const missingDailyEmotionRewards = remoteHistory[studentKey].filter((entry) => (
      entry.reason === 'daily_emotion' && entry.delta > 0 && !existingIds.has(entry.id)
    ));

    if (missingDailyEmotionRewards.length === 0) return;

    const rewardAmount = missingDailyEmotionRewards.reduce((total, entry) => total + entry.delta, 0);
    const nextBalance = nextBalances[studentKey] + rewardAmount;
    if (nextBalance > CURRENCY_BALANCE_MAX) {
      throw new Error('CURRENCY_RECONCILIATION_CONFLICT');
    }
    nextBalances[studentKey] = nextBalance;
    nextHistory[studentKey] = [
      ...rebaseMissingEntries(missingDailyEmotionRewards, nextBalance),
      ...nextHistory[studentKey],
    ];
  });

  Object.keys(nextHistory).forEach((studentKey) => {
    const existingIds = new Set(nextHistory[studentKey].map((entry) => entry.id));
    const missingDailyWritingRewards = remoteHistory[studentKey].filter((entry) => (
      entry.reason === 'daily_writing' && entry.delta === 25 && !existingIds.has(entry.id)
    ));

    if (missingDailyWritingRewards.length === 0) return;

    const rewardAmount = missingDailyWritingRewards.reduce((total, entry) => total + entry.delta, 0);
    const nextBalance = nextBalances[studentKey] + rewardAmount;
    if (nextBalance > CURRENCY_BALANCE_MAX) {
      throw new Error('CURRENCY_RECONCILIATION_CONFLICT');
    }
    nextBalances[studentKey] = nextBalance;
    nextHistory[studentKey] = [
      ...rebaseMissingEntries(missingDailyWritingRewards, nextBalance),
      ...nextHistory[studentKey],
    ];
  });

  Object.keys(nextHistory).forEach((studentKey) => {
    const existingIds = new Set(nextHistory[studentKey].map((entry) => entry.id));
    const missingClassroomRoleChanges = remoteHistory[studentKey].filter((entry) => (
      entry.reason === 'classroom_role' && !existingIds.has(entry.id)
    ));
    if (missingClassroomRoleChanges.length === 0) return;

    const nextBalance = nextBalances[studentKey]
      + missingClassroomRoleChanges.reduce((total, entry) => total + entry.delta, 0);
    if (nextBalance < CURRENCY_BALANCE_MIN || nextBalance > CURRENCY_BALANCE_MAX) {
      throw new Error('CURRENCY_RECONCILIATION_CONFLICT');
    }
    nextBalances[studentKey] = nextBalance;
    nextHistory[studentKey] = [
      ...rebaseMissingEntries(missingClassroomRoleChanges, nextBalance),
      ...nextHistory[studentKey],
    ];
  });

  Object.entries(remoteAwards).forEach(([itemId, award]) => {
    if (!award || nextAwards[itemId]) return;
    const awardKey = `${award.itemId}:${award.awardedAt}`;
    if (knownAwardKeys?.has(awardKey)) return;

    const studentKey = String(award.winner);
    const existingIds = new Set(nextHistory[studentKey].map((entry) => entry.id));
    const awardEntry = remoteHistory[studentKey].find((entry) => (
      entry.reason === 'auction_award' &&
      entry.createdAt === award.awardedAt &&
      entry.delta === -award.amount &&
      !existingIds.has(entry.id)
    ));
    if (!awardEntry) return;

    const nextBalance = nextBalances[studentKey] + awardEntry.delta;
    if (nextBalance < 0) {
      throw new Error('CURRENCY_RECONCILIATION_CONFLICT');
    }
    nextBalances[studentKey] = nextBalance;
    nextHistory[studentKey] = [
      ...rebaseMissingEntries([awardEntry], nextBalance),
      ...nextHistory[studentKey],
    ];
    nextAwards[itemId] = award;
  });

  Object.keys(nextHistory).forEach((studentKey) => {
    const existingIds = new Set(nextHistory[studentKey].map((entry) => entry.id));
    const missingDonations = remoteHistory[studentKey].filter((entry) => (
      entry.reason === 'class_donation' &&
      entry.delta < 0 &&
      !existingIds.has(entry.id)
    ));
    if (missingDonations.length === 0) return;

    const nextBalance = nextBalances[studentKey]
      + missingDonations.reduce((total, entry) => total + entry.delta, 0);
    if (nextBalance < 0) throw new Error('CURRENCY_RECONCILIATION_CONFLICT');
    nextBalances[studentKey] = nextBalance;
    nextHistory[studentKey] = [
      ...rebaseMissingEntries(missingDonations, nextBalance),
      ...nextHistory[studentKey],
    ];
  });

  Object.keys(nextHistory).forEach((studentKey) => {
    const existingIds = new Set(nextHistory[studentKey].map((entry) => entry.id));
    const missingPetFeeds = remoteHistory[studentKey].filter((entry) => (
      entry.reason === 'pet_feed' && entry.delta < 0 && !existingIds.has(entry.id)
    ));
    if (missingPetFeeds.length === 0) return;

    const nextBalance = nextBalances[studentKey]
      + missingPetFeeds.reduce((total, entry) => total + entry.delta, 0);
    if (nextBalance < 0) throw new Error('CURRENCY_RECONCILIATION_CONFLICT');
    nextBalances[studentKey] = nextBalance;
    nextHistory[studentKey] = [
      ...rebaseMissingEntries(missingPetFeeds, nextBalance),
      ...nextHistory[studentKey],
    ];
  });

  const economyStudentsWithRemoteActivity = new Set<string>();
  const newRemoteRequestIds = new Set<string>();
  Object.entries(remoteStudentEconomy).forEach(([studentKey, remoteState]) => {
    const remoteRequestIds = remoteState.processedRequestIds;
    const nextState = nextStudentEconomy[studentKey];
    const nextRequestIds = new Set(nextState?.processedRequestIds ?? []);
    const unseenRequestIds = remoteRequestIds.filter((requestId) => !nextRequestIds.has(requestId));
    if (unseenRequestIds.length > 0) {
      economyStudentsWithRemoteActivity.add(studentKey);
      unseenRequestIds.forEach((requestId) => newRemoteRequestIds.add(requestId));
      mergedStudentEconomy[studentKey] = remoteState;
    }
  });

  const isEconomyHistoryEntry = (entry: CurrencyHistoryEntry) => (
    entry.reason === 'shop_purchase' || entry.reason === 'stock_trade' || entry.reason === 'bank_transfer'
  );
  Object.keys(nextHistory).forEach((studentKey) => {
    const remoteLatestReset = getLatestReset(remoteHistory[studentKey]);
    const nextLatestReset = getLatestReset(nextHistory[studentKey]);
    const remoteResetTime = remoteLatestReset ? Date.parse(remoteLatestReset.createdAt) || 0 : 0;
    const nextResetTime = nextLatestReset ? Date.parse(nextLatestReset.createdAt) || 0 : 0;
    if (remoteResetTime > nextResetTime) {
      if (!remoteLatestReset) throw new Error('CURRENCY_RECONCILIATION_CONFLICT');
      const acceptedChangesAfterReset = nextHistory[studentKey].filter((entry) => (
        (Date.parse(entry.createdAt) || 0) > remoteResetTime
      ));
      const balanceAfterReset = remoteLatestReset.after
        + acceptedChangesAfterReset.reduce((total, entry) => total + entry.delta, 0);
      if (balanceAfterReset < CURRENCY_BALANCE_MIN || balanceAfterReset > CURRENCY_BALANCE_MAX) {
        throw new Error('CURRENCY_RECONCILIATION_CONFLICT');
      }
      nextBalances[studentKey] = balanceAfterReset;
      nextHistory[studentKey] = rebaseMissingEntries(
        [
          ...acceptedChangesAfterReset,
          ...remoteHistory[studentKey].filter((entry) => (Date.parse(entry.createdAt) || 0) <= remoteResetTime),
        ]
          .sort((left, right) => (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0)),
        balanceAfterReset,
      );
    }
    const existingIds = new Set(nextHistory[studentKey].map((entry) => entry.id));
    const latestResetTime = Math.max(remoteResetTime, nextResetTime);
    const missingEconomyChanges = remoteHistory[studentKey].filter((entry) => {
      if (!isEconomyHistoryEntry(entry) || existingIds.has(entry.id)) return false;
      const belongsToVerifiedActivity = [...newRemoteRequestIds].some((requestId) => (
        entry.id === `currency-economy-${requestId}-${studentKey}`
        || entry.id === `currency-profile-${requestId}`
      ));
      return belongsToVerifiedActivity && (Date.parse(entry.createdAt) || 0) > latestResetTime;
    });
    if (missingEconomyChanges.length === 0) return;

    const nextBalance = nextBalances[studentKey]
      + missingEconomyChanges.reduce((total, entry) => total + entry.delta, 0);
    if (nextBalance < CURRENCY_BALANCE_MIN || nextBalance > CURRENCY_BALANCE_MAX) {
      throw new Error('CURRENCY_RECONCILIATION_CONFLICT');
    }
    nextBalances[studentKey] = nextBalance;
    const combinedHistory = [...nextHistory[studentKey], ...missingEconomyChanges]
      .sort((left, right) => (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0));
    nextHistory[studentKey] = rebaseMissingEntries(combinedHistory, nextBalance);
  });

  return {
    ...next,
    studentPets: remote.studentPets ?? next.studentPets,
    studentEconomy: mergedStudentEconomy,
    studentLife: economyStudentsWithRemoteActivity.size > 0
      ? mergeStudentLifeStates(remote.studentLife, next.studentLife)
      : next.studentLife ?? remote.studentLife,
    currencyBalances: nextBalances,
    currencyHistory: nextHistory,
    auctionAwards: nextAwards,
    auctionBids: preserveRemoteAuctionActivity && remote.auctionBids !== undefined
      ? remote.auctionBids
      : next.auctionBids,
    auctionBidHistory: preserveRemoteAuctionActivity && remote.auctionBidHistory !== undefined
      ? remote.auctionBidHistory
      : next.auctionBidHistory,
    classDonation: mergeClassDonationActivity(remote.classDonation, next.classDonation),
    studentEmotionHistory: mergeStudentEmotionHistories(
      remote.studentEmotionHistory,
      next.studentEmotionHistory,
    ),
    studentSudoku: remote.studentSudoku ?? next.studentSudoku,
    studentNumberBaseball: remote.studentNumberBaseball ?? next.studentNumberBaseball,
  };
};

export const parseWeeklyMissionResult = (value: unknown): WeeklyMissionResult => {
  if (
    !isRecord(value) ||
    !isWeeklyMissionType(value.missionType) ||
    typeof value.weekKey !== 'string' ||
    typeof value.completed !== 'boolean' ||
    typeof value.awarded !== 'boolean' ||
    typeof value.rewardAmount !== 'number' ||
    typeof value.balance !== 'number' ||
    (value.pending !== undefined && typeof value.pending !== 'boolean')
  ) {
    throw new Error('WEEKLY_MISSION_INVALID_RESPONSE');
  }

  return {
    missionType: value.missionType,
    weekKey: value.weekKey,
    completed: value.completed,
    awarded: value.awarded,
    rewardAmount: value.rewardAmount,
    balance: value.balance,
    pending: value.pending === true,
  };
};

export const parseWeeklyMissionsResult = (value: unknown): WeeklyMissionsResult => {
  if (!isRecord(value) || !Array.isArray(value.missions)) {
    throw new Error('WEEKLY_MISSIONS_INVALID_RESPONSE');
  }

  const missions = value.missions.map(parseWeeklyMissionResult);
  if (
    missions.length !== WEEKLY_MISSION_TYPES.length ||
    !WEEKLY_MISSION_TYPES.every((missionType) => (
      missions.filter((mission) => mission.missionType === missionType).length === 1
    ))
  ) {
    throw new Error('WEEKLY_MISSIONS_INVALID_RESPONSE');
  }

  return { missions };
};

export const syncPersonalQuestionWeeklyMission = async (studentNumber: number) => {
  if (!canWriteSharedBackend(appDataMode)) throw new Error('BACKEND_WRITE_DISABLED');
  const response = await fetch('/api/weekly-mission', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ studentNumber }),
  });

  if (!response.ok) {
    throw new Error(`WEEKLY_MISSION_HTTP_${response.status}`);
  }

  return parseWeeklyMissionResult(await response.json());
};

export const syncWeeklyMissions = async (studentNumber: number) => {
  if (!canWriteSharedBackend(appDataMode)) throw new Error('BACKEND_WRITE_DISABLED');
  const response = await fetch('/api/weekly-missions', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ studentNumber }),
  });

  if (!response.ok) {
    throw new Error(`WEEKLY_MISSIONS_HTTP_${response.status}`);
  }

  return parseWeeklyMissionsResult(await response.json());
};
import {
  AUCTION_ITEM_IDS,
  CURRENCY_BALANCE_MIN,
  CURRENCY_BALANCE_MAX,
  normalizeCurrencyBalances,
  normalizeCurrencyHistory,
  normalizeAuctionAwards,
  type CurrencyHistoryEntry,
} from './currency.js';
import { mergeClassDonationActivity } from './classDonation.js';
import { appDataMode, canWriteSharedBackend } from './dataMode.js';
import { mergeStudentEmotionHistories } from './studentEmotion.js';
import { normalizeStudentEconomyStates } from './studentEconomy.js';
import { mergeStudentLifeStates } from './studentLife.js';
