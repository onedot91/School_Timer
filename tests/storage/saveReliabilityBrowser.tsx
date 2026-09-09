import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createStudentSaveDraftStore, type StudentSaveDraftScope } from '../../src/lib/studentSaveDraft';
import { createStudentDraftDatabase } from '../../src/lib/studentDraftDatabase';
import { canReloadWithDrafts, getUnsafeDraftRecoveryText } from '../../src/lib/draftReloadSafety';
import { executeStudentStorageCommand, loadStudentStorageDraft, loadStudentStorageFormDraft, readyStudentStorageDrafts, saveStudentStorageFormDraft } from '../../src/lib/studentStorageCommand';
import { runSaveRecoveryPass } from '../../src/lib/saveRecovery';
import { acceptStorageProjection, captureStorageResponseContext } from '../../src/lib/storageResponseOrder';
import { splitStorageState } from '../../src/lib/storageV2Codec';
import { useStudentSudokuState } from '../../src/lib/useStudentSudokuState';
import { createSudokuPuzzle, getSudokuProgressKey } from '../../src/lib/sudoku';
import { getKoreanIsoWeekKey } from '../../src/lib/weeklyMission';
import { useStudentNumberBaseballState } from '../../src/lib/useStudentNumberBaseballState';
import { createNumberBaseballProgressEntry } from '../../src/lib/numberBaseball';
import StudentNumberBaseballPage from '../../src/components/student/StudentNumberBaseballPage';
import { SaveReliabilityBrowserForms } from './saveReliabilityBrowserForms';
import StudentSudokuPage from '../../src/components/student/StudentSudokuPage';

const actor = 1;
const store = createStudentSaveDraftStore();
const database = createStudentDraftDatabase(indexedDB);
const scope: StudentSaveDraftScope = { studentNumber: actor, feature: 'browser-fixture.form', entityId: 'text' };
const commandAction = 'student.letter.send';
const commandEntity = 'browser-fixture-letter';
let failWrites = false;
const originalPut = IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
  if (failWrites) throw new DOMException('Injected storage quota failure', 'QuotaExceededError');
  return originalPut.apply(this, args);
};
const seed = () => {
  const value = { studentSudoku: {}, studentNumberBaseball: {} };
  const encoded = splitStorageState(value);
  acceptStorageProjection(captureStorageResponseContext(), {
    value, updatedAt: '2026-01-01T00:00:00.000Z', scope: 'student',
    storagePatch: { ...encoded, complete: true, historyStudents: [], deletedKeys: [],
      revisions: { ...Object.fromEntries(encoded.resources.map(row => [row.resource_key, 0])), 'scope:studentSudoku:1': 0 } },
  });
};
seed();

const driver = {
  ready: async () => { await store.ready(); await readyStudentStorageDrafts(); },
  load: () => store.load(scope),
  edit: async (text: string) => { const result = store.replace(scope, { text }); await store.flush(); return { result, loaded: store.load(scope) }; },
  confirm: (requestId: string) => store.confirmDurable(scope, requestId),
  quota: (enabled: boolean) => { failWrites = enabled; },
  reloadSafe: () => canReloadWithDrafts(actor),
  recoveryText: () => getUnsafeDraftRecoveryText(actor),
  database,
  pending: () => loadStudentStorageDraft(actor, commandAction, commandEntity),
  form: () => loadStudentStorageFormDraft(actor, commandAction, commandEntity),
  editForm: (text: string) => saveStudentStorageFormDraft(actor, commandAction, { text }, commandEntity),
  send: (text: string) => executeStudentStorageCommand(actor, commandAction, { text }, commandEntity),
  recover: () => runSaveRecoveryPass(actor),
  sudokuEditableIndex: () => createSudokuPuzzle(actor, getKoreanIsoWeekKey(), 'basic').puzzle.findIndex(cell => cell === 0),
};
declare global { interface Window { saveReliability: typeof driver } }
window.saveReliability = driver;

function Fixture() {
  const [status, setStatus] = useState('준비 중');
  const [text, setText] = useState('');
  const onSharedSettingsChange = useCallback((value: Record<string, unknown>) => { game.applySharedStudentSudoku(value); baseball.applySharedProgress(value); return true; }, []);
  const game = useStudentSudokuState({ studentNumber: actor, currencyHistory: {}, onSharedSettingsChange,
    onCurrencyBalancesChange: () => undefined, onCurrencyHistoryChange: () => undefined });
  const baseball = useStudentNumberBaseballState({ studentNumber: actor, currencyHistory: {}, onSharedSettingsChange,
    onCurrencyBalancesChange: () => undefined, onCurrencyHistoryChange: () => undefined });
  const week = getKoreanIsoWeekKey();
  const key = getSudokuProgressKey(actor, week, 'basic');
  const puzzle = createSudokuPuzzle(actor, week, 'basic');
  const editable = puzzle.puzzle.findIndex(cell => cell === 0);
  const value = game.studentSudokuProgress[key]?.cells[editable] ?? 0;
  useEffect(() => { void driver.ready().then(() => setStatus('준비됨')); }, []);
  const editGame = (digit: number) => {
    const cells = [...puzzle.puzzle];
    cells[editable] = digit;
    setStatus('저장 중');
    void game.saveSudokuProgress(key, { puzzleId: puzzle.id, cells, completedAt: null })
      .then(saved => setStatus(saved ? '저장됨' : '저장 확인 필요'));
  };
  if (new URLSearchParams(location.search).get('game') === 'sudoku') return <>
    <output className="sr-only" aria-label="저장 상태">{status}</output>
    <output className="sr-only" aria-label="스도쿠 입력">{value}</output>
    <StudentSudokuPage studentNumber={actor} difficulty="basic" progress={game.studentSudokuProgress} hasReward={false}
      onSave={game.saveSudokuProgress} onComplete={game.completeSudoku} onBack={() => undefined}
      conflict={game.sudokuConflict} onConflictRefresh={game.inspectSudokuConflict} onContinueFromLatest={game.continueSudokuFromLatest} />
  </>;
  const baseballPage = <StudentNumberBaseballPage studentNumber={actor} weekKey={baseball.weekKey}
    entry={baseball.progressEntry ?? createNumberBaseballProgressEntry(baseball.gameId)} hasReward={false}
    onSave={baseball.saveProgress} onComplete={baseball.completeGame} onBack={() => undefined}
    conflict={baseball.baseballConflict} onConflictRefresh={baseball.inspectBaseballConflict} onContinueFromLatest={baseball.continueBaseballFromLatest} />;
  if (new URLSearchParams(location.search).get('game') === 'baseball' && new URLSearchParams(location.search).has('layout')) return <>
    <output className="sr-only" aria-label="저장 상태">{status}</output>
    <output className="sr-only" aria-label="야구 시도 수">{baseball.progressEntry?.attempts.length ?? 0}</output>
    {baseballPage}
  </>;
  return <main>
    <h1>격리 저장 검증</h1>
    <label>편집 내용<input value={text} onChange={event => { setText(event.target.value); driver.editForm(event.target.value); }} /></label>
    <button onClick={() => { setStatus('저장 중'); void driver.send(text).then(() => setStatus('저장됨'), () => setStatus('저장 확인 필요')); }}>제출</button>
    <button onClick={() => editGame(1)}>스도쿠 1 입력</button>
    <button onClick={() => editGame(2)}>스도쿠 2 입력</button>
    <output aria-label="스도쿠 입력">{value}</output>
    <output aria-label="저장 상태">{status}</output>
    {new URLSearchParams(location.search).get('game') === 'baseball' && <>
      <output aria-label="야구 시도 수">{baseball.progressEntry?.attempts.length ?? 0}</output>
      {baseballPage}
    </>}
  </main>;
}
const root = document.getElementById('root');
if (!root) throw new Error('BROWSER_FIXTURE_ROOT_REQUIRED');
const form = new URLSearchParams(location.search).get('form');
const mount = () => createRoot(root).render(form ? <SaveReliabilityBrowserForms form={form} /> : <Fixture />);
if (new URLSearchParams(location.search).has('layout')) void import('../../src/index.css').then(mount);
else mount();
