# Adam’s Library

Adam’s Library imports EPUB and text files, organizes them into a personal audiobook shelf, and reads chapters with device speech. Gemini can optionally provide chapter insights and generated narration when a server API key is configured. Open Library search is for discovery; it does not add books to your shelf.

## Run locally

Use Node.js 24 or newer.

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. To enable Gemini features, create `.env.local` and set `GEMINI_API_KEY` there. The key stays on the server and must not be committed. Uploaded books are stored in the ignored `library-data/` folder on this computer.

## Checks

```powershell
npm test
npm run lint
npm run build
```

The production build writes static files to `dist/client` and the Cloudflare Worker entry point to `dist/worker/index.js`.

## Cloud deployment preparation

The included `wrangler.example.toml` is a Cloudflare Workers deployment template. Copy it to `wrangler.toml`, create a D1 database and an R2 bucket, and replace the D1 database ID and resource names. Apply `db/migrations/0001_library_records.sql`, then set `GEMINI_API_KEY` as a Worker secret if Gemini features are wanted. Build with `npm run build` before deploying with Wrangler. The template does not include credentials or a published deployment.

Keep `.env.local`, `library-data/`, and uploaded EPUB files out of version control. Only add books to the public source repository when their distribution rights allow it.
