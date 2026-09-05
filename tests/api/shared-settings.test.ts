import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../../api/shared-settings.js';
import studentEconomyHandler from '../../api/student-economy.js';
import { createDeviceSessionToken } from '../../src/server/deviceSession.js';

const SESSION_SECRET = 'test-device-session-secret-that-is-at-least-32-characters';
let environmentSequence = 0;
const createResponse = () => {
  let statusCode = 200;
  let body: unknown;
  const response = {
    setHeader: () => undefined,
    status: (code: number) => { statusCode = code; return response; },
    json: (value: unknown) => { body = value; },
  };
  return { response, result: () => ({ statusCode, body }) };
};

const withEnvironment = async (run: () => Promise<void>) => {
  const originals = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    secret: process.env.DEVICE_SESSION_SECRET,
  };
  environmentSequence += 1;
  process.env.SUPABASE_URL = `https://school-timer-${environmentSequence}.supabase.co`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.DEVICE_SESSION_SECRET = SESSION_SECRET;
  try {
    await run();
  } finally {
    if (originals.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originals.url;
    if (originals.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originals.key;
    if (originals.secret === undefined) delete process.env.DEVICE_SESSION_SECRET;
    else process.env.DEVICE_SESSION_SECRET = originals.secret;
  }
};

const studentHeaders = (studentNumber: number) => ({
  cookie: `__Host-school-timer-device=${createDeviceSessionToken({ role: 'student', studentNumber }, SESSION_SECRET)}`,
  'sec-fetch-site': 'same-origin',
});

const teacherHeaders = () => ({
  cookie: `__Host-school-timer-device=${createDeviceSessionToken({ role: 'teacher' }, SESSION_SECRET)}`,
  'sec-fetch-site': 'same-origin',
});

test('unregistered devices cannot read shared classroom settings', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => { fetchCalled = true; return Response.json([]); };
    try {
      const { response, result } = createResponse();
      await handler({ method: 'GET' }, response);
      assert.equal(result().statusCode, 401);
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('registered devices can poll only the shared settings timestamp', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];
    globalThis.fetch = async (input) => {
      requests.push(String(input));
      return Response.json([{ updated_at: '2026-09-05T00:00:01.000Z' }]);
    };
    try {
      const first = createResponse();
      const second = createResponse();
      await Promise.all([first, second].map(({ response }) => handler({
        method: 'GET',
        headers: studentHeaders(7),
        query: { metadata: '1' },
      }, response)));

      assert.equal(first.result().statusCode, 200);
      assert.equal(second.result().statusCode, 200);
      assert.deepEqual(first.result().body, { updatedAt: '2026-09-05T00:00:01.000Z' });
      assert.deepEqual(second.result().body, { updatedAt: '2026-09-05T00:00:01.000Z' });
      assert.equal(requests.length, 1);
      assert.match(requests[0] ?? '', /select=updated_at/);
      assert.doesNotMatch(requests[0] ?? '', /select=[^&]*value/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('an older metadata request cannot replace the version cached by a completed write', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let releaseMetadata: (() => void) | undefined;
    let markMetadataStarted: (() => void) | undefined;
    const metadataGate = new Promise<void>((resolve) => { releaseMetadata = resolve; });
    const metadataStarted = new Promise<void>((resolve) => { markMetadataStarted = resolve; });
    globalThis.fetch = async (input, init) => {
      if (!init?.method && new URL(String(input)).searchParams.get('select') === 'updated_at') {
        markMetadataStarted?.();
        await metadataGate;
        return Response.json([{ updated_at: '2026-09-05T00:00:00.000Z' }]);
      }
      if (!init?.method) {
        return Response.json([{
          id: 'school-timer-main', value: { schedule: [] }, updated_at: '2026-09-05T00:00:00.000Z',
        }]);
      }
      return Response.json([{ id: 'school-timer-main' }]);
    };

    try {
      const metadataResponses = [createResponse(), createResponse()];
      const pendingMetadata = Promise.all(metadataResponses.map(({ response }) => handler({
        method: 'GET',
        headers: studentHeaders(7),
        query: { metadata: '1' },
      }, response)));
      await metadataStarted;

      const writeResponse = createResponse();
      await handler({
        method: 'PUT',
        headers: teacherHeaders(),
        body: { value: { schedule: ['수학'] }, expectedUpdatedAt: '2026-09-05T00:00:00.000Z' },
      }, writeResponse.response);
      const writtenUpdatedAt = (writeResponse.result().body as { updatedAt: string }).updatedAt;
      releaseMetadata?.();
      await pendingMetadata;

      const nextMetadataResponse = createResponse();
      await handler({
        method: 'GET',
        headers: studentHeaders(7),
        query: { metadata: '1' },
      }, nextMetadataResponse.response);

      metadataResponses.forEach(({ result }) => {
        assert.deepEqual(result().body, { updatedAt: writtenUpdatedAt });
      });
      assert.deepEqual(nextMetadataResponse.result().body, { updatedAt: writtenUpdatedAt });
    } finally {
      releaseMetadata?.();
      globalThis.fetch = originalFetch;
    }
  });
});

test('student sessions receive only their own large JSON map entries', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];
    globalThis.fetch = async (input) => {
      requests.push(String(input));
      return Response.json([{
        id: 'school-timer-main',
        updated_at: '2026-09-05T00:00:01.000Z',
        auctionItems: [{ id: 'day-1' }],
        currencyBalances: 145,
        currencyHistory: [{ id: 'history-7' }],
        studentEconomy: { deposit: 30 },
      }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({ method: 'GET', headers: studentHeaders(7) }, response);

      assert.equal(result().statusCode, 200);
      assert.equal(requests.length, 1);
      const select = new URL(requests[0] ?? '').searchParams.get('select') ?? '';
      assert.match(select, /currencyHistory:value->currencyHistory->"7"/);
      assert.match(select, /studentEconomy:value->studentEconomy->"7"/);
      assert.doesNotMatch(select, /(?:^|,)value(?:,|$)/);

      const row = result().body as {
        scope?: string;
        value?: Record<string, unknown>;
      };
      assert.equal(row.scope, 'student');
      assert.deepEqual(row.value?.auctionItems, [{ id: 'day-1' }]);
      assert.deepEqual(row.value?.currencyBalances, { 7: 145 });
      assert.deepEqual(row.value?.currencyHistory, { 7: [{ id: 'history-7' }] });
      assert.deepEqual(row.value?.studentEconomy, { 7: { deposit: 30 } });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('teacher reads stay complete while student full queries remain scoped', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];
    globalThis.fetch = async (input) => {
      requests.push(String(input));
      const select = new URL(String(input)).searchParams.get('select');
      if (select !== 'id,value,updated_at') {
        return Response.json([{
          id: 'school-timer-main',
          auctionItems: [{ id: 'day-1' }],
          currencyBalances: 145,
          updated_at: '2026-09-05T00:00:01.000Z',
        }]);
      }
      return Response.json([{
        id: 'school-timer-main',
        value: { weeklySchedule: ['월요일'] },
        updated_at: '2026-09-05T00:00:01.000Z',
      }]);
    };
    try {
      const teacherResponse = createResponse();
      await handler({ method: 'GET', headers: teacherHeaders() }, teacherResponse.response);
      const studentResponse = createResponse();
      await handler({
        method: 'GET',
        headers: studentHeaders(7),
        query: { full: '1' },
      }, studentResponse.response);

      assert.equal(requests.length, 2);
      assert.equal(new URL(requests[0] ?? '').searchParams.get('select'), 'id,value,updated_at');
      assert.doesNotMatch(new URL(requests[1] ?? '').searchParams.get('select') ?? '', /(?:^|,)value(?:,|$)/);
      assert.equal((teacherResponse.result().body as { scope?: string }).scope, 'full');
      const studentRow = studentResponse.result().body as {
        scope?: string;
        value?: Record<string, unknown>;
      };
      assert.equal(studentRow.scope, 'student');
      assert.deepEqual(studentRow.value?.currencyBalances, { 7: 145 });
      assert.equal(Reflect.has(studentRow.value ?? {}, 'weeklySchedule'), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('student sessions cannot change teacher-owned settings', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      return Response.json([{ id: 'school-timer-main', value: { schedule: ['수학'], currencyBalances: { 7: 100 } }, updated_at: '2026-09-05T00:00:00.000Z' }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: { value: { schedule: ['체육'], currencyBalances: { 7: 100 } }, expectedUpdatedAt: '2026-09-05T00:00:00.000Z' },
      }, response);
      assert.equal(result().statusCode, 403);
      assert.equal(fetchCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('student sessions can update only their own balance entry', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];
    let savedValue: unknown;
    globalThis.fetch = async (input, init) => {
      requests.push(String(input));
      if (requests.length === 1) {
        return Response.json([{ id: 'school-timer-main', value: { schedule: ['수학'], currencyBalances: { 7: 100, 8: 100 } }, updated_at: '2026-09-05T00:00:00.000Z' }]);
      }
      savedValue = JSON.parse(String(init?.body)).value;
      return Response.json([{ id: 'school-timer-main' }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: { value: { currencyBalances: { 7: 105 } }, expectedUpdatedAt: '2026-09-05T00:00:00.000Z' },
      }, response);
      assert.equal(result().statusCode, 200);
      assert.equal(requests.length, 2);
      assert.equal(new URL(requests[1] ?? '').searchParams.get('select'), 'id');
      assert.deepEqual(savedValue, {
        schedule: ['수학'],
        currencyBalances: { 7: 105, 8: 100 },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('student scoped updates keep the merged settings value within the size limit', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      return Response.json([{
        id: 'school-timer-main',
        value: { schedule: 'a'.repeat(600_000) },
        updated_at: '2026-09-05T00:00:00.000Z',
      }]);
    };

    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: {
          value: { studentLife: 'b'.repeat(600_000) },
          expectedUpdatedAt: '2026-09-05T00:00:00.000Z',
        },
      }, response);

      assert.deepEqual(result(), {
        statusCode: 400,
        body: { error: 'INVALID_SHARED_SETTINGS' },
      });
      assert.equal(fetchCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('generic student settings writes cannot forge processed economy request IDs', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      return Response.json([{
        id: 'school-timer-main',
        value: { studentEconomy: { 7: { processedRequestIds: [] } } },
        updated_at: '2026-09-05T00:00:00.000Z',
      }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: {
          value: { studentEconomy: { 7: { processedRequestIds: ['forged-request'] } } },
          expectedUpdatedAt: '2026-09-05T00:00:00.000Z',
        },
      }, response);

      assert.equal(result().statusCode, 403);
      assert.equal(fetchCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('generic student settings writes cannot alter a server economy ledger entry', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    const studentEconomy = { 7: { processedRequestIds: ['student-economy-7-legit'] } };
    const legitimateEntry = {
      id: 'currency-economy-student-economy-7-legit-7',
      studentNumber: 7,
      before: 100,
      after: 75,
      delta: -25,
      reason: 'shop_purchase',
      createdAt: '2026-09-03T03:00:00.000Z',
    };
    globalThis.fetch = async () => {
      fetchCount += 1;
      return Response.json([{
        id: 'school-timer-main',
        value: { currencyBalances: { 7: 75 }, currencyHistory: { 7: [legitimateEntry] }, studentEconomy },
        updated_at: '2026-09-05T00:00:00.000Z',
      }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: {
          value: {
            currencyBalances: { 7: 999 },
            currencyHistory: { 7: [{ ...legitimateEntry, before: 100, after: 999, delta: 899 }] },
            studentEconomy,
          },
          expectedUpdatedAt: '2026-09-05T00:00:00.000Z',
        },
      }, response);

      assert.equal(result().statusCode, 403);
      assert.equal(fetchCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('generic student settings writes cannot forge a teacher currency reset', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      return Response.json([{
        id: 'school-timer-main',
        value: { currencyBalances: { 7: 100 }, currencyHistory: { 7: [] } },
        updated_at: '2026-09-05T00:00:00.000Z',
      }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: {
          value: {
            currencyBalances: { 7: 999 },
            currencyHistory: { 7: [{
              id: 'forged-reset', studentNumber: 7, before: 100, after: 999, delta: 899,
              reason: 'reset', createdAt: '2026-09-03T03:00:00.000Z',
            }] },
          },
          expectedUpdatedAt: '2026-09-05T00:00:00.000Z',
        },
      }, response);

      assert.equal(result().statusCode, 403);
      assert.equal(fetchCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('generic student settings writes cannot forge a teacher deduction', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      return Response.json([{
        id: 'school-timer-main',
        value: { currencyBalances: { 7: 100 }, currencyHistory: { 7: [] } },
        updated_at: '2026-09-05T00:00:00.000Z',
      }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: {
          value: {
            currencyBalances: { 7: 95 },
            currencyHistory: { 7: [{
              id: 'forged-teacher-deduction', studentNumber: 7, before: 100, after: 95, delta: -5,
              reason: 'teacher_deduction', createdAt: '2026-09-05T03:00:00.000Z',
            }] },
          },
          expectedUpdatedAt: '2026-09-05T00:00:00.000Z',
        },
      }, response);

      assert.equal(result().statusCode, 403);
      assert.equal(fetchCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

const reorderedSharedSettingsScenarios = [
  {
    name: '숫자야구 완료 저장은 다른 학생의 기록 속성 순서가 달라도 허용한다',
    previousValue: {
      currencyBalances: { 7: 100, 8: 110 },
      currencyHistory: { 8: [{ id: 'history-8', studentNumber: 8, delta: 10 }] },
      studentNumberBaseball: {},
    },
    nextValue: {
      currencyBalances: { 7: 105, 8: 110 },
      currencyHistory: {
        8: [{ delta: 10, studentNumber: 8, id: 'history-8' }],
        7: [{ id: 'number-baseball-reward-7', studentNumber: 7, delta: 5 }],
      },
      studentNumberBaseball: {
        '7:2026-36': { gameId: 'number-baseball-v1-7-2026-36', attempts: [], completedAt: '2026-09-02T00:00:00.000Z' },
      },
    },
  },
  {
    name: '감정 구슬 저장은 다른 학생의 기록 속성 순서가 달라도 허용한다',
    previousValue: {
      currencyHistory: { 8: [{ id: 'history-8', studentNumber: 8, delta: 10 }] },
      studentEmotionHistory: {},
    },
    nextValue: {
      currencyHistory: { 8: [{ delta: 10, studentNumber: 8, id: 'history-8' }] },
      studentEmotionHistory: { 7: [{ id: 'emotion-7' }] },
    },
  },
  {
    name: '경매 입찰 저장은 낙찰 객체의 속성 순서가 달라도 허용한다',
    previousValue: {
      auctionBids: {},
      auctionBidHistory: {},
      auctionAwards: {
        'item-a': { winner: 4, amount: 20 },
        'item-b': { winner: 8, amount: 30 },
      },
    },
    nextValue: {
      auctionBids: { 'item-c': { amount: 40, bidder: 7 } },
      auctionBidHistory: { 'item-c': [{ itemId: 'item-c', amount: 40, bidder: 7 }] },
      auctionAwards: {
        'item-b': { amount: 30, winner: 8 },
        'item-a': { amount: 20, winner: 4 },
      },
    },
  },
] as const;

for (const scenario of reorderedSharedSettingsScenarios) {
  test(scenario.name, async () => {
    await withEnvironment(async () => {
      const originalFetch = globalThis.fetch;
      let fetchCount = 0;
      globalThis.fetch = async () => {
        fetchCount += 1;
        return fetchCount === 1
          ? Response.json([{ id: 'school-timer-main', value: scenario.previousValue, updated_at: '2026-09-05T00:00:00.000Z' }])
          : Response.json([{ id: 'school-timer-main' }]);
      };

      try {
        const { response, result } = createResponse();
        await handler({
          method: 'PUT',
          headers: studentHeaders(7),
          body: { value: scenario.nextValue, expectedUpdatedAt: '2026-09-05T00:00:00.000Z' },
        }, response);

        assert.equal(result().statusCode, 200);
        assert.equal(fetchCount, 2);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
}

const economyUpdateScenarios = [
  {
    name: '일반 학생 설정 API는 예금 상태를 직접 저장하지 않는다',
    balance: 115,
    historyId: 'deposit-1',
    studentEconomy: { 1: { deposit: 30 } },
  },
  {
    name: '일반 학생 설정 API는 증권 상태를 직접 저장하지 않는다',
    balance: 135,
    historyId: 'investment-1',
    studentEconomy: {
      1: { investments: { sprout: { investedAmount: 10, currentAmount: 10 } } },
    },
  },
];

for (const scenario of economyUpdateScenarios) {
  test(scenario.name, async () => {
    await withEnvironment(async () => {
      // Given
      const originalFetch = globalThis.fetch;
      const previousValue = {
        schedule: ['수학'],
        currencyBalances: { 1: 145 },
        currencyHistory: { 1: [] },
        studentEconomy: {},
      };
      const normalizedBalances = Object.fromEntries(
        Array.from({ length: 23 }, (_, index) => [String(index + 1), index === 0 ? scenario.balance : 100]),
      );
      const normalizedHistory = Object.fromEntries(
        Array.from({ length: 23 }, (_, index) => [String(index + 1), index === 0 ? [{ id: scenario.historyId }] : []]),
      );
      let fetchCount = 0;
      globalThis.fetch = async () => {
        fetchCount += 1;
        return fetchCount === 1
          ? Response.json([{ id: 'school-timer-main', value: previousValue, updated_at: '2026-09-05T00:00:00.000Z' }])
          : Response.json([{ id: 'school-timer-main' }]);
      };

      try {
        const { response, result } = createResponse();

        // When
        await handler({
          method: 'PUT',
          headers: studentHeaders(1),
          body: {
            value: {
              ...previousValue,
              currencyBalances: normalizedBalances,
              currencyHistory: normalizedHistory,
              studentEconomy: scenario.studentEconomy,
            },
            expectedUpdatedAt: '2026-09-05T00:00:00.000Z',
          },
        }, response);

        // Then
        assert.equal(result().statusCode, 403);
        assert.equal(fetchCount, 1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
}

test('student sessions cannot change another student balance entry', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      return Response.json([{ id: 'school-timer-main', value: { currencyBalances: { 7: 100 } }, updated_at: '2026-09-05T00:00:00.000Z' }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: { value: { currencyBalances: { 7: 100, 8: 999 } }, expectedUpdatedAt: '2026-09-05T00:00:00.000Z' },
      }, response);
      assert.equal(result().statusCode, 403);
      assert.equal(fetchCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('teacher update with a known version rereads authoritative books before writing', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];
    globalThis.fetch = async (input, init) => {
      requests.push(String(input));
      return init?.method === 'PATCH'
        ? Response.json([{ id: 'school-timer-main' }])
        : Response.json([{
            id: 'school-timer-main',
            value: { studentLife: { books: [{
              id: 'book-1', studentNumber: 1, title: '권위 책', author: '작가', pageCount: 10,
              createdAt: '2026-09-05T00:00:00.000Z', colorIndex: 0, librarySlot: 4,
            }] } },
            updated_at: '2026-09-05T00:00:00.000Z',
          }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: teacherHeaders(),
        body: { value: { dailyWriting: { assignment: null } }, expectedUpdatedAt: '2026-09-05T00:00:00.000Z' },
      }, response);
      assert.equal(result().statusCode, 200);
      assert.equal(requests.length, 2);
      assert.equal(
        new URL(requests[1] ?? '').searchParams.get('updated_at'),
        'eq.2026-09-05T00:00:00.000Z',
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

type FakeSettingsRow = { id: string; value: Record<string, unknown>; updated_at: string };

const createStatefulPostgrest = (
  initial: FakeSettingsRow | null,
  options: { readBarrier?: number; throwAfterFirstCommit?: boolean } = {},
) => {
  let row = initial ? structuredClone(initial) : null;
  let readCount = 0;
  let releaseReads: (() => void) | undefined;
  const readsReady = options.readBarrier
    ? new Promise<void>((resolve) => { releaseReads = resolve; })
    : Promise.resolve();
  let committedThenThrew = false;
  const requests: Array<{ url: string; method: string; body: unknown }> = [];

  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({ url: url.toString(), method, body });
    if (url.hostname.endsWith('.supabase.co') === false) throw new Error('unexpected outbound fetch');

    if (method === 'GET') {
      const snapshot = row ? structuredClone(row) : null;
      readCount += 1;
      if (options.readBarrier && readCount === options.readBarrier) releaseReads?.();
      if (options.readBarrier && readCount <= options.readBarrier) await readsReady;
      return Response.json(snapshot ? [snapshot] : []);
    }
    if (method === 'PATCH') {
      const expected = url.searchParams.get('updated_at')?.replace(/^eq\./, '') ?? '';
      if (!row || row.updated_at !== expected) return Response.json([]);
      row = { id: row.id, value: structuredClone(body.value), updated_at: body.updated_at };
      if (options.throwAfterFirstCommit && !committedThenThrew) {
        committedThenThrew = true;
        throw new DOMException('synthetic timeout after commit', 'TimeoutError');
      }
      return Response.json([{ id: row.id }]);
    }
    if (method === 'POST') {
      if (row) return Response.json({ code: '23505' }, { status: 409 });
      row = structuredClone(body);
      return Response.json([{ id: row?.id }]);
    }
    return Response.json({ error: 'unsupported' }, { status: 500 });
  };
  return { fetch, state: () => structuredClone(row), requests };
};

const placementCommand = (
  requestId: string,
  slotId: number,
  title = '달빛 우체국',
) => ({
  action: 'placeLibraryBook',
  requestId,
  slotId,
  book: { kind: 'new', title, author: '고마 작가', pageCount: 321 },
});

test('placement command is student-only and returns an authoritative student projection', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const fake = createStatefulPostgrest({
      id: 'school-timer-main',
      value: {
        schedule: ['비공개'], currencyBalances: { 1: 0, 2: 999 },
        studentLife: { letters: [{
          id: 'keep', recipient: 1, senderLabel: '선생님', senderStudentNumber: null,
          replyToId: null, title: '안내', content: '보존', createdAt: '2026-09-05T00:00:00.000Z', readAt: null,
        }], books: [] },
      },
      updated_at: '2026-09-05T00:00:00.000Z',
    });
    globalThis.fetch = fake.fetch;
    try {
      const command = placementCommand('11111111-1111-4111-8111-111111111111', 17);
      const teacher = createResponse();
      await handler({ method: 'PUT', headers: teacherHeaders(), body: command }, teacher.response);
      assert.deepEqual(teacher.result(), { statusCode: 403, body: { error: 'LIBRARY_BOOK_FORBIDDEN' } });

      const student = createResponse();
      await handler({ method: 'PUT', headers: studentHeaders(1), body: command }, student.response);
      assert.equal(student.result().statusCode, 200);
      const payload = student.result().body as { book: { librarySlot?: number }; updatedAt: string; value: Record<string, unknown> };
      assert.equal(payload.book.librarySlot, 17);
      assert.equal(typeof payload.updatedAt, 'string');
      assert.equal(Reflect.has(payload.value, 'schedule'), false);
      assert.deepEqual(payload.value.currencyBalances, { 1: 10 });
      assert.equal(((payload.value.studentLife as { letters: Array<{ id: string }> }).letters)[0]?.id, 'keep');
      assert.equal((fake.state()?.value.studentLife as { books: unknown[] }).books.length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('same-slot race has exactly one winner while different-slot CAS retries retain both books', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const initial = { id: 'school-timer-main', value: { currencyBalances: { 1: 0, 2: 0 }, currencyHistory: {}, studentLife: { books: [] } }, updated_at: '2026-09-05T00:00:00.000Z' };
    try {
      const same = createStatefulPostgrest(initial, { readBarrier: 2 });
      globalThis.fetch = same.fetch;
      const sameResponses = [createResponse(), createResponse()];
      await Promise.all([
        handler({ method: 'PUT', headers: studentHeaders(1), body: placementCommand('11111111-1111-4111-8111-111111111111', 9, '첫 책') }, sameResponses[0].response),
        handler({ method: 'PUT', headers: studentHeaders(2), body: placementCommand('22222222-2222-4222-8222-222222222222', 9, '둘째 책') }, sameResponses[1].response),
      ]);
      assert.deepEqual(sameResponses.map(({ result }) => result().statusCode).sort(), [200, 409]);
      assert.equal((same.state()?.value.studentLife as { books: unknown[] }).books.length, 1);

      const different = createStatefulPostgrest(initial, { readBarrier: 2 });
      globalThis.fetch = different.fetch;
      const differentResponses = [createResponse(), createResponse()];
      await Promise.all([
        handler({ method: 'PUT', headers: studentHeaders(1), body: placementCommand('33333333-3333-4333-8333-333333333333', 10, '셋째 책') }, differentResponses[0].response),
        handler({ method: 'PUT', headers: studentHeaders(2), body: placementCommand('44444444-4444-4444-8444-444444444444', 11, '넷째 책') }, differentResponses[1].response),
      ]);
      assert.deepEqual(differentResponses.map(({ result }) => result().statusCode), [200, 200]);
      const books = (different.state()?.value.studentLife as { books: Array<{ librarySlot: number }> }).books;
      assert.deepEqual(books.map((book) => book.librarySlot).sort(), [10, 11]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('simultaneous initial-row placement uses insert-only and both commands survive duplicate retry', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const fake = createStatefulPostgrest(null, { readBarrier: 2 });
    globalThis.fetch = fake.fetch;
    try {
      const responses = [createResponse(), createResponse()];
      await Promise.all([
        handler({ method: 'PUT', headers: studentHeaders(1), body: placementCommand('55555555-5555-4555-8555-555555555555', 20) }, responses[0].response),
        handler({ method: 'PUT', headers: studentHeaders(2), body: placementCommand('66666666-6666-4666-8666-666666666666', 21) }, responses[1].response),
      ]);
      assert.deepEqual(responses.map(({ result }) => result().statusCode), [200, 200]);
      assert.equal((fake.state()?.value.studentLife as { books: unknown[] }).books.length, 2);
      const posts = fake.requests.filter((request) => request.method === 'POST');
      assert.equal(posts.length, 2);
      assert.equal(posts.every((request) => new URL(request.url).searchParams.has('on_conflict') === false), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('timeout after commit replay returns the same receipt and does not duplicate reward', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const fake = createStatefulPostgrest({
      id: 'school-timer-main', value: { currencyBalances: { 1: 0 }, currencyHistory: { 1: [] }, studentLife: { books: [] } },
      updated_at: '2026-09-05T00:00:00.000Z',
    }, { throwAfterFirstCommit: true });
    globalThis.fetch = fake.fetch;
    try {
      const response = createResponse();
      await handler({
        method: 'PUT', headers: studentHeaders(1),
        body: placementCommand('77777777-7777-4777-8777-777777777777', 31),
      }, response.response);
      assert.equal(response.result().statusCode, 200);
      const state = fake.state();
      assert.equal((state?.value.studentLife as { books: unknown[] }).books.length, 1);
      assert.equal((state?.value.currencyBalances as Record<string, number>)['1'], 10);
      assert.equal(((state?.value.currencyHistory as Record<string, unknown[]>)['1'] ?? []).length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('generic writers preserve authoritative books, monotonic versions, and the 1MB rejection leaves state unchanged', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const originalNow = Date.now;
    const initialUpdatedAt = '2026-09-05T00:00:00.000Z';
    const authoritativeBook = {
      id: 'authoritative', studentNumber: 1, title: '보존', author: '작가', pageCount: 10,
      createdAt: '2026-09-05T00:00:00.000Z', colorIndex: 0, librarySlot: 1,
    };
    const fake = createStatefulPostgrest({
      id: 'school-timer-main', value: { marker: 'old', studentLife: { books: [authoritativeBook], letters: [{ id: 'old-letter' }] } },
      updated_at: initialUpdatedAt,
    });
    Date.now = () => Date.parse(initialUpdatedAt);
    globalThis.fetch = fake.fetch;
    try {
      const beforeVersion = fake.state()?.updated_at ?? '';
      const write = createResponse();
      await handler({
        method: 'PUT', headers: teacherHeaders(),
        body: { value: { marker: 'new', studentLife: { books: [], letters: [{ id: 'new-letter' }] } }, expectedUpdatedAt: beforeVersion },
      }, write.response);
      assert.equal(write.result().statusCode, 200);
      assert.equal(Date.parse(fake.state()?.updated_at ?? ''), Date.parse(beforeVersion) + 1);
      assert.deepEqual((fake.state()?.value.studentLife as { books: unknown }).books, [authoritativeBook]);

      const beforeOversize = fake.state();
      const oversized = createResponse();
      await handler({
        method: 'PUT', headers: teacherHeaders(),
        body: { value: { huge: 'x'.repeat(1_048_577) }, expectedUpdatedAt: fake.state()?.updated_at },
      }, oversized.response);
      assert.equal(oversized.result().statusCode, 400);
      assert.deepEqual(fake.state(), beforeOversize);
    } finally {
      Date.now = originalNow;
      globalThis.fetch = originalFetch;
    }
  });
});

test('fixed-millisecond economy and library writers cannot alias a CAS version or erase either result', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const originalNow = Date.now;
    const initialUpdatedAt = '2026-08-26T00:00:00.000Z';
    const fake = createStatefulPostgrest({
      id: 'school-timer-main',
      value: {
        currencyBalances: { 1: 145 }, currencyHistory: { 1: [] }, studentEconomy: {},
        studentLife: { letters: [], books: [], failureStories: [], failureProfileAssignments: {} },
      },
      updated_at: initialUpdatedAt,
    }, { readBarrier: 2 });
    Date.now = () => Date.parse(initialUpdatedAt);
    globalThis.fetch = fake.fetch;
    try {
      const economy = createResponse();
      const library = createResponse();
      await Promise.all([
        studentEconomyHandler({
          method: 'POST', headers: studentHeaders(1),
          body: {
            studentNumber: 1,
            action: { type: 'open_deposit', amount: 30, dateKey: '2026-08-26' },
            requestId: 'student-economy-cross-writer-cas',
          },
        }, economy.response),
        handler({
          method: 'PUT', headers: studentHeaders(1),
          body: placementCommand('88888888-8888-4888-8888-888888888888', 40),
        }, library.response),
      ]);
      assert.equal(economy.result().statusCode, 200);
      assert.equal(library.result().statusCode, 200);
      const state = fake.state();
      assert.equal((state?.value.studentLife as { books: unknown[] }).books.length, 1);
      assert.equal(Reflect.get(
        Reflect.get(state?.value.studentEconomy as object, '1') as object,
        'deposit',
      ), 30);
      assert.equal((state?.value.currencyBalances as Record<string, number>)['1'], 125);
      assert.equal(Date.parse(state?.updated_at ?? ''), Date.parse(initialUpdatedAt) + 2);
    } finally {
      Date.now = originalNow;
      globalThis.fetch = originalFetch;
    }
  });
});

test('placement rejects malformed authoritative rows and upstream write failures without reporting success', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => Response.json([{
        id: 'school-timer-main', value: { studentLife: { books: [] } }, updated_at: 'not-a-date',
      }]);
      const malformed = createResponse();
      await handler({
        method: 'PUT', headers: studentHeaders(1),
        body: placementCommand('99999999-9999-4999-8999-999999999999', 50),
      }, malformed.response);
      assert.deepEqual(malformed.result(), { statusCode: 502, body: { error: 'LIBRARY_SAVE_FAILED' } });

      let fetchCount = 0;
      globalThis.fetch = async (_input, init) => {
        fetchCount += 1;
        return init?.method === 'PATCH'
          ? Response.json({ error: 'synthetic' }, { status: 500 })
          : Response.json([{
              id: 'school-timer-main', value: { studentLife: { books: [] } },
              updated_at: '2026-09-05T00:00:00.000Z',
            }]);
      };
      const failedWrite = createResponse();
      await handler({
        method: 'PUT', headers: studentHeaders(1),
        body: placementCommand('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab', 51),
      }, failedWrite.response);
      assert.deepEqual(failedWrite.result(), { statusCode: 502, body: { error: 'LIBRARY_SAVE_FAILED' } });
      assert.equal(fetchCount, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('placement stops after five fresh CAS conflicts and leaves authoritative state unchanged', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const authoritative = {
      id: 'school-timer-main', value: { marker: 'keep', studentLife: { books: [] } },
      updated_at: '2026-09-05T00:00:00.000Z',
    };
    let reads = 0;
    let patches = 0;
    globalThis.fetch = async (_input, init) => {
      if (!init?.method) {
        reads += 1;
        return Response.json([structuredClone(authoritative)]);
      }
      patches += 1;
      return Response.json([]);
    };
    try {
      const response = createResponse();
      await handler({
        method: 'PUT', headers: studentHeaders(1),
        body: placementCommand('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 60),
      }, response.response);
      assert.deepEqual(response.result(), { statusCode: 409, body: { error: 'SHARED_SETTINGS_CONFLICT' } });
      assert.equal(reads, 5);
      assert.equal(patches, 5);
      assert.deepEqual(authoritative.value, { marker: 'keep', studentLife: { books: [] } });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
