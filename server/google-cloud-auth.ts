type Env = Record<string, string | undefined>;
type Token = {value: string; expires: number};
const tokens = new Map<string, Promise<Token>>();
const tokenUrl = 'https://oauth2.googleapis.com/token';
const scope = 'https://www.googleapis.com/auth/cloud-platform';
const apiKey = (env: Env) => env.GOOGLE_CLOUD_TTS_API_KEY && !/^(MY_|YOUR_|REPLACE_)/.test(env.GOOGLE_CLOUD_TTS_API_KEY) ? env.GOOGLE_CLOUD_TTS_API_KEY : '';
export const cloudConfigured = (env: Env) => !!cloudCredentialIdentity(env);
export const cloudCredentialIdentity = (env: Env) => env.GOOGLE_CLOUD_TTS_SERVICE_ACCOUNT_JSON?.trim() || apiKey(env);

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const encode = (data: unknown) => base64url(new TextEncoder().encode(JSON.stringify(data)));

async function issueToken(raw: string): Promise<Token> {
  // Never use credential-supplied URLs: send credentials only to Google's OAuth endpoint.
  const account = JSON.parse(raw);
  if (account.type !== 'service_account' || typeof account.client_email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(account.client_email) ||
      typeof account.private_key !== 'string') throw new Error('Invalid Google service account');
  const pem = account.private_key.match(/^-----BEGIN PRIVATE KEY-----\s+([A-Za-z0-9+/=\s]+)-----END PRIVATE KEY-----\s*$/);
  if (!pem) throw new Error('Invalid Google private key');
  const bytes = Uint8Array.from(atob(pem[1].replace(/\s/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', bytes, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const jwt = `${encode({alg: 'RS256', typ: 'JWT'})}.${encode({iss: account.client_email, scope, aud: tokenUrl, iat: now, exp: now + 3600})}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(jwt));
  const response = await fetch(tokenUrl, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${jwt}.${base64url(new Uint8Array(signature))}`}),
    signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`Google authentication returned HTTP ${response.status}`);
  const data = await response.json() as any;
  if (typeof data.access_token !== 'string' || !data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 60) throw new Error('Invalid Google token response');
  return {value: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000};
}

export async function cloudAuthHeaders(env: Env): Promise<Record<string, string>> {
  const raw = env.GOOGLE_CLOUD_TTS_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return {'x-goog-api-key': apiKey(env)};
  let pending = tokens.get(raw);
  if (!pending) {
    if (tokens.size >= 4) tokens.delete(tokens.keys().next().value!);
    pending = issueToken(raw);
    tokens.set(raw, pending);
  }
  try {
    const token = await pending;
    if (token.expires <= Date.now()) {
      if (tokens.get(raw) === pending) tokens.delete(raw);
      return cloudAuthHeaders(env);
    }
    return {Authorization: `Bearer ${token.value}`};
  } catch (error) {
    if (tokens.get(raw) === pending) tokens.delete(raw);
    throw error;
  }
}
