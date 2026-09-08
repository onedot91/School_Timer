import { createHash } from 'node:crypto';
import { parseStorageScope, storageResourceMatchesScope, storageStructuralAncestor, storageScopeStructuralKeys, storageScopeRevisionKeys, StorageScopeError, type StorageScope, type StorageOrderingBounds } from './storageScope.js';
import { assembleStorageState, canonicalStorageJson, isStorageRecord, reconcileStorageResourceOrder, splitStorageState, type StorageHistoryRecord, type StorageResource, type StorageResourceValue, type StorageWallet, } from '../lib/storageV2Codec.js';
export interface StorageConfiguration {
    readonly url: string;
    readonly key: string;
}
export interface StorageSnapshot {
    readonly kind?: 'full';
    readonly wallets?: readonly StorageWallet[];
    readonly history?: readonly StorageHistoryRecord[];
    readonly value: Record<string, unknown>;
    readonly updated_at: string;
    readonly revisions: Record<string, number>;
    readonly resources?: readonly StorageResource[];
}
export interface StorageArchive {
    readonly seasonId: string;
    readonly archivedAt: string;
    readonly standings: unknown;
    readonly books: unknown;
}
export interface StorageMutation {
    readonly snapshot: StorageSnapshot;
    readonly value: Record<string, unknown>;
    readonly actorKey: string;
    readonly requestId: string;
    readonly action: string;
    readonly payload: unknown;
    readonly result: unknown;
    readonly readKeys?: readonly string[];
    readonly archive?: StorageArchive;
}
export class StorageRepositoryError extends Error {
    constructor(readonly status: number, readonly code: string) { super(code); this.name = 'StorageRepositoryError'; }
}
const invalid = (): never => { throw new StorageRepositoryError(502, 'STORAGE_INVALID_RESPONSE'); };
const request = async (configuration: StorageConfiguration, path: string, payload: unknown): Promise<unknown> => {
    const response = await fetch(`${configuration.url}/rest/v1/rpc/${path}`, {
        method: 'POST', headers: { apikey: configuration.key, Authorization: `Bearer ${configuration.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
    });
    const body: unknown = await response.json();
    if (!response.ok) {
        const message = isStorageRecord(body) && typeof body.message === 'string' ? body.message : '';
        if (isStorageRecord(body) && ['40001', '40P01', '55P03'].includes(String(body.code)))
            throw new StorageRepositoryError(503, 'STORAGE_SERIALIZATION_RETRY');
        const allowed = ['STORAGE_MAINTENANCE', 'STORAGE_NOT_ACTIVE', 'STORAGE_REQUEST_REUSED', 'STORAGE_BALANCE_MISMATCH', 'STORAGE_LEDGER_IMMUTABLE', 'STORAGE_INVALID_MUTATION', 'STORAGE_SCOPE_VIOLATION'];
        const code = allowed.find((candidate) => message === candidate);
        throw new StorageRepositoryError(code === 'STORAGE_MAINTENANCE' || code === 'STORAGE_NOT_ACTIVE' ? 503 : code === 'STORAGE_REQUEST_REUSED' ? 409 : code === 'STORAGE_SCOPE_VIOLATION' ? 400 : 502, code ?? `STORAGE_DATABASE_HTTP_${response.status}`);
    }
    return body;
};
const parseValue = (value: unknown): StorageResourceValue => {
    if (!isStorageRecord(value) || !['value', 'object', 'array'].includes(String(value.kind)) || (value.parentKey !== null && typeof value.parentKey !== 'string') || typeof value.member !== 'string' || (value.order !== undefined && typeof value.order !== 'number'))
        return invalid();
    if (value.kind !== 'value' && value.kind !== 'object' && value.kind !== 'array')
        return invalid();
    return { kind: value.kind, parentKey: typeof value.parentKey === 'string' ? value.parentKey : null, member: value.member, ...(typeof value.order === 'number' ? { order: value.order } : {}), ...('data' in value ? { data: value.data } : {}) };
};
const parseResource = (row: unknown): StorageResource => {
    if (!isStorageRecord(row) || typeof row.resource_key !== 'string' || typeof row.category !== 'string' || (row.owner_number !== null && typeof row.owner_number !== 'number'))
        return invalid();
    return { resource_key: row.resource_key, category: row.category, owner_number: typeof row.owner_number === 'number' ? row.owner_number : null, value: parseValue(row.value) };
};
const parseStorageSnapshotFields = (body: unknown): StorageSnapshot => {
    if (!isStorageRecord(body) || !Array.isArray(body.resources) || !Array.isArray(body.wallets) || !Array.isArray(body.history) || !isStorageRecord(body.revisions) || typeof body.updated_at !== 'string')
        return invalid();
    const resources = body.resources.map(parseResource);
    const wallets: StorageWallet[] = body.wallets.map((row: unknown) => {
        if (!isStorageRecord(row) || typeof row.student_number !== 'number' || !Number.isInteger(row.student_number) || typeof row.balance !== 'number' || !Number.isInteger(row.balance))
            return invalid();
        return { student_number: row.student_number, balance: row.balance };
    });
    const history: StorageHistoryRecord[] = body.history.map((row: unknown) => {
        if (!isStorageRecord(row) || typeof row.resource_key !== 'string' || typeof row.student_number !== 'number' || typeof row.entry_id !== 'string' || typeof row.sort_order !== 'number')
            return invalid();
        return { resource_key: row.resource_key, student_number: row.student_number, entry_id: row.entry_id, sort_order: row.sort_order, value: parseValue(row.value) };
    });
    const revisions: Record<string, number> = {};
    for (const [key, value] of Object.entries(body.revisions)) {
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
            return invalid();
        revisions[key] = value;
    }
    return { kind: 'full', value: assembleStorageState({ resources, wallets, history }), updated_at: body.updated_at, revisions, resources, wallets, history };
};
export const parseStorageSnapshot = (body: unknown): StorageSnapshot => {
    if (isStorageRecord(body) && body.kind !== undefined && body.kind !== 'full') return invalid();
    return parseStorageSnapshotFields(body);
};
export const loadStorageSnapshot = async (configuration: StorageConfiguration): Promise<StorageSnapshot> => parseStorageSnapshot(await request(configuration, 'storage_load_snapshot', {}));
export interface StorageReceipt {
    readonly found: boolean;
    readonly scope?: StorageScope;
    readonly action?: string;
    readonly payloadHash?: string;
    readonly result?: unknown;
    readonly committedAt?: string;
}
export const getStorageReceipt = async (configuration: StorageConfiguration, actorKey: string, requestId: string, verification?: {
    readonly action: string;
    readonly payload: unknown;
}): Promise<StorageReceipt> => {
    const body = await request(configuration, 'storage_get_receipt', { p_actor_key: actorKey, p_request_id: requestId });
    if (!isStorageRecord(body) || typeof body.found !== 'boolean')
        return invalid();
    if (body.found && (typeof body.action !== 'string' || typeof body.payloadHash !== 'string' || typeof body.committedAt !== 'string'))
        return invalid();
    if (body.found && verification && body.payloadHash !== storagePayloadHash(verification.action, verification.payload))
        throw new StorageRepositoryError(409, 'STORAGE_REQUEST_REUSED');
    return { found: body.found, ...(body.scope !== undefined && body.scope !== null ? { scope: parseStorageScope(body.scope) } : {}), ...(typeof body.action === 'string' ? { action: body.action } : {}), ...(typeof body.payloadHash === 'string' ? { payloadHash: body.payloadHash } : {}), ...(typeof body.committedAt === 'string' ? { committedAt: body.committedAt } : {}), ...('result' in body ? { result: body.result } : {}) };
};
export const storagePayloadHash = (action: string, payload: unknown): string => createHash('sha256').update(canonicalStorageJson({ action, payload })).digest('hex');
const buildMutationPayload = (
    mutation: Omit<StorageMutation, 'snapshot'> & { readonly snapshot: Pick<StorageSnapshot, 'value' | 'updated_at' | 'revisions'> },
    before: ReturnType<typeof splitStorageState>, after: ReturnType<typeof splitStorageState>, baseResources: readonly StorageResource[], preserveOrder = false,
): Record<string, unknown> => {
    const oldResources = new Map(baseResources.map((entry) => [entry.resource_key, entry]));
    const newResources = new Map((preserveOrder ? after.resources : reconcileStorageResourceOrder(baseResources, after.resources)).map((entry) => [entry.resource_key, entry]));
    const changed: ({
        resource_key: string;
        category: string;
        owner_number: number | null;
        value: StorageResourceValue | null;
    })[] = [];
    const keys = new Set([...oldResources.keys(), ...newResources.keys()]);
    const expected: Record<string, number> = {};
    const expect = (key: string) => { expected[key] = mutation.snapshot.revisions[key] ?? 0; };
    for (const key of keys) {
        const old = oldResources.get(key), next = newResources.get(key);
        if (canonicalStorageJson(old ?? null) === canonicalStorageJson(next ?? null))
            continue;
        const identity = next ?? old;
        if (!identity)
            continue;
        changed.push({ ...identity, value: next?.value ?? null });
        expect(key);
        let parent = identity.value.parentKey;
        while (parent !== null) {
            expect(parent);
            parent = oldResources.get(parent)?.value.parentKey ?? null;
        }
    }
    for (const key of mutation.readKeys ?? [])
        expect(key);
    const oldWallets = new Map(before.wallets.map((wallet) => [wallet.student_number, wallet.balance]));
    const wallets = after.wallets.filter((wallet) => oldWallets.get(wallet.student_number) !== wallet.balance);
    if (before.wallets.some((wallet) => !after.wallets.some((next) => next.student_number === wallet.student_number)))
        throw new StorageRepositoryError(400, 'STORAGE_INVALID_MUTATION');
    wallets.forEach((wallet) => expect(`wallet:${wallet.student_number}`));
    const oldHistory = new Map(before.history.map((entry) => [entry.resource_key, entry]));
    const history = after.history.filter((entry) => !oldHistory.has(entry.resource_key));
    // Display normalizers may sort/prune legacy history. Existing ledger rows are never rewritten or deleted.
    for (const entry of history)
        expect(`wallet:${entry.student_number}`);
    return { p_expected: expected, p_resources: changed, p_wallets: wallets, p_ledger: history,
        p_actor_key: mutation.actorKey, p_request_id: mutation.requestId, p_payload_hash: storagePayloadHash(mutation.action, mutation.payload), p_action: mutation.action, p_result: mutation.result, p_archive: mutation.archive ?? null };
};
export const buildStorageMutation = (mutation: StorageMutation): Record<string, unknown> => {
    const before = splitStorageState(mutation.snapshot.value);
    return buildMutationPayload(mutation, before, splitStorageState(mutation.value), mutation.snapshot.resources ?? before.resources);
};
export const commitStorageMutation = async (configuration: StorageConfiguration, mutation: StorageMutation): Promise<{
    saved: boolean;
    value?: Record<string, unknown>;
    updatedAt?: string;
    result?: unknown;
}> => {
    const body = await request(configuration, 'storage_commit_mutation', buildStorageMutation(mutation));
    if (!isStorageRecord(body) || typeof body.saved !== 'boolean')
        return invalid();
    return { saved: body.saved, ...(typeof body.updatedAt === 'string' ? { updatedAt: body.updatedAt } : {}), ...('result' in body ? { result: body.result } : {}) };
};


export interface ScopedStorageSnapshot {
    readonly kind: 'scoped';
    readonly scope: StorageScope;
    readonly value: Record<string, unknown>;
    readonly updated_at: string;
    readonly revisions: Record<string, number>;
    readonly resources: readonly StorageResource[];
    readonly wallets: readonly StorageWallet[];
    readonly history: readonly StorageHistoryRecord[];
    readonly deletedKeys: readonly string[];
    readonly orderingBounds: StorageOrderingBounds;
}
export interface ScopedStorageMutation extends Omit<StorageMutation, 'snapshot'> {
    readonly snapshot: ScopedStorageSnapshot;
}
export const parseScopedStorageSnapshot = (body: unknown): ScopedStorageSnapshot => {
    if (!isStorageRecord(body) || body.kind !== 'scoped' || !Array.isArray(body.deletedKeys)
        || body.deletedKeys.some(key => typeof key !== 'string') || !isStorageRecord(body.orderingBounds)) return invalid();
    const scope = parseStorageScope(body.scope);
    const parsed = parseStorageSnapshotFields(body);
    const orderingBounds: Record<string, { minimum: number; maximum: number }> = {};
    for (const [key, value] of Object.entries(body.orderingBounds)) {
        if (!isStorageRecord(value) || typeof value.minimum !== 'number' || typeof value.maximum !== 'number'
            || !Number.isFinite(value.minimum) || !Number.isFinite(value.maximum) || value.minimum > value.maximum) return invalid();
        orderingBounds[key] = { minimum: value.minimum, maximum: value.maximum };
    }
    if (!parsed.resources || !parsed.wallets || !parsed.history) return invalid();
    const selectedKeys = [...scope.resources.map(resource => resource.path), ...storageScopeStructuralKeys(scope),
        ...parsed.resources.filter(resource => storageResourceMatchesScope(resource, scope.resources)).map(resource => resource.resource_key)];
    if (parsed.resources.some(resource => !storageResourceMatchesScope(resource, scope.resources) && !storageStructuralAncestor(resource, selectedKeys))
        || parsed.wallets.some(wallet => !scope.wallets.includes(wallet.student_number))
        || parsed.history.some(entry => !scope.history.includes(entry.student_number))) return invalid();
    return { ...parsed, kind: 'scoped', scope, resources: parsed.resources, wallets: parsed.wallets, history: parsed.history,
        deletedKeys: body.deletedKeys.filter((key): key is string => typeof key === 'string'), orderingBounds };
};
export const loadScopedStorageSnapshot = async (configuration: StorageConfiguration, scope: StorageScope): Promise<ScopedStorageSnapshot> =>
    parseScopedStorageSnapshot(await request(configuration, 'storage_load_scope', { p_scope: parseStorageScope(scope) }));

const applyScopedOrderingBounds = (snapshot: ScopedStorageSnapshot, resources: readonly StorageResource[]): readonly StorageResource[] => {
    const existing = new Set(snapshot.resources.map(resource => resource.resource_key));
    const groups = new Map<string, StorageResource[]>();
    for (const resource of resources) {
        if (resource.value.parentKey === null || resource.value.order === undefined) continue;
        const siblings = groups.get(resource.value.parentKey) ?? [];
        siblings.push(resource); groups.set(resource.value.parentKey, siblings);
    }
    const positions = new Map<string, number>();
    for (const [parent, siblings] of groups) {
        const bound = snapshot.orderingBounds[parent];
        if (!bound) continue;
        siblings.sort((left, right) => (left.value.order ?? 0) - (right.value.order ?? 0));
        const prior = siblings.filter(resource => existing.has(resource.resource_key));
        const firstExisting = prior[0]?.value.order;
        const lastExisting = prior.at(-1)?.value.order;
        const additions = siblings.filter(resource => !existing.has(resource.resource_key));
        const prepended = firstExisting === undefined ? [] : additions.filter(resource => (resource.value.order ?? 0) < firstExisting);
        const appended = lastExisting === undefined ? additions : additions.filter(resource => (resource.value.order ?? 0) > lastExisting);
        prepended.forEach((resource, index) => positions.set(resource.resource_key, bound.minimum - prepended.length + index));
        appended.forEach((resource, index) => positions.set(resource.resource_key, bound.maximum + index + 1));
    }
    return resources.map(resource => positions.has(resource.resource_key) ? { ...resource, value: { ...resource.value, order: positions.get(resource.resource_key) } } : resource);
};

export const buildScopedStorageMutation = (mutation: ScopedStorageMutation): Record<string, unknown> => {
    const scope = parseStorageScope(mutation.snapshot.scope);
    const before = splitStorageState(mutation.snapshot.value);
    const after = splitStorageState(mutation.value);
    const oldResources = new Map(mutation.snapshot.resources.map(resource => [resource.resource_key, resource]));
    const reconciled = reconcileStorageResourceOrder(mutation.snapshot.resources, after.resources);
    const bounded = applyScopedOrderingBounds(mutation.snapshot, reconciled);
    const afterResources = new Map(bounded.map(resource => [resource.resource_key, resource]));
    const writableBefore = mutation.snapshot.resources.filter(resource => storageResourceMatchesScope(resource, scope.writeResources));
    const writableAfter = bounded.filter(resource => storageResourceMatchesScope(resource, scope.writeResources));
    for (const resource of mutation.snapshot.resources) {
        if (storageResourceMatchesScope(resource, scope.writeResources)) continue;
        const next = afterResources.get(resource.resource_key);
        if (next && canonicalStorageJson(next) !== canonicalStorageJson(resource)) throw new StorageScopeError();
        // Missing structural parents may result from an intentional scoped subtree removal; they are never deleted.
        if (!next && (resource.value.kind === 'value' || storageResourceMatchesScope(resource, scope.resources))) throw new StorageScopeError();
    }
    for (const wallet of mutation.snapshot.wallets) {
        if (scope.writeWallets.includes(wallet.student_number)) continue;
        const next = after.wallets.find(candidate => candidate.student_number === wallet.student_number);
        if (!next || next.balance !== wallet.balance) throw new StorageScopeError();
    }
    // Keep only declared writes. Domain normalizers may synthesize defaults for unread students and features.
    const selectedKeys = [...writableAfter.map(resource => resource.resource_key), ...after.history.filter(entry => scope.writeWallets.includes(entry.student_number)).map(entry => entry.resource_key)];
    const writableAfterKeys = new Set(writableAfter.map(resource => resource.resource_key));
    const addedParents = bounded.filter(resource => (!oldResources.has(resource.resource_key) || mutation.snapshot.revisions[resource.resource_key] === 0)
        && !writableAfterKeys.has(resource.resource_key) && storageStructuralAncestor(resource, selectedKeys));
    const writableBeforeKeys = new Set(writableBefore.map(resource => resource.resource_key));
    const afterState = { resources: [...writableAfter, ...addedParents], wallets: after.wallets.filter(wallet => scope.writeWallets.includes(wallet.student_number)),
        history: after.history.filter(entry => scope.writeWallets.includes(entry.student_number)) };
    const beforeState = { resources: writableBefore, wallets: before.wallets.filter(wallet => scope.writeWallets.includes(wallet.student_number)),
        history: before.history.filter(entry => scope.writeWallets.includes(entry.student_number)) };
    // Original parents are unchanged read dependencies, not replacement candidates.
    const result = buildMutationPayload({ ...mutation, readKeys: [...(scope.revisionKeys ?? []), ...scope.history.map(student => `wallet:${student}`), ...(mutation.readKeys ?? [])] }, beforeState, afterState,
        mutation.snapshot.resources.filter(resource => writableBeforeKeys.has(resource.resource_key)), true);
    const changes = result.p_resources;
    if (!Array.isArray(changes)) return invalid();
    const expected = isStorageRecord(result.p_expected) ? result.p_expected : invalid();
    for (const change of changes) {
        if (!isStorageRecord(change)) continue;
        const row = isStorageRecord(change.value) ? change.value : typeof change.resource_key === 'string' ? oldResources.get(change.resource_key)?.value : undefined;
        let parent = row && typeof row.parentKey === 'string' ? row.parentKey : null;
        while (parent !== null) {
            expected[parent] = mutation.snapshot.revisions[parent] ?? 0;
            parent = oldResources.get(parent)?.value.parentKey ?? null;
        }
    }
    return { ...result, p_expected: expected, p_scope: scope };
};
export const commitScopedStorageMutation = async (configuration: StorageConfiguration, mutation: ScopedStorageMutation): ReturnType<typeof commitStorageMutation> => {
    const body = await request(configuration, 'storage_commit_scoped_mutation', buildScopedStorageMutation(mutation));
    if (!isStorageRecord(body) || typeof body.saved !== 'boolean') return invalid();
    return { saved: body.saved, ...(typeof body.updatedAt === 'string' ? { updatedAt: body.updatedAt } : {}), ...('result' in body ? { result: body.result } : {}) };
};
