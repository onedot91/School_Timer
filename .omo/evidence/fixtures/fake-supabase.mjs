import express from 'express';

const app = express();
app.use(express.json({ limit: '1mb' }));

const isoNow = () => new Date().toISOString();
const baseValue = {
  currencyBalances: { '1': 500, '2': 250 },
  auctionItems: [
    { id: 'item-a', name: '월요일 연필', startPrice: 10, dayIndex: 0 },
    { id: 'item-b', name: '화요일 지우개', startPrice: 20, dayIndex: 1 },
  ],
  auctionBids: {},
  auctionBidHistory: {},
  auctionAwards: {},
  auctionMissions: [{ id: 'qa-mission', content: '합성 미션', rewardAmount: 15 }],
};

const state = {
  row: { id: 'school-timer-main', value: structuredClone(baseValue), updated_at: '2026-07-06T00:00:00.000Z' },
  notes: [],
  requestLog: [],
  delayMs: { GET: 0, PATCH: 0, POST: 0 },
  failMethods: [],
};

const recordRequest = (req) => {
  state.requestLog.push({
    at: isoNow(), method: req.method, host: req.headers.host ?? '', path: req.path,
    query: req.query, body: req.body ?? null,
  });
};

app.use((req, res, next) => {
  recordRequest(req);
  if (req.path.startsWith('/__qa/')) return next();
  res.set('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.set('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? 'authorization, apikey, content-type, x-client-info, prefer');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const delay = state.delayMs[req.method] ?? 0;
  if (state.failMethods.includes(req.method)) {
    return setTimeout(() => res.status(500).json({ code: 'QA_FORCED_ERROR', message: 'fixture forced error' }), delay);
  }
  return setTimeout(next, delay);
});

app.get('/__qa/state', (_req, res) => res.json(state));
app.post('/__qa/control', (req, res) => {
  const body = req.body ?? {};
  if (body.reset === true) {
    state.row = { id: 'school-timer-main', value: structuredClone(baseValue), updated_at: '2026-07-06T00:00:00.000Z' };
    state.notes = [];
    state.requestLog = [];
    state.delayMs = { GET: 0, PATCH: 0, POST: 0 };
    state.failMethods = [];
  }
  if (body.value !== undefined) state.row.value = body.value;
  if (body.delayMs) state.delayMs = { ...state.delayMs, ...body.delayMs };
  if (body.failMethods) state.failMethods = body.failMethods;
  if (body.clearRequestLog === true) state.requestLog = [];
  res.json({ ok: true, state });
});

app.get('/rest/v1/app_settings', (_req, res) => res.json(state.row ? [state.row] : []));
app.post('/rest/v1/app_settings', (req, res) => {
  state.row = { ...req.body, updated_at: req.body.updated_at ?? isoNow() };
  res.status(201).json([state.row]);
});
app.patch('/rest/v1/app_settings', (req, res) => {
  if (!state.row) return res.json([]);
  if (req.query.updated_at && req.query.updated_at !== `eq.${state.row.updated_at}`) return res.json([]);
  state.row = { ...state.row, ...req.body, updated_at: req.body.updated_at ?? isoNow() };
  return res.json([state.row]);
});
app.get('/rest/v1/announcement_notes', (_req, res) => res.json(state.notes));
app.post('/rest/v1/announcement_notes', (req, res) => {
  const record = { ...req.body, updated_at: req.body.updated_at ?? isoNow() };
  const index = state.notes.findIndex((note) => note.date_key === record.date_key);
  if (index >= 0) state.notes[index] = record; else state.notes.push(record);
  res.status(201).json([record]);
});
app.patch('/rest/v1/announcement_notes', (req, res) => {
  const key = String(req.query.date_key ?? '').replace(/^eq\./, '');
  const index = state.notes.findIndex((note) => note.date_key === key);
  if (index < 0) return res.json([]);
  state.notes[index] = { ...state.notes[index], ...req.body, updated_at: req.body.updated_at ?? isoNow() };
  return res.json([state.notes[index]]);
});

app.use((_req, res) => res.status(404).json({ error: 'fake-supabase route not implemented' }));

const server = app.listen(54329, '127.0.0.1', () => {
  process.stdout.write('FAKE_SUPABASE_READY 127.0.0.1:54329\n');
});
const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
