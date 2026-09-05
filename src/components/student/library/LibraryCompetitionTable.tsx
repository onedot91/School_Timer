import type { LibraryCompetitionStanding } from '../../../lib/libraryCompetition';

export function LibraryCompetitionTable({ standings }: { readonly standings: readonly LibraryCompetitionStanding[] }) {
  return <div className="library-competition-table-scroll" tabIndex={0} role="region" aria-label="학교별 순위">
    <table className="library-competition-table">
      <thead><tr><th scope="col">순위</th><th scope="col">지역</th><th scope="col">학교</th><th scope="col">모은 책</th></tr></thead>
      <tbody>{standings.map(row => <tr key={row.schoolId} data-school-id={row.schoolId} aria-current={row.isOurSchool ? 'true' : undefined} className={row.isOurSchool ? 'is-our-school' : ''}>
        <td><span className={`library-competition-rank rank-${row.rank}`}>{row.rank}</span></td>
        <td>{row.region}</td>
        <th scope="row">{row.schoolName}{row.isOurSchool && <span className="library-competition-own-label">우리 학교</span>}</th>
        <td><strong>{row.count}</strong><span className="library-competition-unit">권</span></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

export function LibraryCompetitionCountFields({ standings, counts, disabled, onChange }: {
  readonly standings: readonly LibraryCompetitionStanding[];
  readonly counts: Readonly<Record<string, string>>;
  readonly disabled: boolean;
  readonly onChange: (schoolId: string, value: string) => void;
}) {
  return <div className="teacher-library-competition-counts">{standings.map(row => <label key={row.schoolId} className={row.isOurSchool ? 'is-our-school' : ''}>
    <span><small>{row.region}</small><strong>{row.schoolName}</strong></span>
    {row.isOurSchool ? <output aria-label="우리 학교 실제 모은 책">{row.count}<small>권 · 자동 집계</small></output> : <input
      type="number" name={row.schoolId} aria-label={`${row.schoolName} 모은 책`} min="0" max="100" step="1" required
      disabled={disabled} value={counts[row.schoolId] ?? ''} onChange={event => onChange(row.schoolId, event.target.value)}
    />}
  </label>)}</div>;
}
