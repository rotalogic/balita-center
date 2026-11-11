// Penegakan kunci skema biaya di lapisan server (hanya dipakai route API).
// Skema berstatus Rancangan terkunci dari pembuatan invoice, penerimaan
// pembayaran, dan penayangan sebagai harga resmi sampai founder mengubah
// statusnya menjadi Final.
import { query } from "@/lib/db";

// Nama skema Rancangan pada program aktif anak, atau null bila tidak ada.
export async function skemaRancanganAnak(childId: string): Promise<string | null> {
  const rows = await query<{ nama: string }>(
    `SELECT s.nama
       FROM enrollments e
       JOIN programs p ON p.id = e.program_id
       JOIN skema_biaya s ON s.id = p.skema_id
      WHERE e.child_id = $1 AND e.status = 'aktif' AND s.status = 'rancangan'
      ORDER BY e.start_date DESC
      LIMIT 1`,
    [childId]
  );
  return rows[0]?.nama || null;
}

// Daftar nama program bercakupan cabang yang skemanya masih Rancangan.
export async function programRancanganDiCabang(branchId: string): Promise<string[]> {
  const rows = await query<{ name: string }>(
    `SELECT DISTINCT p.name
       FROM enrollments e
       JOIN programs p ON p.id = e.program_id
       JOIN skema_biaya s ON s.id = p.skema_id
      WHERE e.branch_id = $1 AND e.status = 'aktif' AND s.status = 'rancangan'`,
    [branchId]
  );
  return rows.map((r) => r.name);
}

export const PESAN_SKEMA_RANCANGAN = (nama: string) =>
  `Skema biaya "${nama}" berstatus Rancangan — terkunci dari pembuatan invoice dan penerimaan pembayaran sampai founder mengubah statusnya menjadi Final.`;
