import { withStorageRequestTiming } from '../../src/server/storageRequestTiming.js';

const handlers = new Map([
  ['/api/announcement-notes', () => import('../../api/announcement-notes.js')],
  ['/api/class-donation', () => import('../../api/class-donation.js')],
  ['/api/classword', () => import('../../api/classword.js')],
  ['/api/device-session', () => import('../../api/device-session.js')],
  ['/api/newspaper', () => import('../../api/newspaper.js')],
  ['/api/save-alerts', () => import('../../api/save-alerts.js')],
  ['/api/shared-settings', () => import('../../api/shared-settings.js')],
  ['/api/student-economy', () => import('../../api/student-economy.js')],
  ['/api/today-friend', () => import('../../api/today-friend.js')],
  ['/api/weekly-mission', () => import('../../api/weekly-mission.js')],
  ['/api/weekly-missions', () => import('../../api/weekly-missions.js')],
]);

export default async function handler(request: Request): Promise<Response> {
  const started = performance.now();
  const url = new URL(request.url);
  const route = handlers.get(url.pathname);
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Content-Type': 'application/json' });
  const region = process.env.AWS_REGION;
  if (region && /^[a-z]{2}(?:-gov)?-[a-z]+-\d+$/.test(region)) headers.set('X-School-Function-Region', region);
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
    const { default: execute } = await route();
    await withStorageRequestTiming(async timing => {
      try { await execute(apiRequest, response); }
      finally { headers.set('Server-Timing', `app;dur=${(performance.now() - started).toFixed(1)}, storage;dur=${timing.duration.toFixed(1)};desc="${timing.calls} RPC"`); }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR' }), { status: 500, headers });
  }
  return new Response(status === 204 || status === 304 || request.method === 'HEAD' ? null : body, { status, headers });
}

export const config = {
  path: '/api/*',
};
