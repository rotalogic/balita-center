// Konfigurasi Masuk/Daftar dengan Google (OAuth 2.0).
// Fitur hanya aktif bila pemilik server mengisi GOOGLE_CLIENT_ID dan
// GOOGLE_CLIENT_SECRET di berkas env. URI alihan ini harus terdaftar persis
// sama di Google Cloud Console pada klien OAuth yang dipakai.

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(): string {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${base}/api/auth/google/callback`;
}
