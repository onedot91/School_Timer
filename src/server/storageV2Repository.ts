import { createHash } from 'node:crypto';
import { assembleStorageState, canonicalStorageJson, isStorageRecord, reconcileStorageResourceOrder, splitStorageState, type StorageHistoryRecord, type StorageResource, type StorageResourceValue, type StorageWallet, } from '../lib/storageV2Codec.js';
export interface StorageConfiguration {
    readonly url: string;
    readonly key: string;
}
export interface StorageSnapshot {
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
        const allowed = ['STORAGE_MAINTENANCE', 'STORAGE_NOT_ACTIVE', 'STORAGE_REQUEST_REUSED', 'STORAGE_BALANCE_MISMATCH', 'STORAGE_LEDGER_IMMUTABLE', 'STORAGE_INVALID_MUTATION'];
        const code = allowed.find((candidate) => message === candidate);
        throw new StorageRepositoryError(code === 'STORAGE_MAINTENANCE' || code === 'STORAGE_NOT_ACTIVE' ? 503 : code === 'STORAGE_REQUEST_REUSED' ? 409 : 502, code ?? `STORAGE_DATABASE_HTTP_${response.status}`);
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
export const parseStorageSnapshot = (body: unknown): StorageSnapshot => {
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
    return { value: assembleStorageState({ resources, wallets, history }), updated_at: body.updated_at, revisions, resources };
};
export const loadStorageSnapshot = async (configuration: StorageConfiguration): Promise<StorageSnapshot> => parseStorageSnapshot(await request(configuration, 'storage_load_snapshot', {}));
export interface StorageReceipt {
    readonly found: boolean;
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
    return { found: body.found, ...(typeof body.action === 'string' ? { action: body.action } : {}), ...(typeof body.payloadHash === 'string' ? { payloadHash: body.payloadHash } : {}), ...(typeof body.committedAt === 'string' ? { committedAt: body.committedAt } : {}), ...('result' in body ? { result: body.result } : {}) };
};
export const storagePayloadHash = (action: string, payload: unknown): string => createHash('sha256').update(canonicalStorageJson({ action, payload })).digest('hex');
export const buildStorageMutation = (mutation: StorageMutation): Record<string, unknown> => {
    const before = splitStorageState(mutation.snapshot.value);
    const after = splitStorageState(mutation.value);
    const baseResources = mutation.snapshot.resources ?? before.resources;
    const oldResources = new Map(baseResources.map((entry) => [entry.resource_key, entry]));
    const newResources = new Map(reconcileStorageResourceOrder(baseResources, after.resources).map((entry) => [entry.resource_key, entry]));
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
