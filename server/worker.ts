import {ApiRouter} from './router';
import {registerAiRoutes} from './ai';
import {registerLibraryRoutes} from './library';
import {cloudStorage} from './storage';
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        const router = new ApiRouter();
        registerAiRoutes(router, env);
        registerLibraryRoutes(router, cloudStorage(env));
        return await router.fetch(request);
      } catch {
        return Response.json({error: 'Library storage is unavailable. Please try again later.'}, {status:503});
      }
    }
    return env.ASSETS.fetch(request);
  },
};
