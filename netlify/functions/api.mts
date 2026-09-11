import announcementNotes from '../../api/announcement-notes.js';
import classDonation from '../../api/class-donation.js';
import classword from '../../api/classword.js';
import deviceSession from '../../api/device-session.js';
import saveAlerts from '../../api/save-alerts.js';
import sharedSettings from '../../api/shared-settings.js';
import studentEconomy from '../../api/student-economy.js';
import todayFriend from '../../api/today-friend.js';
import weeklyMission from '../../api/weekly-mission.js';
import weeklyMissions from '../../api/weekly-missions.js';

const handlers = new Map([
  ['/api/announcement-notes', announcementNotes],
  ['/api/class-donation', classDonation],
  ['/api/classword', classword],
  ['/api/device-session', deviceSession],
  ['/api/save-alerts', saveAlerts],
  ['/api/shared-settings', sharedSettings],
  ['/api/student-economy', studentEconomy],
  ['/api/today-friend', todayFriend],
  ['/api/weekly-mission', weeklyMission],
  ['/api/weekly-missions', weeklyMissions],
]);

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const route = handlers.get(url.pathname);
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Content-Type': 'application/json' });
  if (!route) return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404, headers });

  const query: Record<string, string | readonly string[]> = Object.create(null);
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  }
  let status = 200;
  let body: string | null = null;
  const response = {
    setHeader(name: string, value: string) { headers.set(name, value); },
    status(code: number) { status = code; return response; },
    json(value: unknown) { body = JSON.stringify(value) ?? null; },
  };
  try {
    const apiRequest = {
      method: request.method,
      headers: Object.fromEntries(request.headers),
      query,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    };
    await route(apiRequest, response);
  } catch {
    return new Response(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR' }), { status: 500, headers });
  }
  return new Response(status === 204 || status === 304 || request.method === 'HEAD' ? null : body, { status, headers });
}

export const config = {
  path: '/api/*',
  excludedPath: '/api/question-submission-status',
};
