export const LIBRARY_COMPETITION_OUR_SCHOOL_ID = 'school-03'
export const LIBRARY_COMPETITION_SCHOOLS = [
  { schoolId: 'school-01', schoolName: '서울공덕초등학교', region: '서울특별시' },
  { schoolId: 'school-02', schoolName: '연포초등학교', region: '부산광역시' },
  { schoolId: 'school-03', schoolName: '대구장동초등학교', region: '대구광역시' },
  { schoolId: 'school-04', schoolName: '인천송도초등학교', region: '인천광역시' },
  { schoolId: 'school-05', schoolName: '광주서림초등학교', region: '광주광역시' },
  { schoolId: 'school-06', schoolName: '대전목동초등학교', region: '대전광역시' },
  { schoolId: 'school-07', schoolName: '옥동초등학교', region: '울산광역시' },
  { schoolId: 'school-08', schoolName: '도담초등학교', region: '세종특별자치시' },
  { schoolId: 'school-09', schoolName: '수원초등학교', region: '경기도' },
  { schoolId: 'school-10', schoolName: '강릉초등학교', region: '강원특별자치도' },
  { schoolId: 'school-11', schoolName: '충주초등학교', region: '충청북도' },
  { schoolId: 'school-12', schoolName: '공주초등학교', region: '충청남도' },
  { schoolId: 'school-13', schoolName: '전주초등학교', region: '전북특별자치도' },
  { schoolId: 'school-14', schoolName: '목포초등학교', region: '전라남도' },
  { schoolId: 'school-15', schoolName: '영주남부초등학교', region: '경상북도' },
  { schoolId: 'school-16', schoolName: '진주초등학교', region: '경상남도' },
  { schoolId: 'school-17', schoolName: '제주동초등학교', region: '제주특별자치도' },
] as const

export type LibraryCompetitionSpeed = 0.5 | 1 | 1.5
export type LibraryCompetitionPlacement = { readonly bookId: string; readonly at: string }
export type LibraryCompetitionCount = { readonly schoolId: string; readonly count: number }
export type LibraryCompetitionAdjustment = {
  readonly id: string
  readonly at: string
  readonly speed: LibraryCompetitionSpeed
  readonly paused: boolean
  readonly counts: readonly LibraryCompetitionCount[]
}
export type LibraryCompetitionState = {
  readonly version: 1
  readonly seasonId: string
  readonly seed: string
  readonly startedAt: string
  readonly revision: number
  readonly placements: readonly LibraryCompetitionPlacement[]
  readonly adjustments: readonly LibraryCompetitionAdjustment[]
}
export type LibraryCompetitionStanding = {
  readonly schoolId: string
  readonly schoolName: string
  readonly region: string
  readonly count: number
  readonly reachedAt: string
  readonly rank: number
  readonly isOurSchool: boolean
}
export class LibraryCompetitionInputError extends Error {
  readonly name = 'LibraryCompetitionInputError'
  constructor(readonly reason: 'invalid-state' | 'invalid-time' | 'invalid-event' | 'full') {
    super(`Invalid library competition input: ${reason}`)
  }
}
