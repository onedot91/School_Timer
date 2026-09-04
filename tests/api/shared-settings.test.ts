import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../../api/shared-settings.js';
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
      return Response.json([{ updated_at: 'v2' }]);
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
      assert.deepEqual(first.result().body, { updatedAt: 'v2' });
      assert.deepEqual(second.result().body, { updatedAt: 'v2' });
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
    globalThis.fetch = async (_input, init) => {
      if (!init?.method) {
        markMetadataStarted?.();
        await metadataGate;
        return Response.json([{ updated_at: 'v1' }]);
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
        body: { value: { schedule: ['수학'] }, expectedUpdatedAt: 'v1' },
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
        updated_at: 'v2',
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
          updated_at: 'v2',
        }]);
      }
      return Response.json([{
        id: 'school-timer-main',
        value: { weeklySchedule: ['월요일'] },
        updated_at: 'v2',
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
      return Response.json([{ id: 'school-timer-main', value: { schedule: ['수학'], currencyBalances: { 7: 100 } }, updated_at: 'v1' }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: { value: { schedule: ['체육'], currencyBalances: { 7: 100 } }, expectedUpdatedAt: 'v1' },
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
        return Response.json([{ id: 'school-timer-main', value: { schedule: ['수학'], currencyBalances: { 7: 100, 8: 100 } }, updated_at: 'v1' }]);
      }
      savedValue = JSON.parse(String(init?.body)).value;
      return Response.json([{ id: 'school-timer-main' }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: { value: { currencyBalances: { 7: 105 } }, expectedUpdatedAt: 'v1' },
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
        updated_at: 'v1',
      }]);
    };

    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: {
          value: { studentLife: 'b'.repeat(600_000) },
          expectedUpdatedAt: 'v1',
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
        updated_at: 'v1',
      }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: {
          value: { studentEconomy: { 7: { processedRequestIds: ['forged-request'] } } },
          expectedUpdatedAt: 'v1',
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
        updated_at: 'v1',
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
          expectedUpdatedAt: 'v1',
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
        updated_at: 'v1',
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
          expectedUpdatedAt: 'v1',
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
          ? Response.json([{ id: 'school-timer-main', value: scenario.previousValue, updated_at: 'v1' }])
          : Response.json([{ id: 'school-timer-main' }]);
      };

      try {
        const { response, result } = createResponse();
        await handler({
          method: 'PUT',
          headers: studentHeaders(7),
          body: { value: scenario.nextValue, expectedUpdatedAt: 'v1' },
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
          ? Response.json([{ id: 'school-timer-main', value: previousValue, updated_at: 'v1' }])
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
            expectedUpdatedAt: 'v1',
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
      return Response.json([{ id: 'school-timer-main', value: { currencyBalances: { 7: 100 } }, updated_at: 'v1' }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: studentHeaders(7),
        body: { value: { currencyBalances: { 7: 100, 8: 999 } }, expectedUpdatedAt: 'v1' },
      }, response);
      assert.equal(result().statusCode, 403);
      assert.equal(fetchCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('teacher update with a known version writes without rereading shared settings', async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];
    globalThis.fetch = async (input) => {
      requests.push(String(input));
      return Response.json([{ id: 'school-timer-main' }]);
    };
    try {
      const { response, result } = createResponse();
      await handler({
        method: 'PUT',
        headers: teacherHeaders(),
        body: { value: { dailyWriting: { assignment: null } }, expectedUpdatedAt: 'v1' },
      }, response);
      assert.equal(result().statusCode, 200);
      assert.equal(requests.length, 1);
      assert.match(requests[0] ?? '', /updated_at=eq\.v1/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
