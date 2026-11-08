// Sesi login: cookie bertanda tangan HMAC-SHA256.
// Pakai Web Crypto supaya bisa dipakai juga di middleware (Edge runtime).
//
// Umur sesi (Jilid 4 Blok 3): idle 8 jam dengan perpanjangan meluncur pada
// aktivitas, batas absolut 7 hari. 6 menit terlalu pendek untuk staf sekolah.
const encoder = new TextEncoder();

export const SESI_IDLE_DETIK = 8 * 60 * 60;
export const SESI_ABSOLUT_DETIK = 7 * 24 * 60 * 60;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET belum diatur");
  return value;
}

function b64urlEncode(bytes: Uint8Array): string {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function sign(payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

// exp = batas idle, abs = batas absolut (tidak pernah diperpanjang).
export async function signSession(
  userId: string,
  ttlSeconds = SESI_IDLE_DETIK,
  absoluteExp?: number
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const abs = absoluteExp ?? Math.floor(Date.now() / 1000) + SESI_ABSOLUT_DETIK;
  const payload = `${userId}.${exp}.${abs}`;
  return `${payload}.${b64urlEncode(await sign(payload))}`;
}

export type SesiSah = { userId: string; exp: number; abs: number };

export async function bacaSession(token: string | undefined): Promise<SesiSah | null> {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 4) return null;
    const [userId, expText, absText, sigText] = parts;
    const sekarang = Math.floor(Date.now() / 1000);
    const exp = Number(expText);
    const abs = Number(absText);
    if (!Number.isFinite(exp) || !Number.isFinite(abs)) return null;
    if (exp < sekarang || abs < sekarang) return null;

    const expected = await sign(`${userId}.${expText}.${absText}`);
    const given = b64urlDecode(sigText);
    if (given.length !== expected.length) return null;

    let diff = 0;
    for (let i = 0; i < expected.length; i += 1) diff |= expected[i] ^ given[i];
    return diff === 0 ? { userId, exp, abs } : null;
  } catch {
    return null;
  }
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  const sesi = await bacaSession(token);
  return sesi?.userId ?? null;
}
