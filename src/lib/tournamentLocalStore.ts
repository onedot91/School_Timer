import { normalizeTournament, type Tournament } from './tournament';

export const TOURNAMENT_STORAGE_KEY = 'school-timer-tournament-v1';

export const loadStoredTournament = (): Tournament | null => {
  try {
    return normalizeTournament(JSON.parse(localStorage.getItem(TOURNAMENT_STORAGE_KEY) || 'null'));
  } catch {
    return null;
  }
};

export const storeTournament = (tournament: Tournament | null): void => {
  if (tournament) localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(tournament));
  else localStorage.removeItem(TOURNAMENT_STORAGE_KEY);
};
