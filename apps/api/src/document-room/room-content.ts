// The content half of a document's room (docs/specs/006-document/blueprints/document-storage.md "Room lifecycle",
// "The outbox"): its SQLite as `DOCUMENT_DB`, the env its handlers run with, the one document it answers for, and
// the outbox's drain on idle. DocumentRoom owns the sockets and the one alarm; it asks this for the drain's
// deadline and runs the drain when it is due.

import type { DocumentRoom } from './document-room';
import { DocumentDb } from './document-db';
import { drainOutbox } from './document-outbox';
import { documentRpc, type DocumentRoomRpc } from './document-rpc';
import { hasDocumentSchema, migrateDocumentSchema } from './document-schema';
import type { DocumentEnv, Env } from '../types';

// The drain's pace (blueprint "Constants and configuration").
export const FLUSH_IDLE_MS = 2_000;
export const FLUSH_MIN_GAP_MS = 60_000;
export const FLUSH_RETRY_MS = 60_000;

// When the next drain may run after a write at `now`: once the room is quiet, and at most once a minute.
export function nextFlushAt(now: number, lastFlushAt: number): number {
  return Math.max(now + FLUSH_IDLE_MS, lastFlushAt + FLUSH_MIN_GAP_MS);
}

export class RoomIdMismatchError extends Error {
  constructor(held: string, asked: string) {
    super(`room_id_mismatch held=${held} asked=${asked}`);
    this.name = 'RoomIdMismatchError';
  }
}

// A room that cannot serve its document yet (its legacy handover or its move failed); the worker answers it as
// 503 `room_unavailable`, and the next call tries again.
export class RoomNotReadyError extends Error {
  constructor(documentId: string, step: 'handover' | 'move') {
    super(`room_unavailable id=${documentId} step=${step}`);
    this.name = 'RoomNotReadyError';
  }
}

type RoomState = Pick<DurableObjectState, 'storage' | 'id' | 'waitUntil'>;

// What the room hands its content half: the one alarm, and the gate every RPC passes before it is answered (the
// legacy handover, then the move), after the room is bound to the RPC's document.
export type RoomContentHooks = {
  armAlarm: () => void;
  prepare: (documentId: string) => Promise<void>;
};

export class RoomContent {
  // The env the document's handlers run with here; undefined for a unit test's room built without bindings or
  // without SQLite storage.
  readonly env: DocumentEnv | undefined;
  private readonly state: RoomState;
  private readonly hooks: RoomContentHooks;
  private documentId: string | null = null;
  private schemaReady: boolean;
  // Whether this instance has run the schema steps (a wake after a release may find an older version).
  private migrated = false;
  private flushAt: number | null = null;
  private lastFlushAt = 0;
  private draining = false;

  constructor(state: RoomState, env: Env | undefined, room: DocumentRoom, hooks: RoomContentHooks) {
    this.state = state;
    this.hooks = hooks;
    const sql = state.storage.sql as SqlStorage | undefined;
    this.schemaReady = sql ? hasDocumentSchema((q) => sql.exec(q)) : false;
    if (!env || !sql) {
      this.env = undefined;
      return;
    }
    const db = new DocumentDb(sql, {
      transaction: (fn) => state.storage.transactionSync(fn),
      ensureSchema: () => this.ensureSchema(),
      hasSchema: () => this.schemaReady,
      onWrite: () => this.noteWrite(),
    });
    this.env = {
      ...env,
      DOCUMENT_DB: db.asD1(),
      DOCUMENT_ROOM: localNamespace(env.DOCUMENT_ROOM, state.id, room),
    };
    // After a wake: the document this room holds, and anything its outbox still owes D1.
    if (this.schemaReady) {
      const row = sql.exec('SELECT id FROM document LIMIT 1').toArray()[0];
      if (typeof row?.id === 'string') this.documentId = row.id;
      if (sql.exec('SELECT 1 FROM outbox LIMIT 1').toArray().length > 0) this.flushAt = Date.now();
    }
  }

  // Every RPC names its document; a room answers for one only. A room that stores nothing yet adopts the id it is
  // first asked about (a create, a copy's import, a move); one that stores a document refuses any other.
  bind(documentId: string): void {
    if (this.documentId === null) this.documentId = documentId;
    else if (this.documentId !== documentId) {
      const error = new RoomIdMismatchError(this.documentId, documentId);
      console.error(`[room-route] failed id=${documentId} path=rpc error=${error.name}`);
      throw error;
    }
  }

  // The RPC surface, bound to `documentId`, once the room is ready to serve it: the only way in for an RPC, so none
  // skips the gate.
  async rpc(documentId: string): Promise<DocumentRoomRpc> {
    this.bind(documentId);
    await this.hooks.prepare(documentId);
    if (!this.env) throw new Error('room has no content store');
    return documentRpc(this.env, (p) => this.state.waitUntil(p));
  }

  // The drain's deadline, for the room's one alarm; null with nothing owed.
  deadline(): number | null {
    return this.flushAt;
  }

  // From the room's alarm: drain when due. A failed unit retries a minute later; keys left by a drain bounded at
  // DRAIN_TABS go straight after.
  async alarm(now: number): Promise<void> {
    if (this.flushAt === null || this.flushAt > now) return;
    this.flushAt = null;
    const env = this.env;
    const documentId = this.documentId;
    if (!env || !documentId || !this.schemaReady) return;
    this.draining = true;
    try {
      const result = await drainOutbox(env, documentId);
      this.lastFlushAt = Date.now();
      if (result.failed > 0) this.flushAt = Date.now() + FLUSH_RETRY_MS;
      else if (result.more) this.flushAt = Date.now();
    } catch (error) {
      console.warn(`[outbox] unit failed id=${documentId} unit=read`, error);
      this.flushAt = Date.now() + FLUSH_RETRY_MS;
    } finally {
      this.draining = false;
    }
    // A key written while the drain ran goes next time.
    if (this.flushAt === null && this.owesD1()) {
      this.flushAt = nextFlushAt(Date.now(), this.lastFlushAt);
    }
  }

  private owesD1(): boolean {
    const sql = this.state.storage.sql;
    return sql.exec('SELECT 1 FROM outbox LIMIT 1').toArray().length > 0;
  }

  // The schema on the first write (R1), never on construction or a read; once per instance, so a wake after a
  // release takes any new step before its first write.
  private ensureSchema(): void {
    if (this.migrated) return;
    const sql = this.state.storage.sql;
    const { from, to } = migrateDocumentSchema((q) => sql.exec(q));
    this.migrated = true;
    this.schemaReady = true;
    if (from !== to)
      console.info(
        `[room-schema] migrated id=${this.documentId ?? 'unbound'} from=${from} to=${to}`,
      );
  }

  // A write happened: arm the drain on idle, at most once a minute. The drain's own writes schedule nothing.
  private noteWrite(): void {
    if (this.draining || this.flushAt !== null || !this.schemaReady || !this.owesD1()) return;
    this.flushAt = nextFlushAt(Date.now(), this.lastFlushAt);
    this.hooks.armAlarm();
  }
}

// The env's DOCUMENT_ROOM, answering this room's own id with the room itself: code the worker and the room share
// (a document read's outline, the room's relays) calls straight in rather than through a stub.
function localNamespace(
  real: Env['DOCUMENT_ROOM'] | undefined,
  own: DurableObjectId,
  room: DocumentRoom,
): Env['DOCUMENT_ROOM'] {
  // A unit test builds a room without bindings; its own id is still answered.
  return new Proxy(real ?? ({} as Env['DOCUMENT_ROOM']), {
    get: (target, prop, receiver) => {
      if (prop === 'get') {
        return (id: DurableObjectId, opts?: DurableObjectNamespaceGetDurableObjectOptions) =>
          id.equals(own) ? room : target.get(id, opts);
      }
      const value: unknown = Reflect.get(target, prop, receiver);
      return typeof value === 'function'
        ? (value as (...a: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}
