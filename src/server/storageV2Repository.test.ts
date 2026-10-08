import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStorageMutation, storagePayloadHash, parseStorageSnapshot, pollScopedStorageMetadata, StorageRepositoryError } from './storageV2Repository.js';
import { splitStorageState } from '../lib/storageV2Codec.js';

test('a stalled poll leader cannot hold another scope for its full timeout', async () => {
    const originalFetch = globalThis.fetch;
    const config = { url: 'https://bounded-poll.test', key: 'fixture' };
    const marker = 'a'.repeat(32);
    const scope = { resources: [], wallets: [1], history: [1], writeResources: [], writeWallets: [] };
    const base = { updatedAt: '2026-10-08T00:00:00Z', readMarker: marker, readVersion: 'b'.repeat(32) };
    let release: (response: Response) => void = () => {};
    let ownCalls = 0;
    globalThis.fetch = async input => {
        if (String(input).endsWith('/storage_poll_scope')) return new Promise<Response>(resolve => { release = resolve; });
        ownCalls++;
        return Response.json(base);
    };
    try {
        const leader = pollScopedStorageMetadata(config, scope, marker);
        const follower = pollScopedStorageMetadata(config, { ...scope, wallets: [2], history: [2] }, marker);
        assert.deepEqual(await follower, base);
        assert.equal(ownCalls, 1, 'Follower completes while leader is still unresolved');
        release(Response.json({ updatedAt: base.updatedAt, readMarker: marker, unchanged: true }));
        await leader;
        assert.equal(ownCalls, 1, 'Late leader completion must not replay the follower read');
    } finally { globalThis.fetch = originalFetch; }
});
test('unrelated letter inserts do not compare a shared collection revision', () => {
    const value = { studentLife: { letters: [{ id: 'a', content: 'existing' }] } };
    const encoded = splitStorageState(value);
    const mutation = buildStorageMutation({ snapshot: { value, updated_at: '2026-09-08T00:00:00Z', revisions: {}, resources: encoded.resources }, value: { studentLife: { letters: [{ id: 'b', content: 'new' }, ...value.studentLife.letters] } }, actorKey: 'student:1', requestId: 'r', action: 'student.send', payload: { content: 'new' }, result: { saved: true } });
    assert.deepEqual(mutation.p_expected, { '/studentLife/letters/@b': 0, '/studentLife/letters': 0, '/studentLife': 0, '': 0 });
    assert.equal(Array.isArray(mutation.p_resources) && mutation.p_resources.length, 1);
});
test('wallet changes include only new history and predicate revisions', () => {
    const old = { id: 'old', studentNumber: 1, delta: 2, before: 0, after: 2, reason: 'weekly_mission', createdAt: '2026-01-01T00:00:00Z' };
    const value = { currencyBalances: { '1': 10 }, currencyHistory: { '1': [old] } };
    const next = { currencyBalances: { '1': 16 }, currencyHistory: { '1': [{ id: 'new', studentNumber: 1, delta: 6, before: 10, after: 16, reason: 'weekly_mission', createdAt: '2026-09-08T00:00:00Z' }, old] } };
    const payload = buildStorageMutation({ snapshot: { value, updated_at: 'x', revisions: { 'wallet:1': 2, 'scope:auctionBids:all': 8 } }, value: next, actorKey: 'student:1', requestId: 'r', action: 'reward', payload: {}, result: {}, readKeys: ['scope:auctionBids:all'] });
    assert.deepEqual(payload.p_expected, { 'scope:auctionBids:all': 8, 'wallet:1': 2 });
    assert.equal(Array.isArray(payload.p_ledger) && payload.p_ledger.length, 1);
});
test('snapshot parser rejects untyped or missing protocol records', () => {
    assert.throws(() => parseStorageSnapshot({}), StorageRepositoryError);
    const encoded = splitStorageState({ currencyBalances: { '1': 5 }, currencyHistory: { '1': [] } });
    assert.deepEqual(parseStorageSnapshot({ ...encoded, revisions: {}, updated_at: '2026-09-08T00:00:00Z' }).value, { currencyBalances: { '1': 5 }, currencyHistory: { '1': [] } });
    assert.equal(storagePayloadHash('send', { a: 1, b: 2 }), storagePayloadHash('send', { b: 2, a: 1 }));
    assert.notEqual(storagePayloadHash('send', { a: 1 }), storagePayloadHash('delete', { a: 1 }));
});

test('combined polling merges the same scope and preserves separate changed versions for other scopes', async () => {
    const configuration = { url: 'https://polling.test', key: 'test-key' };
    const scope = { resources: [], wallets: [7], history: [7], writeResources: [], writeWallets: [] };
    const otherScope = { ...scope, wallets: [8], history: [8] };
    const marker = 'a'.repeat(32);
    const originalFetch = globalThis.fetch;
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const calls: unknown[] = [];
    globalThis.fetch = async (input, init) => {
        const body = JSON.parse(String(init?.body));
        const rpc = String(input).split('/').at(-1);
        assert.equal(rpc, body.p_scope.wallets[0] === 8 ? 'storage_load_scope_metadata' : 'storage_poll_scope');
        calls.push(body);
        await gate;
        return Response.json({ updatedAt: '2026-10-06T00:00:00Z', readMarker: marker,
            readVersion: (body.p_scope.wallets[0] === 8 ? 'd' : 'b').repeat(32) });
    };
    try {
        const first = pollScopedStorageMetadata(configuration, scope, marker);
        const duplicate = pollScopedStorageMetadata(configuration, { ...scope }, marker);
        const differentMarker = pollScopedStorageMetadata(configuration, scope, 'c'.repeat(32));
        const differentScope = pollScopedStorageMetadata(configuration, otherScope, marker);
        assert.equal(calls.length, 2);
        release();
        const results = await Promise.all([first, duplicate, differentMarker, differentScope]);
        assert.deepEqual(results[0], results[1]);
        assert.equal('readVersion' in results[0] && results[0].readVersion, 'b'.repeat(32));
        assert.equal('readVersion' in results[3] && results[3].readVersion, 'd'.repeat(32));
        assert.equal(calls.length, 3);
        await pollScopedStorageMetadata(configuration, scope, marker);
        assert.equal(calls.length, 4);
    } finally {
        release();
        globalThis.fetch = originalFetch;
    }
});

test('combined polling clears failed requests so the next poll reads afresh', async () => {
    const configuration = { url: 'https://polling-recovery.test', key: 'test-key' };
    const scope = { resources: [], wallets: [7], history: [7], writeResources: [], writeWallets: [] };
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
        calls += 1;
        if (calls === 1) throw new TypeError('network failure');
        return Response.json({ updatedAt: '2026-10-06T00:00:00Z', readMarker: 'a'.repeat(32), readVersion: 'b'.repeat(32) });
    };
    try {
        const results = await Promise.allSettled([
            pollScopedStorageMetadata(configuration, scope, null),
            pollScopedStorageMetadata(configuration, scope, null),
        ]);
        for (const result of results) {
            assert.equal(result.status, 'rejected');
            if (result.status === 'rejected') {
                assert.ok(result.reason instanceof StorageRepositoryError);
                assert.equal(result.reason.code, 'STORAGE_DATABASE_NETWORK');
            }
        }
        assert.equal(calls, 1);
        assert.deepEqual(await pollScopedStorageMetadata(configuration, scope, null), {
            updatedAt: '2026-10-06T00:00:00Z', readMarker: 'a'.repeat(32), readVersion: 'b'.repeat(32),
        });
        assert.equal(calls, 2);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

for (const unchanged of [true, false]) {
    test(`combined polling shares 23 simultaneous scopes only when the global marker is unchanged=${unchanged}`, async () => {
        const configuration = { url: 'https://polling-classroom.test', key: 'test-key' };
        const marker = 'a'.repeat(32);
        const updatedAt = '2026-10-06T00:00:00Z';
        const scopes = Array.from({ length: 23 }, (_, index) => ({
            resources: [], wallets: [index + 1], history: [index + 1], writeResources: [], writeWallets: [],
        }));
        const originalFetch = globalThis.fetch;
        let release: () => void = () => undefined;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const calls: { rpc: string | undefined; student: number }[] = [];
        globalThis.fetch = async (input, init) => {
            const body = JSON.parse(String(init?.body));
            const rpc = String(input).split('/').at(-1);
            const student = body.p_scope.wallets[0];
            calls.push({ rpc, student });
            await gate;
            return Response.json(unchanged ? { updatedAt, readMarker: marker, unchanged: true }
                : { updatedAt, readMarker: 'b'.repeat(32), readVersion: student.toString(16).padStart(32, '0') });
        };
        try {
            const pending = scopes.map(scope => pollScopedStorageMetadata(configuration, scope, marker));
            assert.deepEqual(calls, [{ rpc: 'storage_poll_scope', student: 1 }]);
            release();
            const results = await Promise.all(pending);
            if (unchanged) {
                assert.equal(calls.length, 1);
                results.forEach(result => assert.deepEqual(result, { updatedAt, readMarker: marker, unchanged: true }));
            } else {
                assert.equal(calls.length, 23);
                assert.deepEqual(calls.slice(1), scopes.slice(1).map(scope => ({ rpc: 'storage_load_scope_metadata', student: scope.wallets[0] })));
                results.forEach((result, index) => assert.deepEqual(result, {
                    updatedAt, readMarker: 'b'.repeat(32), readVersion: (index + 1).toString(16).padStart(32, '0'),
                }));
            }
            await pollScopedStorageMetadata(configuration, scopes[22], marker);
            assert.equal(calls.length, unchanged ? 2 : 24);
            assert.deepEqual(calls.at(-1), { rpc: 'storage_poll_scope', student: 23 });
        } finally {
            release();
            globalThis.fetch = originalFetch;
        }
    });
}

test('combined polling never shares different credentials, URLs, markers or absent markers across scopes', async () => {
    const configuration = { url: 'https://polling-isolation.test', key: 'test-key' };
    const scope = { resources: [], wallets: [7], history: [7], writeResources: [], writeWallets: [] };
    const otherScope = { ...scope, wallets: [8], history: [8] };
    const marker = 'a'.repeat(32);
    const originalFetch = globalThis.fetch;
    let release: () => void = () => undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let calls = 0;
    globalThis.fetch = async (input, init) => {
        calls += 1;
        assert.ok(String(input).endsWith('/storage_poll_scope'));
        const body = JSON.parse(String(init?.body));
        await gate;
        return Response.json({ updatedAt: '2026-10-06T00:00:00Z', readMarker: body.p_known_read_marker ?? marker, readVersion: 'b'.repeat(32) });
    };
    try {
        const pending = [
            pollScopedStorageMetadata(configuration, scope, marker),
            pollScopedStorageMetadata({ ...configuration, key: 'other-key' }, otherScope, marker),
            pollScopedStorageMetadata({ ...configuration, url: 'https://polling-other.test' }, otherScope, marker),
            pollScopedStorageMetadata(configuration, otherScope, 'c'.repeat(32)),
            pollScopedStorageMetadata(configuration, scope, null),
            pollScopedStorageMetadata(configuration, otherScope, null),
        ];
        assert.equal(calls, 6);
        release();
        await Promise.all(pending);
        assert.equal(calls, 6);
    } finally {
        release();
        globalThis.fetch = originalFetch;
    }
});

test('combined polling followers independently recover or reject their own metadata after a leader fails', async () => {
    const configuration = { url: 'https://polling-follower-recovery.test', key: 'test-key' };
    const scope = { resources: [], wallets: [7], history: [7], writeResources: [], writeWallets: [] };
    const otherScope = { ...scope, wallets: [8], history: [8] };
    const marker = 'a'.repeat(32);
    const base = { updatedAt: '2026-10-06T00:00:00Z', readMarker: marker, readVersion: 'b'.repeat(32) };
    const originalFetch = globalThis.fetch;
    try {
        const cases = [
            { result: () => Response.json(base), code: null },
            { result: () => Response.json({ updatedAt: base.updatedAt, readVersion: base.readVersion }), code: 'STORAGE_INVALID_RESPONSE' },
            { result: () => Response.json({ ...base, readMarker: 'invalid' }), code: 'STORAGE_INVALID_RESPONSE' },
            { result: () => Response.json({ ...base, readVersion: 'invalid' }), code: 'STORAGE_INVALID_RESPONSE' },
            { result: () => Response.json({ code: '40001' }, { status: 503 }), code: 'STORAGE_SERIALIZATION_RETRY' },
            { result: () => { throw new TypeError('follower failed'); }, code: 'STORAGE_DATABASE_NETWORK' },
        ];
        for (const scenario of cases) {
            const calls: string[] = [];
            globalThis.fetch = async (input, init) => {
                const rpc = String(input).split('/').at(-1) ?? '';
                calls.push(rpc);
                if (rpc === 'storage_poll_scope') throw new TypeError('leader failed');
                assert.equal(rpc, 'storage_load_scope_metadata');
                assert.deepEqual(JSON.parse(String(init?.body)).p_scope.wallets, [8]);
                return scenario.result();
            };
            const results = await Promise.allSettled([
                pollScopedStorageMetadata(configuration, scope, marker),
                pollScopedStorageMetadata(configuration, otherScope, marker),
            ]);
            assert.equal(results[0].status, 'rejected');
            const follower = results[1];
            if (scenario.code === null) {
                assert.equal(follower.status, 'fulfilled');
                if (follower.status === 'fulfilled') assert.deepEqual(follower.value, base);
            } else {
                assert.equal(follower.status, 'rejected');
                if (follower.status === 'rejected') {
                    assert.ok(follower.reason instanceof StorageRepositoryError);
                    assert.equal(follower.reason.code, scenario.code);
                }
            }
            assert.deepEqual(calls, ['storage_poll_scope', 'storage_load_scope_metadata']);
            await assert.rejects(pollScopedStorageMetadata(configuration, scope, marker), { code: 'STORAGE_DATABASE_NETWORK' });
            assert.equal(calls.length, 3);
        }
    } finally {
        globalThis.fetch = originalFetch;
    }
});
