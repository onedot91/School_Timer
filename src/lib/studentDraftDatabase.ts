export interface StudentDraftDatabaseEntry {
  readonly key: string;
  readonly requestId: string;
  readonly value: string;
}

export interface StudentDraftDatabase {
  readAll(): Promise<readonly StudentDraftDatabaseEntry[]>;
  get(key: string): Promise<StudentDraftDatabaseEntry | null>;
  getLegacy(key: string, requestId: string): Promise<StudentDraftDatabaseEntry | null>;
  migrateLegacy(entry: StudentDraftDatabaseEntry): Promise<StudentDraftDatabaseEntry | null>;
  insert(entry: StudentDraftDatabaseEntry): Promise<StudentDraftDatabaseEntry>;
  replace(entry: StudentDraftDatabaseEntry, expectedRequestId: string | null): Promise<boolean>;
  remove(key: string, requestId: string): Promise<boolean>;
}

const DATABASE_NAME = 'school-timer-student-drafts';
const STORE_NAME = 'drafts';
const LEGACY_STORE_NAME = 'legacy';
const parseEntry = (value: unknown): StudentDraftDatabaseEntry | null => {
  if (!value || typeof value !== 'object'
    || !('key' in value) || typeof value.key !== 'string'
    || !('requestId' in value) || typeof value.requestId !== 'string'
    || !('value' in value) || typeof value.value !== 'string') return null;
  return { key: value.key, requestId: value.requestId, value: value.value };
};

/** All compare-and-set decisions are made inside one IndexedDB read/write transaction. */
export const createStudentDraftDatabase = (
  factory: IDBFactory,
  name = DATABASE_NAME,
): StudentDraftDatabase => {
  let connection: Promise<IDBDatabase> | null = null;
  const open = (): Promise<IDBDatabase> => {
    if (connection) return connection;
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(name, 2);
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      };
      const timer = setTimeout(() => fail(new Error('DRAFT_DATABASE_TIMEOUT')), 5000);
      request.onupgradeneeded = () => {
        try {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
          if (!request.result.objectStoreNames.contains(LEGACY_STORE_NAME)) request.result.createObjectStore(LEGACY_STORE_NAME);
        } catch (error) {
          fail(error);
          try { request.transaction?.abort(); } catch { /* The open request is already rejected. */ }
        }
      };
      request.onblocked = () => fail(new Error('DRAFT_DATABASE_BLOCKED'));
      request.onerror = () => fail(request.error ?? new Error('DRAFT_DATABASE_UNAVAILABLE'));
      request.onsuccess = () => {
        if (settled) { request.result.close(); return; }
        settled = true;
        clearTimeout(timer);
        const database = request.result;
        database.onversionchange = () => { database.close(); connection = null; };
        resolve(database);
      };
    });
    void connection.catch(() => { connection = null; });
    return connection;
  };

  const transact = async <T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore, result: (value: T) => void, transaction: IDBTransaction, guard: (callback: () => void) => () => void) => void,
    stores: string[] = [STORE_NAME],
  ): Promise<T> => {
    const database = await open();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(stores, mode);
      let result: { value: T } | null = null;
      transaction.oncomplete = () => {
        if (result) resolve(result.value);
        else reject(new Error('DRAFT_DATABASE_INVALID_RESULT'));
      };
      transaction.onerror = () => reject(transaction.error ?? new Error('DRAFT_DATABASE_WRITE_FAILED'));
      transaction.onabort = () => reject(transaction.error ?? new Error('DRAFT_DATABASE_ABORTED'));
      const guard = (callback: () => void) => () => {
        try { callback(); } catch (error) {
          reject(error);
          try { transaction.abort(); } catch { /* The rejected operation may already have ended the transaction. */ }
        }
      };
      guard(() => operation(transaction.objectStore(stores[0]), value => { result = { value }; }, transaction, guard))();
    });
  };

  return {
    readAll: () => transact('readonly', (store, result, _transaction, guard) => {
      const request = store.getAll();
      request.onsuccess = guard(() => {
        const values: unknown = request.result;
        result(Array.isArray(values) ? values.map(parseEntry).filter((entry) => entry !== null) : []);
      });
    }),
    get: key => transact('readonly', (store, result, _transaction, guard) => {
      const request = store.get(key);
      request.onsuccess = guard(() => result(parseEntry(request.result)));
    }),
    getLegacy: (key, requestId) => transact('readonly', (store, result, _transaction, guard) => {
      const request = store.get([key, requestId]);
      request.onsuccess = guard(() => result(parseEntry(request.result)));
    }, [LEGACY_STORE_NAME]),
    migrateLegacy: entry => transact('readwrite', (store, result, transaction, guard) => {
      const archive = transaction.objectStore(LEGACY_STORE_NAME);
      const legacy = archive.get([entry.key, entry.requestId]);
      legacy.onsuccess = guard(() => {
        const alreadyMigrated = parseEntry(legacy.result) !== null;
        if (!alreadyMigrated) archive.put(entry, [entry.key, entry.requestId]);
        const current = store.get(entry.key);
        current.onsuccess = guard(() => {
          const existing = parseEntry(current.result);
          if (!existing && !alreadyMigrated) store.put(entry);
          result(existing ?? (alreadyMigrated ? null : entry));
        });
      });
    }, [STORE_NAME, LEGACY_STORE_NAME]),
    insert: entry => transact('readwrite', (store, result, _transaction, guard) => {
      const request = store.get(entry.key);
      request.onsuccess = guard(() => {
        const current = parseEntry(request.result);
        if (!current) store.put(entry);
        result(current ?? entry);
      });
    }),
    replace: (entry, expectedRequestId) => transact('readwrite', (store, result, _transaction, guard) => {
      const request = store.get(entry.key);
      request.onsuccess = guard(() => {
        const current = parseEntry(request.result);
        const matches = current === null || current.requestId === expectedRequestId;
        if (matches) store.put(entry);
        result(matches);
      });
    }),
    remove: (key, requestId) => transact('readwrite', (store, result, _transaction, guard) => {
      const request = store.get(key);
      request.onsuccess = guard(() => {
        const current = parseEntry(request.result);
        const matches = current?.requestId === requestId;
        if (matches) store.delete(key);
        result(matches);
      });
    }),
  };
};
