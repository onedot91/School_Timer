import { assembleStorageState, isStorageRecord, splitStorageState, storageScopeKey, type StorageResource, type StorageWallet, type StorageHistoryRecord } from '../../src/lib/storageV2Codec.js';
import { buildScopedStorageMutation, parseScopedStorageSnapshot, parseStorageSnapshot } from '../../src/server/storageV2Repository.js';
import { applyLibraryPlacementCommand } from '../../src/lib/canvasLibraryPlacement.js';
import { getLibraryCompetitionMonth, parseLibraryCompetitionState } from '../../src/lib/libraryCompetition.js';
import { libraryCompetitionStorageScope } from '../../src/server/libraryCompetitionRepository.js';
import { parseStorageScope, storageResourceMatchesScope, storageScopeRevisionKeys, storageScopeStructuralKeys, storageStructuralAncestor } from '../../src/server/storageScope.js';

/** Disposable RPC adapter. Real PostgreSQL integration separately verifies the transaction implementation. */
export const createStorageV2Fixture = (initialValue: Record<string, unknown>, initialTimestamp = '2026-01-01T00:00:00.000Z') => {
  let encoded = splitStorageState(structuredClone(initialValue));
  let updatedAt = initialTimestamp;
  let revision = 1;
  const revisions: Record<string, number> = Object.fromEntries([
    ...encoded.resources.map(resource => [resource.resource_key, 1]),
    ...encoded.wallets.map(wallet => [`wallet:${wallet.student_number}`, 1]),
  ]);
  const archives = new Map<string, Record<string, unknown>>();
  const receipts = new Map<string, Record<string, unknown>>();
  let commitFailure = 0;
  let loseResponse = false;
  let placementQueue: Promise<unknown> = Promise.resolve();
  const snapshot = () => ({ ...encoded, updated_at: updatedAt, revisions: { ...revisions } });
  const read = () => ({ id: 'school-timer-main', value: assembleStorageState(encoded), updated_at: updatedAt, revisions: { ...revisions } });
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : {};
    if (!isStorageRecord(body)) throw new Error('Invalid fixture command');
    if (url.pathname.endsWith('/storage_place_library_book')) {
      const transaction = placementQueue.then(async () => {
        if (commitFailure) return Response.json({ code: 'P0001' }, { status: commitFailure });
        if (typeof body.p_student_number !== 'number' || !isStorageRecord(body.p_command) || typeof body.p_command.requestId !== 'string') throw new Error('Invalid fixture placement');
        const command = body.p_command;
        const studentNumber = body.p_student_number;
        const requestId = body.p_command.requestId;
        const actor = `student:${body.p_student_number}`;
        const previous = receipts.get(`${actor}:${command.requestId}`);
        const scopedRead = async () => (await fetcher(`${url.origin}/rest/v1/rpc/storage_load_scope`, { body: JSON.stringify({ p_scope: libraryCompetitionStorageScope(studentNumber) }) })).json();
        if (previous) {
          if (previous.payloadHash !== body.p_payload_hash) return Response.json({ message: 'STORAGE_REQUEST_REUSED' }, { status: 409 });
          return Response.json({ saved: true, result: previous.result, snapshot: await scopedRead() });
        }
        const current = read().value;
        const competition = parseLibraryCompetitionState(current.libraryCompetition);
        if (current.libraryCompetition && !competition) return Response.json({ message: 'LIBRARY_COMPETITION_INVALID_STATE' }, { status: 502 });
        if (competition && competition.seasonId !== getLibraryCompetitionMonth(new Date(Date.now()).toISOString())) return Response.json({ error: 'LIBRARY_SEASON_ROLLOVER_REQUIRED', status: 409 });
        const at = new Date(Math.max(Date.now(), Date.parse(updatedAt) + 1)).toISOString();
        const placement = applyLibraryPlacementCommand(current, body.p_student_number, command, at);
        if (placement.ok === false) return Response.json({ error: placement.error.code, status: placement.error.status });
        const mutation = buildScopedStorageMutation({ snapshot: parseScopedStorageSnapshot(await scopedRead()), value: placement.value,
          actorKey: actor, requestId, action: 'placeLibraryBook', payload: command, result: { book: placement.book, updatedAt: at } });
        const committed = await fetcher(`${url.origin}/rest/v1/rpc/storage_commit_scoped_mutation`, { body: JSON.stringify(mutation) });
        const result: unknown = await committed.json();
        if (!committed.ok) return Response.json(result, { status: committed.status });
        return Response.json({ ...isStorageRecord(result) ? result : {}, snapshot: await scopedRead() });
      });
      placementQueue = transaction.catch(() => undefined);
      return transaction;
    }
    if (url.pathname.endsWith('/storage_load_updated_at')) return Response.json(updatedAt);
    if (url.pathname.endsWith('/storage_load_snapshot')) return Response.json(snapshot());
    if (url.pathname.endsWith('/storage_load_scope')) {
      const scope = parseStorageScope(body.p_scope);
      const selected = encoded.resources.filter(resource => storageResourceMatchesScope(resource, scope.resources));
      const selectedKeys = [...selected.map(resource => resource.resource_key), ...scope.resources.map(resource => resource.path), ...storageScopeStructuralKeys(scope)];
      const resources = encoded.resources.filter(resource => selected.some(entry => entry.resource_key === resource.resource_key) || storageStructuralAncestor(resource, selectedKeys) || storageScopeStructuralKeys(scope).includes(resource.resource_key));
      for (const key of storageScopeStructuralKeys(scope)) {
        if (resources.some(resource => resource.resource_key === key)) continue;
        const parts = key.split('/');
        const member = parts.at(-1) ?? '';
        const parentKey = key === '' ? null : key.slice(0, key.lastIndexOf('/'));
        resources.push({ resource_key: key, category: parts[1] ?? 'root', owner_number: /^\d+$/.test(member) ? Number(member) : null,
          value: { kind: key.startsWith('/currencyHistory/') ? 'array' : 'object', parentKey, member } });
      }
      const revisionKeys = new Set([...storageScopeRevisionKeys(scope), ...resources.map(resource => resource.resource_key)]);
      const orderingBounds: Record<string, { minimum: number; maximum: number }> = {};
      for (const resource of encoded.resources) {
        if (resource.value.order === undefined || resource.value.parentKey === null) continue;
        const parent = resource.value.parentKey;
        if (!selectedKeys.some(key => key === parent || key.startsWith(`${parent}/`))) continue;
        const previous = orderingBounds[parent];
        orderingBounds[parent] = { minimum: Math.min(previous?.minimum ?? resource.value.order, resource.value.order), maximum: Math.max(previous?.maximum ?? resource.value.order, resource.value.order) };
      }
      return Response.json({ kind: 'scoped', scope, resources,
        wallets: encoded.wallets.filter(wallet => scope.wallets.includes(wallet.student_number)),
        history: encoded.history.filter(entry => scope.history.includes(entry.student_number)),
        revisions: Object.fromEntries([...revisionKeys].map(key => [key, revisions[key] ?? 0])),
        updated_at: updatedAt, deletedKeys: [], orderingBounds,
      });
    }
    if (url.pathname.endsWith('/storage_get_receipt')) return Response.json(receipts.get(`${body.p_actor_key}:${body.p_request_id}`) ?? { found: false });
    if (url.pathname.endsWith('/storage_commit_mutation') || url.pathname.endsWith('/storage_commit_scoped_mutation')) {
      if (commitFailure) return Response.json({ code: 'P0001' }, { status: commitFailure });
      const key = `${body.p_actor_key}:${body.p_request_id}`;
      const previous = receipts.get(key);
      if (previous) {
        if (previous.payloadHash !== body.p_payload_hash) return Response.json({ message: 'STORAGE_REQUEST_REUSED' }, { status: 409 });
        return Response.json({ saved: true, result: previous.result, updatedAt: previous.committedAt });
      }
      if (!isStorageRecord(body.p_expected) || !Array.isArray(body.p_resources) || !Array.isArray(body.p_wallets) || !Array.isArray(body.p_ledger)) throw new Error('Invalid fixture mutation');
      if (Object.entries(body.p_expected).some(([resource, expected]) => (revisions[resource] ?? 0) !== expected)) return Response.json({ saved: false });
      const resources = new Map(encoded.resources.map(resource => [resource.resource_key, resource]));
      const wallets = new Map(encoded.wallets.map(wallet => [wallet.student_number, wallet]));
      const history = new Map(encoded.history.map(entry => [entry.resource_key, entry]));
      const dirty = new Set<string>();
      for (const change of body.p_resources) {
        if (!isStorageRecord(change) || typeof change.resource_key !== 'string' || typeof change.category !== 'string' || (change.owner_number !== null && typeof change.owner_number !== 'number')) throw new Error('Invalid fixture resource');
        const old = resources.get(change.resource_key);
        if (change.value === null) resources.delete(change.resource_key);
        else {
          const validated = parseStorageSnapshot({ resources: [{ resource_key: '', category: 'root', owner_number: null, value: { kind: 'object', parentKey: null, member: '' } }, change], wallets: [], history: [], revisions: {}, updated_at: updatedAt });
          const next = validated.resources?.find(resource => resource.resource_key === change.resource_key);
          if (!next) throw new Error('Missing fixture resource');
          resources.set(change.resource_key, next);
        }
        dirty.add(change.resource_key);
        dirty.add(storageScopeKey(change.category, typeof change.owner_number === 'number' ? change.owner_number : null));
        dirty.add(`scope:${change.category}:all`);
        const parent = isStorageRecord(change.value) ? change.value.parentKey : old?.value.parentKey;
        if (typeof parent === 'string') dirty.add(`collection:${parent}`);
      }
      for (const wallet of body.p_wallets) {
        if (!isStorageRecord(wallet) || typeof wallet.student_number !== 'number' || typeof wallet.balance !== 'number') throw new Error('Invalid fixture wallet');
        wallets.set(wallet.student_number, { student_number: wallet.student_number, balance: wallet.balance });
        dirty.add(`wallet:${wallet.student_number}`);
      }
      for (const entry of body.p_ledger) {
        if (!isStorageRecord(entry) || typeof entry.resource_key !== 'string' || typeof entry.student_number !== 'number' || typeof entry.entry_id !== 'string' || typeof entry.sort_order !== 'number' || !isStorageRecord(entry.value) || entry.value.kind !== 'value' || typeof entry.value.parentKey !== 'string' || typeof entry.value.member !== 'string') throw new Error('Invalid fixture history');
        history.set(entry.resource_key, { resource_key: entry.resource_key, student_number: entry.student_number, entry_id: entry.entry_id, sort_order: entry.sort_order, value: { kind: 'value', parentKey: entry.value.parentKey, member: entry.value.member, data: entry.value.data } });
        dirty.add(`wallet:${entry.student_number}`);
      }
      if (isStorageRecord(body.p_archive)) {
        if (typeof body.p_archive.seasonId !== 'string' || archives.has(body.p_archive.seasonId)) throw new Error('Duplicate fixture archive');
        archives.set(body.p_archive.seasonId, structuredClone(body.p_archive));
      }
      revision += 1;
      for (const resource of dirty) revisions[resource] = revision;
      updatedAt = new Date(Math.max(Date.now(), Date.parse(updatedAt) + 1)).toISOString();
      encoded = { resources: [...resources.values()], wallets: [...wallets.values()], history: [...history.values()] } satisfies { resources: StorageResource[]; wallets: StorageWallet[]; history: StorageHistoryRecord[] };
      const receipt = { found: true, action: body.p_action, payloadHash: body.p_payload_hash, result: body.p_result, committedAt: updatedAt, ...(body.p_scope ? { scope: body.p_scope } : {}) };
      receipts.set(key, receipt);
      if (loseResponse) { loseResponse = false; throw new TypeError('Fixture response lost after commit'); }
      return Response.json({ saved: true, result: body.p_result, updatedAt });
    }
    if (url.pathname.endsWith('/library_competition_archives')) return Response.json([...archives.values()].map(archive => ({ season_id: archive.seasonId, archived_at: archive.archivedAt, standings: archive.standings, books: archive.books })));
    throw new Error(`Unexpected fixture path: ${url.pathname}`);
  };
  return { fetch: fetcher, read, archives, receipts,
    set: (value: Record<string, unknown>) => {
      encoded = splitStorageState(structuredClone(value));
      for (const resource of encoded.resources) revisions[resource.resource_key] ??= 1;
      for (const wallet of encoded.wallets) revisions[`wallet:${wallet.student_number}`] ??= 1;
    },
    setTimestamp: (timestamp: string) => { updatedAt = timestamp; },
    failNextCommit: (status = 500) => { commitFailure = status; },
    loseNextCommitResponse: () => { loseResponse = true; },
  };
};
