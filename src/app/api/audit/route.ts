import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type Baris = {
  id: string; waktu: string; action: string; entity_table: string | null; entity_id: string | null;
  detail: Record<string, unknown> | null; aktor_id: string | null; aktor: string | null;
  peran: string[] | null; cabang: string | null; label: string | null;
};

// Jejak Audit: alat investigasi. Pagination, filter, pencarian, ekspor CSV.
export async function GET(request: Request) {
  const denied = await guard("settings.manage");
  if (denied.error) return denied.error;

  const url = new URL(request.url);
  const p = url.searchParams;
  const per = Math.min(Math.max(Number(p.get("per") || 50), 10), 200);
  const page = Math.max(Number(p.get("page") || 1), 1);
  const ofset = (page - 1) * per;

  const syarat: string[] = ["1=1"];
  const nilai: unknown[] = [];
  const tambah = (sql: string, v: unknown) => {
    nilai.push(v);
    syarat.push(sql.replace("?", `$${nilai.length}`));
  };

  if (p.get("aktor")) tambah("lower(coalesce(u.full_name,'')) LIKE lower(?)", `%${p.get("aktor")}%`);
  if (p.get("aksi")) tambah("a.action ILIKE ?", `%${p.get("aksi")}%`);
  if (p.get("entity")) tambah("a.entity_table = ?", p.get("entity"));
  if (p.get("dari")) tambah("(a.created_at AT TIME ZONE 'Asia/Jakarta')::date >= (?::date)", p.get("dari"));
  if (p.get("sampai")) tambah("(a.created_at AT TIME ZONE 'Asia/Jakarta')::date <= (?::date)", p.get("sampai"));
  if (p.get("q")) {
    nilai.push(`%${p.get("q")}%`);
    syarat.push(`(a.action ILIKE $${nilai.length} OR coalesce(a.detail::text,'') ILIKE $${nilai.length} OR coalesce(a.entity_id::text,'') ILIKE $${nilai.length})`);
  }

  const where = syarat.join(" AND ");

  try {
    const totalRows = await query<{ n: string }>(
      `SELECT count(*) AS n FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id WHERE ${where}`,
      nilai
    );

    const rows = await query<Baris>(
      `SELECT a.id,
              to_char(a.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS') AS waktu,
              a.action, a.entity_table, a.entity_id, a.detail,
              a.user_id AS aktor_id,
              coalesce(u.full_name, 'Sistem') AS aktor,
              ARRAY[u.role::text] AS peran,
              b.name AS cabang,
              coalesce(a.detail->>'anak', a.detail->>'nama', a.detail->>'judul', a.detail->>'email',
                       a.detail->>'anak_nama', a.detail->>'nomor') AS label
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN branches b ON b.id = a.branch_id
        WHERE ${where}
        ORDER BY a.created_at DESC
        LIMIT ${per} OFFSET ${ofset}`,
      nilai
    );

    if (p.get("format") === "csv") {
      const kepala = ["waktu_wib", "aktor", "peran", "cabang", "aksi", "entitas", "entitas_id", "detail"];
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const isi = rows.map((r) => [
        r.waktu.replace("T", " "), r.aktor, (r.peran || []).join("|"), r.cabang || "",
        r.action, r.entity_table || "", r.entity_id || "",
        Object.entries(r.detail || {}).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("; "),
      ].map(esc).join(";"));
      const csv = [kepala.map(esc).join(";"), ...isi].join("\r\n");
      return new NextResponse("\uFEFF" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="jejak-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      logs: rows,
      total: Number(totalRows[0]?.n || 0),
      page,
      per,
      halaman: Math.max(Math.ceil(Number(totalRows[0]?.n || 0) / per), 1),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message, logs: [], total: 0 }, { status: 503 });
  }
}
