interface ApiRequest {
  readonly method?: string;
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
}

/** Shared clock reference so every classroom device schedules from the same instant. */
export default function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  response.status(200).json({ now: Date.now() });
}
