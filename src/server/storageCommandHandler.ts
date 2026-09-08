import type { DeviceSession } from './deviceSession.js';
import { applyStudentStorageCommand } from './studentStorageCommands.js';
import { applyTeacherStorageCommand } from './teacherStorageCommands.js';
import {
  commitStorageMutation, getStorageReceipt, loadStorageSnapshot, StorageRepositoryError,
  type StorageConfiguration,
} from './storageV2Repository.js';
import { isStorageRecord, storageResourceKey } from '../lib/storageV2Codec.js';

interface CommandRequest {
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

export const storageCommandReadKeys = (action: string, payload: unknown, session: DeviceSession): string[] => {
  const input = isStorageRecord(payload) ? payload : {};
  const own = session.role === 'student' ? session.studentNumber : null;
  const scope = (field: string, student: number | null = own) => `scope:${field}:${student ?? 'all'}`;
  if (action === 'student.letter.send') return [];
  if (action === 'student.letter.read' && typeof input.letterId === 'string') return [storageResourceKey('studentLife','letters',`@${input.letterId}`)];
  if (action === 'student.failure.stamp' && typeof input.storyId === 'string') return [storageResourceKey('studentLife','failureStories',`@${input.storyId}`)];
  if (action === 'student.failure.create') return [`wallet:${own}`,scope('currencyHistory'),scope('studentLife')];
  if (action.startsWith('student.pet.')) return [scope('studentPets'), ...(action.endsWith('.feed') ? [`wallet:${own}`,'scope:auctionBids:all','scope:auctionAwards:all','scope:auctionItems:all'] : [])];
  if (action === 'student.emotion.save') return [scope('studentEmotionHistory'),`wallet:${own}`,scope('currencyHistory')];
  if (action.startsWith('student.sudoku.')) return [scope('studentSudoku'),`wallet:${own}`,scope('currencyHistory')];
  if (action.startsWith('student.baseball.')) return [scope('studentNumberBaseball'),`wallet:${own}`,scope('currencyHistory')];
  if (action === 'student.auction.bid') return [`wallet:${own}`,'scope:auctionBids:all','scope:auctionItems:all','scope:auctionAwards:all'];
  if (action === 'teacher.settings.patch' && Array.isArray(input.changes)) return input.changes.flatMap(change => isStorageRecord(change) && typeof change.field === 'string'
    ? [storageResourceKey(...change.field.split('.'))] : []);
  if (action === 'teacher.mail.send') return [];
  if (action === 'teacher.mail.read' && Array.isArray(input.letterIds)) return input.letterIds.flatMap(id => typeof id === 'string' ? [storageResourceKey('studentLife','letters',`@${id}`)] : []);
  const keys = ['scope:auctionBids:all','scope:auctionItems:all','scope:auctionAwards:all'];
  if (action.startsWith('teacher.currency.') || action.startsWith('teacher.auction.')) keys.push('scope:studentEconomy:all','scope:studentStockMarket:all','scope:teacherWeeklySettlements:all');
  if (action.startsWith('teacher.role.')) keys.push('scope:classroomRoleMission:all');
  if (action.startsWith('teacher.writing.')) keys.push('scope:dailyWriting:all');
  if (action.startsWith('teacher.donation.')) keys.push('scope:classDonation:all');
  return keys;
};

export const handleStorageCommand = async (
  request: CommandRequest, response: CommandResponse, configuration: StorageConfiguration,
  session: DeviceSession, projectStudentValue: ProjectValue,
): Promise<void> => {
  const project = (value: unknown): Record<string, unknown> => session.role === 'teacher'
    ? isStorageRecord(value) ? value : {} : projectStudentValue(value, session.studentNumber);
  try {
    if (request.method === 'GET') {
      const requestId = request.query?.requestId;
      if (!validId(requestId)) { response.status(400).json({ error: 'INVALID_STORAGE_COMMAND' }); return; }
      const receipt = await getStorageReceipt(configuration, actorKey(session), requestId);
      if (!receipt.found) { response.status(200).json({ status: 'unknown' }); return; }
      const snapshot = await loadStorageSnapshot(configuration);
      response.status(200).json({ status: 'committed', value: project(snapshot.value), updatedAt: snapshot.updated_at, result: receipt.result,
        ...('action' in receipt ? { action: receipt.action } : {}), ...('payloadHash' in receipt ? { payloadHash: receipt.payloadHash } : {}) });
      return;
    }
    const body: unknown = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (!isStorageRecord(body) || body.protocolVersion !== 2) { response.status(409).json({ error: 'STORAGE_PROTOCOL_REQUIRED' }); return; }
    if (!validId(body.requestId) || typeof body.action !== 'string' || !('payload' in body)
      || Buffer.byteLength(JSON.stringify(body), 'utf8') > 1_048_576) { response.status(400).json({ error: 'INVALID_STORAGE_COMMAND' }); return; }
    const action = body.action, requestId = body.requestId, payload = body.payload;
    if (session.role === 'student' && !action.startsWith('student.')) { response.status(403).json({ error: 'STUDENT_SETTINGS_SCOPE_VIOLATION' }); return; }
    if (session.role === 'teacher' && !action.startsWith('teacher.')) { response.status(403).json({ error: 'TEACHER_COMMAND_REQUIRED' }); return; }
    const createdAt = new Date().toISOString();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const snapshot = await loadStorageSnapshot(configuration);
      const receipt = await getStorageReceipt(configuration, actorKey(session), requestId, { action, payload });
      if (receipt.found) {
        response.status(200).json({ status: 'committed', value: project(snapshot.value), updatedAt: snapshot.updated_at, result: receipt.result });
        return;
      }
      const mutation = session.role === 'teacher'
        ? applyTeacherStorageCommand(snapshot.value, action, payload, { requestId, createdAt })
        : applyStudentStorageCommand(snapshot.value, session.studentNumber, action, payload, { requestId, createdAt });
      if (!mutation) { response.status(400).json({ error: 'INVALID_STORAGE_COMMAND' }); return; }
      const saved = await commitStorageMutation(configuration, { snapshot, value: mutation.value,
        actorKey: actorKey(session),requestId,action,payload,result: mutation.result,
        readKeys: storageCommandReadKeys(action,payload,session),
      });
      if (saved.saved) {
        const current = await loadStorageSnapshot(configuration);
        response.status(200).json({ status: 'committed',value: project(current.value),updatedAt: current.updated_at,result: saved.result ?? mutation.result });
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
