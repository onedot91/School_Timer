import { useCallback, useEffect, useRef, useState } from 'react';
import { getKoreanIsoWeekKey } from './weeklyMission';
import { loadNewspaper } from './newspaperClient';
import type { NewspaperData } from './newspaperQuestion';

export const useNewspaper = (actor: number, selectedWeek?: string) => {
  const [currentWeek, setCurrentWeek] = useState(getKoreanIsoWeekKey);
  const week = selectedWeek ?? currentWeek;
  const [data, setData] = useState<NewspaperData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true); setError('');
    try { const next = await loadNewspaper(actor, week); if (request === sequence.current) setData(next); }
    catch { if (request === sequence.current) setError('질문을 불러오지 못했어요. 새로고침하거나 선생님께 알려 주세요.'); }
    finally { if (request === sequence.current) setLoading(false); }
  }, [actor, week]);
  useEffect(() => { setData(null); void refresh(); return () => { sequence.current++; }; }, [refresh]);
  useEffect(() => {
    const check = () => { if (document.visibilityState === 'visible') setCurrentWeek(getKoreanIsoWeekKey()); };
    const timer = window.setInterval(check, 60_000);
    window.addEventListener('focus', check);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', check); };
  }, []);
  return { data: data?.weekKey === week ? data : null, error, loading, refresh, week, currentWeek };
};
