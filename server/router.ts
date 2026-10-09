type Handler = (req: any, res: any) => unknown;
export interface RouteApp {
  get(path: string, handler: Handler): unknown;
  post(path: string, handler: Handler): unknown;
  put(path: string, handler: Handler): unknown;
  delete(path: string, handler: Handler): unknown;
}
export class ApiRouter implements RouteApp {
  private routes: {method: string; path: string; handler: Handler}[] = [];
  get(path: string, handler: Handler) { this.routes.push({method: 'GET', path, handler}); }
  post(path: string, handler: Handler) { this.routes.push({method: 'POST', path, handler}); }
  put(path: string, handler: Handler) { this.routes.push({method: 'PUT', path, handler}); }
  delete(path: string, handler: Handler) { this.routes.push({method: 'DELETE', path, handler}); }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const headers = new Headers({'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
    let status = 200, response: Response | null = null;
    const res = {
      status(code: number) {status = code; return res;},
      set(name: string, value: string) {headers.set(name, value); return res;},
      type(value: string) {headers.set('Content-Type', value); return res;},
      json(value: unknown) {headers.set('Content-Type', 'application/json'); response = new Response(JSON.stringify(value), {status, headers}); return response;},
      send(value: BodyInit) {response = new Response(value, {status, headers}); return response;},
      sendStatus(code: number) {status = code; return res.json({error: 'Request could not be completed.'});},
    };
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        const origin = request.headers.get('origin');
        if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return res.status(403).json({error: 'Cross-site requests are not allowed.'});
      }
      const segments = url.pathname.split('/');
      for (const route of this.routes) {
        if (route.method !== request.method) continue;
        const pattern = route.path.split('/');
        if (pattern.length !== segments.length) continue;
        const params: Record<string, string> = {};
        if (!pattern.every((part, i) => part.startsWith(':') ? (params[part.slice(1)] = decodeURIComponent(segments[i]), true) : part === segments[i])) continue;
        let body = {};
        if (['POST', 'PUT'].includes(request.method)) {
          if (!request.headers.get('content-type')?.includes('application/json')) return res.status(415).json({error: 'Expected JSON.'});
          const reader = request.body?.getReader(), chunks: Uint8Array[] = [];
          let size = 0;
          if (reader) {
            while (true) {
              const next = await reader.read(); if (next.done) break;
              size += next.value.length;
              if (size > 64 * 1024 * 1024) {await reader.cancel(); return res.status(413).json({error: 'This book contains more than 64 MB of extracted text. Try a text-only EPUB or a smaller volume.'});}
              chunks.push(next.value);
            }
          }
          const bytes = new Uint8Array(size); let offset = 0;
          for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
          try {body = JSON.parse(new TextDecoder().decode(bytes));} catch {return res.status(400).json({error: 'Invalid JSON.'});}
          if (!body || Array.isArray(body) || typeof body !== 'object') return res.status(400).json({error: 'Expected an object.'});
        }
        await route.handler({body, params, query: Object.fromEntries(url.searchParams), signal: request.signal}, res);
        return response || res.status(500).json({error: 'No response was produced.'});
      }
      return res.status(404).json({error: 'Endpoint not found.'});
    } catch (error) {
      console.error('API request failed', error instanceof Error ? error.name : 'Unknown error');
      return res.status(500).json({error: 'The service is unavailable. Please try again.'});
    }
  }
}
