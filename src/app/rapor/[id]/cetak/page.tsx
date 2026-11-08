import { notFound, redirect } from "next/navigation";
import { query } from "@/lib/db";
import { currentUser, hasPermission } from "@/lib/current-user";
import { tanggalPanjang } from "@/lib/format";
import { TombolCetak } from "@/components/tombol-cetak";
import { GayaDokumen } from "@/components/dokumen";

export const dynamic = "force-dynamic";

const ASPEK: Array<[string, string]> = [
  ["narrative_agama_moral", "Nilai Agama dan Moral"],
  ["narrative_fisik_motorik", "Fisik-Motorik"],
  ["narrative_kognitif", "Kognitif"],
  ["narrative_bahasa", "Bahasa"],
  ["narrative_sosial_emosional", "Sosial-Emosional dan Kemandirian"],
  ["narrative_seni", "Seni"],
  ["narrative_practical_life", "Montessori — Practical Life"],
  ["narrative_language", "Montessori — Language"],
  ["narrative_sensorial", "Montessori — Sensorial"],
  ["narrative_mathematics", "Montessori — Mathematics"],
  ["narrative_cultural", "Montessori — Cultural"],
  ["conclusion", "Kesimpulan"],
  ["parent_suggestion", "Saran untuk Orang Tua"],
];

// Rapor perkembangan per siklus — dokumen GURU. Analisa Ailsa tidak pernah masuk sini.
export default async function CetakRapor({ params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/rapor/${params.id}/cetak`)}`);

  const rows = await query<Record<string, string | null> & { child_id: string }>(
    `SELECT cr.id, cr.status, cr.child_id, c.full_name AS child_name, b.name AS branch_name,
            (SELECT cl.name FROM enrollments e JOIN classes cl ON cl.id = e.class_id
              WHERE e.child_id = c.id AND e.status='aktif' ORDER BY e.start_date DESC NULLS LAST LIMIT 1) AS class_name,
            lc.theme AS cycle_name, lc.start_date, lc.end_date,
            s.full_name AS guru,
            to_char(cr.published_at AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD') AS published_on,
            cr.narrative_agama_moral, cr.narrative_fisik_motorik, cr.narrative_kognitif,
            cr.narrative_bahasa, cr.narrative_sosial_emosional, cr.narrative_seni,
            cr.narrative_practical_life, cr.narrative_language, cr.narrative_sensorial,
            cr.narrative_mathematics, cr.narrative_cultural, cr.conclusion, cr.parent_suggestion
       FROM cycle_reports cr
       JOIN children c ON c.id = cr.child_id
       JOIN branches b ON b.id = cr.branch_id
       LEFT JOIN learning_cycles lc ON lc.id = cr.cycle_id
       LEFT JOIN staff s ON s.id = cr.created_by
      WHERE cr.id = $1::uuid`,
    [params.id]
  );
  const r = rows[0];
  if (!r) notFound();
  let boleh = hasPermission(user, "reports.view") || user.roles.includes("super_admin");
  if (r.status !== "published" && !boleh) notFound();
  if (!boleh) {
    const wali = await query<{ n: string }>(
      `SELECT count(*) AS n FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
        WHERE cg.child_id = $1::uuid AND lower(g.email) = lower($2)`,
      [r.child_id, user.email]
    );
    boleh = Number(wali[0]?.n || 0) > 0;
  }
  if (!boleh) return new Response("Anda tidak berhak mengunduh rapor ini.", { status: 403 });

  return (
    <main className="dokumen-wrap">
      <GayaDokumen />
      <div className="aksi">
        <a href="/akademik">Kembali</a>
        <TombolCetak />
      </div>
      <div className="lembar">
        <div className="baris">
          <div>
            <div className="merek">BALITA CENTER</div>
            <div className="cabang">Montessori &amp; Childcare — Cabang {r.branch_name}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="judul">RAPOR PERKEMBANGAN</div>
            <div className="sub">{r.cycle_name || "Siklus belajar"}</div>
          </div>
        </div>

        <div className="kotak" style={{ gridTemplateColumns: "1.2fr 1fr 1fr" }}>
          <div><span>Nama Anak</span><strong>{r.child_name}</strong></div>
          <div><span>Kelas</span><strong>{r.class_name || "—"}</strong></div>
          <div><span>Periode</span><strong>
            {r.start_date ? `${tanggalPanjang(String(r.start_date))} – ${tanggalPanjang(String(r.end_date))}` : "—"}
          </strong></div>
        </div>

        {ASPEK.map(([kunci, label]) => {
          const isi = r[kunci];
          if (!isi) return null;
          return (
            <div key={kunci}>
              <h3>{label}</h3>
              <p className="catatan" style={{ whiteSpace: "pre-wrap" }}>{String(isi)}</p>
            </div>
          );
        })}

        <div className="tanda">
          <div><div className="sub">Guru Kelas,</div><div className="nama">{r.guru || "________________"}</div></div>
          <div><div className="sub">Kepala Sekolah,</div><div className="nama">________________</div></div>
        </div>

        <div className="kaki">
          {r.published_on ? `Diterbitkan ${tanggalPanjang(String(r.published_on))}. ` : ""}
          Rapor disusun oleh guru kelas. Catatan analisa internal tidak termasuk dalam dokumen ini.
        </div>
      </div>
    </main>
  );
}
