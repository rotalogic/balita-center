import { Pool } from "pg";

// Satu pool PostgreSQL untuk seluruh API. DATABASE_URL dibaca dari env:
// contoh postgres://balita:password@localhost:5432/balita_center
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
  const pool = getPool();
  const result = await pool.query(sql, params as never[]);
  return result.rows as T[];
}

export function dbErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Pesan trigger PostgreSQL (mis. syarat terbit laporan) diteruskan apa adanya
    // karena memang ditulis untuk dibaca pengguna.
    return error.message;
  }
  return "Terjadi kesalahan pada server.";
}
