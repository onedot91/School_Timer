import type { DeviceSession, RequestHeaders } from './deviceSession.js';
import { applyStudentStorageCommand } from './studentStorageCommands.js';
import { applyTeacherStorageCommand } from './teacherStorageCommands.js';
import {
  commitScopedStorageMutation, getStorageReceipt, loadScopedStorageSnapshot, StorageRepositoryError,
  type StorageConfiguration,
} from './storageV2Repository.js';
import { storageCommandScope } from './storageCommandScope.js';
import { createStorageProjectionPatch, supportsStorageProjection } from './storageProjection.js';
import { isStorageRecord } from '../lib/storageV2Codec.js';

interface CommandRequest {
  readonly headers?: RequestHeaders;
  readonly method?: string;
  readonly body?: unknown;
  readonly query?: Record<string, string | readonly string[] | undefined>;
}
interface CommandResponse {
  setHeader(name: string, value: string): void;
  status(code: number): CommandResponse;
  json(body: unknown): void;
}
type ProjectValue = (value: unknown, student: number) => Record<string, unknown>;

const actorKey = (session: DeviceSession): string => session.role === 'teacher' ? 'teacher:0' : `student:${session.studentNumber}`;
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{8,160}$/.test(id);
const businessError = (error: Error): { code: string; status: number } | null => {
  const code: unknown = Reflect.get(error, 'code');
  const status: unknown = Reflect.get(error, 'status');
  if (typeof code === 'string' && /^[A-Z][A-Z0-9_]{2,80}$/.test(code)
    && typeof status === 'number' && [400,403,404,409,422].includes(status)) return { code, status };
  return null;
};

export const handleStorageCommand = async (
  request: CommandRequest, response: CommandResponse, configuration: StorageConfiguration,
  session: DeviceSession, projectStudentValue: ProjectValue,
): Promise<void> => {
  if (!supportsStorageProjection(request.headers)) {
    response.status(426).json({ error: 'STORAGE_PROTOCOL_UPGRADE_REQUIRED' }); return;
  }
  try {
    const body: unknown = request.method === 'GET' ? undefined
      : typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const target: unknown = request.method === 'GET'
      ? request.query?.studentNumber === undefined ? undefined : Number(request.query.studentNumber)
      : isStorageRecord(body) ? body.studentNumber : undefined;
    if (target !== undefined && (typeof target !== 'number' || !Number.isInteger(target) || target < 1 || target > 23)) {
      response.status(400).json({ error: 'INVALID_STORAGE_COMMAND' }); return;
    }
    if (session.role === 'student' && target !== undefined && target !== session.studentNumber) {
      response.status(403).json({ error: 'STUDENT_SETTINGS_SCOPE_VIOLATION' }); return;
    }
    const teacherAuction = session.role === 'teacher' && typeof target === 'number';
    if (teacherAuction && request.method !== 'GET' && (!isStorageRecord(body) || body.action !== 'student.auction.bid')) {
      response.status(403).json({ error: 'TEACHER_COMMAND_REQUIRED' }); return;
    }
    const effectiveSession: DeviceSession = teacherAuction
      ? { role: 'student', studentNumber: target, expiresAt: session.expiresAt } : session;
    const commandActor = teacherAuction ? `teacher:0:student:${target}` : actorKey(session);
    const project = (value: unknown): Record<string, unknown> => effectiveSession.role === 'teacher'
      ? isStorageRecord(value) ? value : {} : projectStudentValue(value, effectiveSession.studentNumber);
    if (request.method === 'GET') {
      const requestId = request.query?.requestId;
      if (!validId(requestId)) { response.status(400).json({ error: 'INVALID_STORAGE_COMMAND' }); return; }
      const receipt = await getStorageReceipt(configuration, commandActor, requestId);
      if (!receipt.found) { response.status(200).json({ status: 'unknown' }); return; }
      const scope = receipt.scope ?? storageCommandScope(receipt.action ?? '', {}, effectiveSession, true);
      const snapshot = await loadScopedStorageSnapshot(configuration, scope);
      response.status(200).json({ storagePatch: createStorageProjectionPatch(snapshot, project(snapshot.value)), status: 'committed', value: project(snapshot.value), updatedAt: snapshot.updated_at, result: receipt.result,
        ...('action' in receipt ? { action: receipt.action } : {}), ...('payloadHash' in receipt ? { payloadHash: receipt.payloadHash } : {}) });
      return;
    }
    if (!isStorageRecord(body) || body.protocolVersion !== 2) { response.status(409).json({ error: 'STORAGE_PROTOCOL_REQUIRED' }); return; }
    if (!validId(body.requestId) || typeof body.action !== 'string' || !('payload' in body)
      || Buffer.byteLength(JSON.stringify(body), 'utf8') > 1_048_576) { response.status(400).json({ error: 'INVALID_STORAGE_COMMAND' }); return; }
    const action = body.action, requestId = body.requestId, payload = body.payload;
    if (effectiveSession.role === 'student' && !action.startsWith('student.')) { response.status(403).json({ error: 'STUDENT_SETTINGS_SCOPE_VIOLATION' }); return; }
    if (effectiveSession.role === 'teacher' && !action.startsWith('teacher.')) { response.status(403).json({ error: 'TEACHER_COMMAND_REQUIRED' }); return; }
    const scope = storageCommandScope(action, payload, effectiveSession);
    const createdAt = new Date().toISOString();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const receipt = await getStorageReceipt(configuration, commandActor, requestId, { action, payload });
      if (receipt.found) {
        const snapshot = await loadScopedStorageSnapshot(configuration, receipt.scope ?? scope);
        response.status(200).json({ storagePatch: createStorageProjectionPatch(snapshot, project(snapshot.value)), status: 'committed', value: project(snapshot.value), updatedAt: snapshot.updated_at, result: receipt.result });
        return;
      }
      const snapshot = await loadScopedStorageSnapshot(configuration, scope);
      const mutation = effectiveSession.role === 'teacher'
        ? applyTeacherStorageCommand(snapshot.value, action, payload, { requestId, createdAt })
        : applyStudentStorageCommand(snapshot.value, effectiveSession.studentNumber, action, payload, { requestId, createdAt });
      if (!mutation) { response.status(400).json({ error: 'INVALID_STORAGE_COMMAND' }); return; }
      const saved = await commitScopedStorageMutation(configuration, { snapshot, value: mutation.value,
        actorKey: commandActor,requestId,action,payload,result: mutation.result,
        readKeys: scope.revisionKeys,
      });
      if (saved.saved) {
        const current = await loadScopedStorageSnapshot(configuration, scope);
        response.status(200).json({ storagePatch: createStorageProjectionPatch(current, project(current.value)), status: 'committed',value: project(current.value),updatedAt: current.updated_at,result: saved.result ?? mutation.result });
        return;
      }
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 40 * 2 ** attempt + Math.random() * 80));
    }
    response.status(409).json({ error: 'RESOURCE_REVISION_CONFLICT' });
  } catch (error) {
    if (error instanceof SyntaxError) { response.status(400).json({ error: 'INVALID_BODY' }); return; }
    if (error instanceof StorageRepositoryError) {
      if (error.status === 503) response.setHeader('Retry-After','5');
      response.status(error.status).json({ error: error.code }); return;
    }
    const business = error instanceof Error ? businessError(error) : null;
    if (business) { response.status(business.status).json({ error: business.code, businessRejected: true }); return; }
    response.status(502).json({ error: 'STORAGE_COMMAND_FAILED' });
  }
};
