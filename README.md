# Adam’s Library

Adam’s Library imports EPUB and text files and narrates chapters using Gemini or Google Cloud TTS. Device speech is used automatically if the selected provider has no backend key, fails, or returns unplayable audio. Open Library search is for discovery; it does not add books to your shelf.

## Run locally

Use Node.js 24 or newer.

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Copy `.env.example` to `.env.local` and set `GEMINI_TTS_API_KEY` for Gemini narration or `GOOGLE_CLOUD_TTS_API_KEY` for Google Cloud voices. `GEMINI_API_KEY` is also accepted for Gemini narration and enables chapter insights. The Node server loads `.env.local` automatically. Never prefix a secret with `VITE_` or commit a real key. Uploaded books are stored in the ignored `library-data/` folder on this computer.

For the hosted Site, add these same variables as **secrets** in Site settings. A local `.env.local` does not automatically configure the hosted runtime. Cloud TTS also needs the Text-to-Speech API enabled in the key's Cloud project and compatible Google billing/API access.

`POST /api/tts` accepts `{text, languageCode, voiceId, provider, style}`. Providers are `gemini` and `google-cloud`. Text is limited to 1000 characters per chunk. The server returns Base64 audio and its MIME type: Cloud uses MP3; Gemini PCM is wrapped in a WAV container by the client. `GET /api/tts/voices?languageCode=en-US` loads official Standard, WaveNet and Neural2 identifiers through Google's backend voice-list API. Existing `voiceName` requests remain supported. Secrets are sent to Google only by the backend and never returned to the browser.

## Checks

```powershell
npm test
npm run lint
npm run build
```

The production build writes static files to `dist/client` and the Cloudflare Worker entry point to `dist/server/index.js`.

## Cloud deployment preparation

The included `wrangler.example.toml` is a Cloudflare Workers deployment template. Copy it to `wrangler.toml`, create a D1 database and an R2 bucket, and replace the D1 database ID and resource names. Apply `db/migrations/0001_library_records.sql`, then set `GEMINI_API_KEY` as a Worker secret if Gemini features are wanted. Build with `npm run build` before deploying with Wrangler. The template does not include credentials or a published deployment.

Keep `.env.local`, `library-data/`, and uploaded EPUB files out of version control. Only add books to the public source repository when their distribution rights allow it.
