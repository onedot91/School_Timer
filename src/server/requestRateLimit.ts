interface RequestHeaders {
  readonly [name: string]: string | readonly string[] | undefined;
}

interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
}

const MAX_REQUESTS_PER_WINDOW = 10;
const MAX_REQUESTS_PER_CLIENT = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_TRACKED_CLIENTS = 512;
const rateLimits = new Map<string, RateLimitEntry>();

const getHeader = (headers: RequestHeaders | undefined, name: string) => {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const getClientAddress = (headers: RequestHeaders | undefined) => {
  const forwardedFor = getHeader(headers, 'x-forwarded-for');
  const address = forwardedFor?.split(',')[0]?.trim() || getHeader(headers, 'x-real-ip')?.trim();
  return address && address.length <= 64 ? address : 'unknown';
};

const removeExpiredEntries = (now: number) => {
  for (const [key, entry] of rateLimits) {
    if (now - entry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) rateLimits.delete(key);
  }
};

const removeOldestEntry = () => {
  let oldestKey: string | null = null;
  let oldestStartedAt = Number.POSITIVE_INFINITY;
  for (const [key, entry] of rateLimits) {
    if (entry.windowStartedAt < oldestStartedAt) {
      oldestKey = key;
      oldestStartedAt = entry.windowStartedAt;
    }
  }
  if (oldestKey !== null) rateLimits.delete(oldestKey);
};

export const isCrossSiteRequest = (headers: RequestHeaders | undefined) => (
  getHeader(headers, 'sec-fetch-site')?.toLowerCase() === 'cross-site'
);

const consumeRateLimitKey = (
  key: string,
  limit: number,
  now: number,
) => {
  const current = rateLimits.get(key);
  if (!current) {
    if (rateLimits.size >= MAX_TRACKED_CLIENTS) removeOldestEntry();
    rateLimits.set(key, { count: 1, windowStartedAt: now });
    return { allowed: true, retryAfterSeconds: 0 } as const;
  }

  current.count += 1;
  if (current.count <= limit) return { allowed: true, retryAfterSeconds: 0 } as const;
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - current.windowStartedAt)) / 1000)),
  } as const;
};

export const consumeRequestRateLimit = (
  route: string,
  headers: RequestHeaders | undefined,
  studentNumber: number,
  now = Date.now(),
) => {
  removeExpiredEntries(now);
  const routeAndClient = `${route}:${getClientAddress(headers)}`;
  const clientResult = consumeRateLimitKey(`${routeAndClient}:all`, MAX_REQUESTS_PER_CLIENT, now);
  if (!clientResult.allowed) return clientResult;
  return consumeRateLimitKey(`${routeAndClient}:student:${studentNumber}`, MAX_REQUESTS_PER_WINDOW, now);
};
