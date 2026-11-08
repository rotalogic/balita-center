import { Pool, types } from "pg";

// Satu pool PostgreSQL untuk seluruh API. DATABASE_URL dibaca dari env:
// contoh postgres://balita:***@localhost:5432/balita_center
const globalForDb = globalThis as unknown as { balitaPool?: Pool };

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL belum diatur. Salin .env.example menjadi .env.local dan isi koneksi PostgreSQL."
    );
  }
  if (!globalForDb.balitaPool) {
    globalForDb.balitaPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }
  return globalForDb.balitaPool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  // Kolom DATE adalah tanggal kalender, bukan momen waktu. Tanpa ini, node-pg
// mengubahnya jadi Date lalu JSON menulis "2026-11-07T17:00:00.000Z" sehingga
// editor menampilkan tanggal sehari lebih awal.
types.setTypeParser(1082, (v: string) => v);

const pool = getPool();
  const result = await pool.query(sql, params as never[]);
  return result.rows as T[];
}

const FRIENDLY: Record<string, string> = {
  "23505": "Data ini sudah ada — kemungkinan duplikat. Periksa kembali isian Anda.",
  "23503": "Data terkait tidak ditemukan atau masih dipakai data lain.",
  "23502": "Ada kolom wajib yang belum diisi.",
  "23514": "Nilai tidak lolos aturan validasi.",
  "22P02": "Format data tidak valid.",
  "22007": "Format tanggal atau waktu tidak valid.",
  "22001": "Teks terlalu panjang untuk kolom tersebut.",
  "53300": "Server database sedang sibuk. Coba lagi sebentar.",
  "57P01": "Koneksi database terputus. Coba lagi.",
};

// Satu tempat untuk semua pesan error yang dilihat pengguna.
// - P0001 = RAISE EXCEPTION dari trigger/fungsi kita sendiri → pesannya memang
//   ditulis dalam Bahasa Indonesia untuk pengguna, jadi diteruskan.
// - Kode PostgreSQL lain dipetakan ke pesan manusiawi; pesan mentah (nama
//   constraint, potongan SQL, stack) TIDAK PERNAH dikirim ke klien.
export function dbErrorMessage(
  error: unknown,
  fallback = "Terjadi kesalahan pada server. Coba lagi atau hubungi admin."
): string {
  const e = error as { code?: string; message?: string } | null;
  const code = e?.code;
  if (code === "P0001") return e?.message || fallback;
  if (code && FRIENDLY[code]) return FRIENDLY[code];
  return fallback;
}
