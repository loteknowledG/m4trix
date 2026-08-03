import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

import {
  createRelationalSchema,
  isRelationalKey,
  migrateRelationalFromKv,
  relationalDel,
  relationalGet,
  relationalMigrationDone,
  relationalSet,
} from './sqlite-relational';

const IDB_NAME = 'm4trix-sqlite-kv';
const STORE_NAME = 'database';
const DATABASE_KEY = 'm4trix.db';
const MIGRATION_KEY = '__sqlite_kv_migrated__';

let sqlModule: SqlJsStatic | null = null;
let database: Database | null = null;
let initPromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function isBrowser() {
  return typeof window !== 'undefined';
}

function serialize(value: unknown): string | null {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function deserialize<T>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

function openBlobStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readDatabaseBytes(): Promise<Uint8Array | null> {
  const idb = await openBlobStore();
  return new Promise((resolve, reject) => {
    const request = idb.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(DATABASE_KEY);
    request.onsuccess = () => resolve(request.result ? new Uint8Array(request.result) : null);
    request.onerror = () => reject(request.error);
  });
}

async function writeDatabaseBytes(bytes: Uint8Array): Promise<void> {
  const idb = await openBlobStore();
  return new Promise((resolve, reject) => {
    const transaction = idb.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(bytes, DATABASE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function wasmUrl(file: string) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return `${basePath}/wasm/${file}`;
}

async function loadSqlModule(): Promise<SqlJsStatic> {
  if (sqlModule) return sqlModule;
  sqlModule = await initSqlJs({
    locateFile: wasmUrl,
  });
  return sqlModule;
}

function createSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

type SqlValue = string | number | null | Uint8Array;

export type { SqlValue };

function queryObjects<T extends Record<string, SqlValue>>(db: Database, sql: string, bind: SqlValue[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(bind);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

function migrationDone(db: Database): boolean {
  const rows = queryObjects<{ value: string }>(db, 'SELECT value FROM kv WHERE key = ?', [MIGRATION_KEY]);
  return rows.length > 0;
}

async function migrateFromLegacyIdbKeyval(db: Database) {
  const legacy = await import('./legacy-idb-keyval');
  const legacyKeys = await legacy.keys();
  if (legacyKeys.length === 0) {
    db.run('INSERT OR REPLACE INTO kv(key, value) VALUES(?, ?)', [MIGRATION_KEY, '"done"']);
    return;
  }

  db.run('BEGIN');
  try {
    for (const rawKey of legacyKeys) {
      const key = String(rawKey);
      if (key === MIGRATION_KEY) continue;
      const value = await legacy.get(rawKey);
      if (value === undefined) continue;
      const encoded = serialize(value);
      if (!encoded) continue;
      db.run('INSERT OR REPLACE INTO kv(key, value) VALUES(?, ?)', [key, encoded]);
    }
    db.run('INSERT OR REPLACE INTO kv(key, value) VALUES(?, ?)', [MIGRATION_KEY, '"done"']);
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

async function initializeDatabase() {
  const SQL = await loadSqlModule();
  const bytes = await readDatabaseBytes();
  database = bytes ? new SQL.Database(bytes) : new SQL.Database();
  createSchema(database);
  createRelationalSchema(database);

  if (!migrationDone(database)) {
    await migrateFromLegacyIdbKeyval(database);
    await writeDatabaseBytes(database.export());
  }

  if (!relationalMigrationDone(database)) {
    await migrateRelationalFromKv(database, kvReadRaw, runQueuedWrite);
    await writeDatabaseBytes(database.export());
  }
}

function kvReadRaw(db: Database, key: string): unknown | undefined {
  const rows = queryObjects<{ value: string }>(db, 'SELECT value FROM kv WHERE key = ?', [key]);
  if (!rows[0]) return undefined;
  return deserialize(rows[0].value);
}

async function runQueuedWrite(fn: (db: Database) => void | Promise<void>) {
  if (!database) return;
  writeQueue = writeQueue.then(async () => {
    await fn(database!);
    await persistDatabase();
  });
  await writeQueue;
}

async function ensureReady() {
  if (!isBrowser()) {
    throw new Error('SQLite KV storage is only available in the browser.');
  }
  if (database) return;
  if (!initPromise) {
    initPromise = initializeDatabase().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  await initPromise;
}

async function persistDatabase() {
  if (!database) return;
  await writeDatabaseBytes(database.export());
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  await ensureReady();
  if (isRelationalKey(key)) {
    const value = await relationalGet(key, queryObjects, database!);
    return value as T | undefined;
  }
  const rows = queryObjects<{ value: string }>(database!, 'SELECT value FROM kv WHERE key = ?', [key]);

  if (!rows[0]) return undefined;
  return deserialize<T>(rows[0].value);
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await ensureReady();
  if (isRelationalKey(key)) {
    await relationalSet(key, value, queryObjects, runQueuedWrite);
    return;
  }
  writeQueue = writeQueue.then(async () => {
    const encoded = serialize(value);
    if (encoded === null) {
      database!.run('DELETE FROM kv WHERE key = ?', [key]);
    } else {
      database!.run('INSERT OR REPLACE INTO kv(key, value) VALUES(?, ?)', [key, encoded]);
    }
    await persistDatabase();
  });
  await writeQueue;
}

export async function kvDel(key: string): Promise<void> {
  await ensureReady();
  if (isRelationalKey(key)) {
    await relationalDel(key, runQueuedWrite);
    return;
  }
  writeQueue = writeQueue.then(async () => {
    database!.run('DELETE FROM kv WHERE key = ?', [key]);
    await persistDatabase();
  });
  await writeQueue;
}

export async function kvKeys(): Promise<string[]> {
  await ensureReady();
  const rows = queryObjects<{ key: string }>(
    database!,
    'SELECT key FROM kv WHERE key != ? ORDER BY key',
    [MIGRATION_KEY],
  );
  return rows.map((row) => row.key);
}

export async function kvClear(): Promise<void> {
  await ensureReady();
  writeQueue = writeQueue.then(async () => {
    database!.run('DELETE FROM kv WHERE key != ?', [MIGRATION_KEY]);
    await persistDatabase();
  });
  await writeQueue;
}

export async function kvReady(): Promise<void> {
  await ensureReady();
}
