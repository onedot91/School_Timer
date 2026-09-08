/** Lossless storage projection. Containers carry no child list, so adding a record never rewrites its siblings. */
export interface StorageResource {
    readonly resource_key: string;
    readonly category: string;
    readonly owner_number: number | null;
    readonly value: StorageResourceValue;
}
export interface StorageResourceValue {
    readonly kind: 'object' | 'array' | 'value';
    readonly parentKey: string | null;
    readonly member: string;
    readonly order?: number;
    readonly data?: unknown;
}
export interface StorageWallet {
    readonly student_number: number;
    readonly balance: number;
}
export interface StorageHistoryRecord {
    readonly resource_key: string;
    readonly student_number: number;
    readonly entry_id: string;
    readonly sort_order: number;
    readonly value: StorageResourceValue;
}
export interface StorageEncodedState {
    readonly resources: readonly StorageResource[];
    readonly wallets: readonly StorageWallet[];
    readonly history: readonly StorageHistoryRecord[];
}
export const isStorageRecord = (value: unknown): value is Record<string, unknown> => (value !== null && typeof value === 'object' && !Array.isArray(value));
export const storagePathPart = (value: string): string => value.replaceAll('~', '~0').replaceAll('/', '~1');
export const storageResourceKey = (...parts: readonly string[]): string => `/${parts.map(storagePathPart).join('/')}`;
export const storageScopeKey = (category: string, owner: number | null): string => `scope:${category}:${owner ?? 'shared'}`;
export const canonicalStorageJson = (value: unknown): string => {
    if (Array.isArray(value))
        return `[${value.map(canonicalStorageJson).join(',')}]`;
    if (isStorageRecord(value))
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStorageJson(value[key])}`).join(',')}}`;
    const encoded = JSON.stringify(value);
    if (encoded === undefined)
        throw new Error('STORAGE_INVALID_JSON');
    return encoded;
};
const studentNumber = (value: string): number | null => /^([1-9]|1[0-9]|2[0-3])$/.test(value) ? Number(value) : null;
const recordMaps = new Set(['auctionBids', 'auctionAwards']);
const studentMaps = new Set(['studentEconomy', 'studentPets', 'studentSudoku', 'studentNumberBaseball', 'studentEmotionHistory', 'currencyHistory']);
export const splitStorageState = (input: Record<string, unknown>): StorageEncodedState => {
    const resources: StorageResource[] = [];
    const wallets: StorageWallet[] = [];
    const history: StorageHistoryRecord[] = [];
    const visit = (data: unknown, parts: string[], parentKey: string | null, member: string, owner: number | null, order?: number): void => {
        const key = parts.length === 0 ? '' : storageResourceKey(...parts);
        const category = parts[0] ?? 'root';
        if (parts.length === 2 && category === 'currencyBalances' && studentNumber(member) !== null) {
            if (typeof data !== 'number' || !Number.isSafeInteger(data) || data < 0 || data > 999999)
                throw new Error('STORAGE_INVALID_BALANCE');
            wallets.push({ student_number: Number(member), balance: data });
            return;
        }
        const record = (value: StorageResourceValue) => resources.push({ resource_key: key, category, owner_number: owner, value });
        if (Array.isArray(data)) {
            record({ kind: 'array', parentKey, member, ...(order === undefined ? {} : { order }) });
            const counts = new Map<string, number>();
            const reservedIdentities = new Set(data.map((item) => isStorageRecord(item) && typeof item.id === 'string' ? `@${item.id}` : `#${canonicalStorageJson(item)}`));
            data.forEach((item, index) => {
                const identity = isStorageRecord(item) && typeof item.id === 'string' ? `@${item.id}` : `#${canonicalStorageJson(item)}`;
                let occurrence = counts.get(identity) ?? 0;
                while (occurrence > 0 && reservedIdentities.has(`${identity}~duplicate:${occurrence}`))
                    occurrence++;
                counts.set(identity, occurrence + 1);
                const child = occurrence === 0 ? identity : `${identity}~duplicate:${occurrence}`;
                const value: StorageResourceValue = { kind: 'value', parentKey: key, member: child, order: index, data: item };
                const resourceKey = storageResourceKey(...parts, child);
                if (category === 'currencyHistory' && parts.length === 2 && owner !== null) {
                    if (!isStorageRecord(item) || typeof item.id !== 'string')
                        throw new Error('STORAGE_INVALID_HISTORY');
                    history.push({ resource_key: resourceKey, student_number: owner, entry_id: item.id, sort_order: index, value });
                }
                else {
                    const itemOwner = isStorageRecord(item) && typeof item.studentNumber === 'number' && studentNumber(String(item.studentNumber)) !== null ? item.studentNumber : owner;
                    if (category === 'studentLife' && parts[1] === 'failureStories' && parts.length === 2 && isStorageRecord(item)) {
                        visit(item, [...parts, child], key, child, itemOwner, index);
                    }
                    else {
                        resources.push({ resource_key: resourceKey, category, owner_number: itemOwner, value });
                    }
                }
            });
        }
        else if (isStorageRecord(data) && !(parts.length === 2 && (recordMaps.has(category) || (studentMaps.has(category) && category !== 'currencyHistory' && category !== 'studentEmotionHistory')))) {
            record({ kind: 'object', parentKey, member, ...(order === undefined ? {} : { order }) });
            Object.entries(data).forEach(([child, childData]) => visit(childData, [...parts, child], key, child, studentMaps.has(category) && parts.length === 1 ? studentNumber(child.split(':')[0]) : owner));
        }
        else {
            record({ kind: 'value', parentKey, member, ...(order === undefined ? {} : { order }), data });
        }
    };
    visit(input, [], null, '', null);
    return { resources, wallets, history };
};
export const assembleStorageState = (state: StorageEncodedState): Record<string, unknown> => {
    const resources = [...state.resources];
    state.wallets.forEach((wallet) => resources.push({ resource_key: storageResourceKey('currencyBalances', String(wallet.student_number)), category: 'currencyBalances', owner_number: wallet.student_number,
        value: { kind: 'value', parentKey: '/currencyBalances', member: String(wallet.student_number), data: wallet.balance } }));
    state.history.forEach((entry) => resources.push({ resource_key: entry.resource_key, category: 'currencyHistory', owner_number: entry.student_number, value: { ...entry.value, order: entry.sort_order } }));
    const children = new Map<string, StorageResource[]>();
    for (const resource of resources) {
        if (resource.value.parentKey === null)
            continue;
        const siblings = children.get(resource.value.parentKey) ?? [];
        siblings.push(resource);
        children.set(resource.value.parentKey, siblings);
    }
    const build = (resource: StorageResource): unknown => {
        if (resource.value.kind === 'value')
            return resource.value.data;
        const entries = children.get(resource.resource_key) ?? [];
        if (resource.value.kind === 'array')
            return entries.sort((a, b) => (a.value.order ?? 0) - (b.value.order ?? 0) || a.resource_key.localeCompare(b.resource_key)).map(build);
        return Object.fromEntries(entries.map((entry) => [entry.value.member, build(entry)]));
    };
    const root = resources.find((resource) => resource.resource_key === '');
    if (!root)
        throw new Error('STORAGE_MISSING_ROOT');
    const value = build(root);
    if (!isStorageRecord(value))
        throw new Error('STORAGE_INVALID_ROOT');
    return value;
};
/** Give inserts fractional positions while retaining existing positions for unchanged sibling order. */
export const reconcileStorageResourceOrder = (before: readonly StorageResource[], next: readonly StorageResource[]): readonly StorageResource[] => {
    const previous = new Map(before.map((resource) => [resource.resource_key, resource]));
    const groups = new Map<string, StorageResource[]>();
    for (const resource of next) {
        if (resource.value.order === undefined || resource.value.parentKey === null)
            continue;
        const siblings = groups.get(resource.value.parentKey) ?? [];
        siblings.push(resource);
        groups.set(resource.value.parentKey, siblings);
    }
    const positions = new Map<string, number>();
    for (const siblings of groups.values()) {
        siblings.sort((a, b) => (a.value.order ?? 0) - (b.value.order ?? 0));
        const existing = siblings.filter((resource) => previous.has(resource.resource_key));
        const oldOrder = [...existing].sort((a, b) => (previous.get(a.resource_key)?.value.order ?? 0) - (previous.get(b.resource_key)?.value.order ?? 0));
        if (existing.some((resource, index) => resource.resource_key !== oldOrder[index]?.resource_key))
            continue;
        let index = 0;
        let lower: number | undefined;
        while (index < siblings.length) {
            const current = siblings[index];
            const prior = previous.get(current.resource_key)?.value.order;
            if (prior !== undefined) {
                positions.set(current.resource_key, prior);
                lower = prior;
                index++;
                continue;
            }
            let end = index;
            while (end < siblings.length && previous.get(siblings[end].resource_key)?.value.order === undefined)
                end++;
            const upper = end < siblings.length ? previous.get(siblings[end].resource_key)?.value.order : undefined;
            const start = lower ?? (upper ?? 0) - (end - index) - 1;
            const step = upper === undefined ? 1 : (upper - start) / (end - index + 1);
            for (let offset = index; offset < end; offset++)
                positions.set(siblings[offset].resource_key, start + step * (offset - index + 1));
            lower = positions.get(siblings[end - 1].resource_key);
            index = end;
        }
    }
    return next.map((resource) => positions.has(resource.resource_key) ? { ...resource, value: { ...resource.value, order: positions.get(resource.resource_key) } } : resource);
};
export const getStorageReadKeys = (_snapshot: unknown, fields: readonly string[], student?: number): readonly string[] => fields.map((field) => field === 'currencyBalances' && student !== undefined ? `wallet:${student}` : `scope:${field}:all`);
