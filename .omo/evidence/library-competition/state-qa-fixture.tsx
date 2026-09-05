import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LibraryCompetitionPanel } from '../../../src/components/student/library/LibraryCompetitionPanel';
import { TeacherLibraryCompetitionPanel } from '../../../src/components/teacher/TeacherLibraryCompetitionPanel';
import { libraryCompetitionClient, LibraryCompetitionClientError } from '../../../src/lib/libraryCompetitionClient';
import type { LibraryCompetitionResponse } from '../../../src/lib/libraryCompetitionClient';
import { LIBRARY_COMPETITION_SCHOOLS, createLibraryCompetition } from '../../../src/lib/libraryCompetition';
import '../../../src/index.css';

const params = new URLSearchParams(window.location.search);
const surface = params.get('surface') === 'teacher' ? 'teacher' : 'student';
const state = params.get('state') ?? 'inactive';
const now = '2026-09-07T00:00:00.000Z';
const readCalls: string[] = [];
const writeCalls: string[] = [];
(window as unknown as { __stateQa?: { readCalls: string[]; writeCalls: string[] } }).__stateQa = { readCalls, writeCalls };

const standings = LIBRARY_COMPETITION_SCHOOLS.map((school, index) => ({
  schoolId: school.id,
  schoolName: school.name,
  region: school.region,
  count: school.id === 'school-17' ? 0 : Math.max(0, 52 - index * 3),
  rank: index + 1,
  isOurSchool: school.id === 'school-17',
}));
const activeResponse: LibraryCompetitionResponse = {
  competition: {
    state: createLibraryCompetition({ seasonId: '2026-09', seed: 'state-qa', startedAt: now, bookIds: [] }),
    standings,
    serverAt: now,
  },
  value: {},
  updatedAt: now,
  rolledOver: false,
};
const inactiveResponse: LibraryCompetitionResponse = {
  competition: { state: null, standings: [], serverAt: now },
  value: {}, updatedAt: null, rolledOver: false,
};

function installFixtureClient() {
  libraryCompetitionClient.read = async (intent) => {
    readCalls.push(state === 'inactive-readonly' ? 'readonly' : intent);
    if (state === 'loading') return new Promise<LibraryCompetitionResponse>(() => {});
    if (state === 'unavailable') throw new LibraryCompetitionClientError('LIBRARY_COMPETITION_UNAVAILABLE');
    return inactiveResponse;
  };
  libraryCompetitionClient.history = async () => ({ months: [], archive: null });
  libraryCompetitionClient.settings = async () => {
    writeCalls.push('settings');
    throw new Error('fixture write should not occur');
  };
}

function Fixture() {
  installFixtureClient();
  const returnFocusRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(true);
  return <main className={`state-qa-fixture state-qa-${surface}`}>
    <p className="state-qa-label">INJECTED FIXTURE · {surface} · {state}</p>
    {surface === 'student' ? <>
      <canvas ref={returnFocusRef} tabIndex={0} aria-label="책방으로 돌아가기" width="20" height="20" />
      {open && <LibraryCompetitionPanel onClose={() => setOpen(false)} onSnapshot={() => undefined} returnFocusRef={returnFocusRef} />}
      {!open && <p role="status">순위판 닫힘 · focus target restored</p>}
    </> : <TeacherLibraryCompetitionPanel />}
    <output data-qa-read-calls>{readCalls.join(',')}</output>
    <output data-qa-write-calls>{writeCalls.join(',')}</output>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
