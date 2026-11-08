import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// TOTP (RFC 6238) — tanpa dependency. SHA-1, 6 digit, langkah 30 detik.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;
const DIGITS = 6;

export function generateSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function codeAt(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter % 2 ** 32, 4);
  const digest = createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function currentCode(secret: string): string {
  return codeAt(secret, Math.floor(Date.now() / 1000 / STEP));
}

// window=1 berarti toleransi ±30 detik untuk jam yang tidak presisi.
export function verifyCode(secret: string, code: string, window = 1): boolean {
  const digits = (code || "").replace(/\D/g, "");
  if (digits.length !== DIGITS) return false;
  const counter = Math.floor(Date.now() / 1000 / STEP);
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = Buffer.from(codeAt(secret, counter + offset));
    const given = Buffer.from(digits);
    if (expected.length === given.length && timingSafeEqual(expected, given)) return true;
  }
  return false;
}

export function otpauthUrl(secret: string, email: string, issuer = "Balita Center"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP) });
  return `otpauth://totp/${label}?${params.toString()}`;
}
