const SESSION_COOKIE = "pasta_visa_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function sessionSecret(): string {
  return (
    process.env.APP_SESSION_SECRET ||
    process.env.APP_BASIC_AUTH_PASSWORD ||
    "pasta-visa-dev-session"
  );
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64Url(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

export function sessionMaxAgeSeconds(): number {
  return SESSION_MAX_AGE_SECONDS;
}

export async function createSessionToken(): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(token?: string | null): Promise<boolean> {
  if (!token) return false;
  const [expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!expiresAtRaw || !signature || !Number.isFinite(expiresAt)) return false;
  if (expiresAt < Date.now()) return false;
  const expected = await sign(expiresAtRaw);
  return timingSafeEqual(signature, expected);
}

export function authCredentialsConfigured(): boolean {
  return !!process.env.APP_BASIC_AUTH_USER && !!process.env.APP_BASIC_AUTH_PASSWORD;
}

export function validateCredentials(user: string, password: string): boolean {
  return (
    authCredentialsConfigured() &&
    user === process.env.APP_BASIC_AUTH_USER &&
    password === process.env.APP_BASIC_AUTH_PASSWORD
  );
}
