import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {ApiRouter} from './server/router.ts';
import {registerAiRoutes} from './server/ai.ts';
import {registerLibraryRoutes} from './server/library.ts';
import {localStorage} from './server/local-storage.ts';

const root = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({path: [path.join(root, '.env.local'), path.join(root, '.env')], quiet:true});
if (!process.env.GOOGLE_CLOUD_TTS_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_CLOUD_TTS_SERVICE_ACCOUNT_JSON = readFileSync(path.resolve(root, process.env.GOOGLE_APPLICATION_CREDENTIALS), 'utf8').replace(/^\uFEFF/, '');
}
const app = express(), port = Number(process.env.PORT || 3000);
const api = new ApiRouter();
registerAiRoutes(api, process.env);
registerLibraryRoutes(api, localStorage(path.resolve(root, process.env.LIBRARY_DIRECTORY || 'library-data')));
app.disable('x-powered-by');
app.use('/api', express.raw({type: '*/*', limit: '16mb'}), async (req, res) => {
  try {
    const authority = new URL('http://' + req.headers.host);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(authority.hostname)) {res.status(403).end(); return;}
    const response = await api.fetch(new Request(new URL(req.originalUrl, authority), {
      method: req.method,
      headers: Object.fromEntries(Object.entries(req.headers).filter(([, v]) => typeof v === 'string')) as Record<string,string>,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
    }));
    res.status(response.status);
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch {res.status(500).json({error: 'Request failed. Please try again.'});}
});
app.use((error: any, _req: any, res: any, next: any) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({error: 'Extracted book is too large (16 MB limit).'});
  if (error) return res.status(400).json({error: 'Invalid request.'});
  next();
});
if (process.env.NODE_ENV !== 'production' && !process.argv.includes('--production')) {
  const {createServer} = await import('vite');
  const vite = await createServer({root, configLoader:'runner', server:{middlewareMode:true}, appType:'spa'});
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(root, 'dist/client')));
  app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist/client/index.html')));
}
app.listen(port, '127.0.0.1', () => console.log('Adam’s Library is ready at http://localhost:' + port));
