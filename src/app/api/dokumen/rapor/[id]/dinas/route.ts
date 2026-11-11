import { query } from "@/lib/db";
import { currentUser, hasPermission } from "@/lib/current-user";
import { tanggalPanjang } from "@/lib/format";
import { agregatRapor } from "@/lib/rapor";
import { getIdentitas, kopTigaBaris } from "@/lib/sekolah";

export const dynamic = "force-dynamic";

// Rapor Dinas Pendidikan (SAM): keluaran terpisah mengikuti rapor resmi PAUD
// Kurikulum Merdeka, dihasilkan dari data observasi SAM yang sama dengan
// laporan orang tua. Disiapkan untuk kebutuhan Dinas Pendidikan mengikuti
// proses perizinan yang berjalan — tidak tampil di Portal Orang Tua dan tidak
// mengubah laporan SAM untuk orang tua dalam bentuk apa pun.
const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const gabung = (...bagian: Array<string | null | undefined>) => {
  const isi = bagian.map((b) => (b || "").trim()).filter(Boolean);
  return isi.length ? isi.join("\n\n") : "Belum ada catatan pada elemen ini untuk periode ini.";
};

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return new Response("Belum masuk.", { status: 401 });
  if (!hasPermission(user, "reports.view") && !user.roles.includes("super_admin")) {
    return new Response("Anda tidak berhak membuka Rapor Dinas.", { status: 403 });
  }

  const rows = await query<Record<string, string | null> & { child_id: string; cycle_start: string; cycle_end: string }>(
    `SELECT cr.*, c.full_name AS child_name, c.birth_date::text AS birth_date, c.birth_place,
            c.gender, lc.theme AS cycle_theme, lc.start_date::text AS cycle_start, lc.end_date::text AS cycle_end,
            s.full_name AS teacher_name, s.signature_url AS teacher_ttd, b.name AS branch_name,
            (SELECT cl.name FROM enrollments e JOIN classes cl ON cl.id = e.class_id
              WHERE e.child_id = c.id AND e.status = 'aktif'
              ORDER BY e.start_date DESC NULLS LAST LIMIT 1) AS class_name
       FROM cycle_reports cr
       JOIN children c ON c.id = cr.child_id
       JOIN learning_cycles lc ON lc.id = cr.cycle_id
       JOIN branches b ON b.id = cr.branch_id
       LEFT JOIN staff s ON s.id = cr.created_by
      WHERE cr.id = $1::uuid`,
    [params.id]
  );
  const r = rows[0];
  if (!r) return new Response("Rapor tidak ditemukan.", { status: 404 });

  const agregat = await agregatRapor(r.child_id, r.cycle_start, r.cycle_end, params.id);
  const identitas = await getIdentitas();
  const [kop1, kop2, kop3] = kopTigaBaris(identitas);

  // Pemetaan elemen Kurikulum Merdeka dari data observasi SAM yang sama.
  const elemenAgama = gabung(
    r.narrative_agama_moral,
    r.islam_doa ? `Doa Harian: ${r.islam_doa}` : null,
    r.islam_hadis ? `Hadis Pilihan: ${r.islam_hadis}` : null,
    r.islam_juz30 ? `Pengenalan Juz 30: ${r.islam_juz30}` : null,
    r.islam_hijaiyah ? `Huruf Hijaiyah: ${r.islam_hijaiyah}` : null,
    r.islam_ummi ? `Mengaji Metode Ummi: ${r.islam_ummi}` : null
  );
  const elemenJatiDiri = gabung(
    r.narrative_sosial_emosional,
    r.atensi_durasi ? `Atensi — lama bertahan pada satu pekerjaan: ${r.atensi_durasi}` : null,
    r.atensi_pengulangan ? `Pengulangan yang dipilih: ${r.atensi_pengulangan}` : null,
    r.atensi_siklus ? `Penyelesaian siklus kerja: ${r.atensi_siklus}` : null,
    r.atensi_fokus ? `Kembali fokus sesudah terdistraksi: ${r.atensi_fokus}` : null,
    r.profil_cara_belajar ? `Profil cara belajar: ${r.profil_cara_belajar}` : null
  );
  const elemenSteam = gabung(
    r.narrative_bahasa ? `Bahasa: ${r.narrative_bahasa}` : null,
    r.narrative_mathematics ? `Matematika: ${r.narrative_mathematics}` : null,
    r.narrative_kognitif ? `Kognitif: ${r.narrative_kognitif}` : null,
    r.narrative_sensorial ? `Sensorial: ${r.narrative_sensorial}` : null,
    r.narrative_cultural ? `Budaya: ${r.narrative_cultural}` : null,
    r.narrative_seni ? `Seni: ${r.narrative_seni}` : null
  );

  const paragraf = (teks: string) =>
    teks.split("\n\n").map((p) => `<p>${esc(p)}</p>`).join("");

  const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8" />
<title>RaporDinas-${esc(r.child_name)}-${esc(r.cycle_theme || "")}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: "Times New Roman", Times, serif; color: #111; margin: 0; padding: 24px; background: #eef1f6; }
  .lembar { max-width: 760px; margin: 0 auto; background: #fff; padding: 36px 40px; box-shadow: 0 10px 30px rgba(16,24,40,.08); }
  .kop { text-align: center; border-bottom: 3px double #111; padding-bottom: 10px; }
  .kop .y { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
  .kop .n { font-size: 19px; font-weight: bold; margin: 2px 0; }
  .kop .t { font-size: 12.5px; font-style: italic; }
  h1 { font-size: 16px; text-align: center; margin: 18px 0 2px; text-transform: uppercase; }
  .sub { text-align: center; font-size: 13px; margin: 0 0 14px; }
  .status { border: 1px solid #999; background: #f7f7f7; padding: 8px 12px; font-size: 12.5px; margin-bottom: 16px; }
  table.ident { border-collapse: collapse; margin-bottom: 14px; }
  table.ident td { padding: 2px 14px 2px 0; font-size: 14px; vertical-align: top; }
  h2 { font-size: 14.5px; margin: 16px 0 6px; text-transform: uppercase; }
  p { font-size: 14px; line-height: 1.55; margin: 4px 0; text-align: justify; white-space: pre-wrap; }
  .ttd { display: flex; justify-content: space-between; margin-top: 34px; font-size: 14px; }
  .ttd .kotak { width: 45%; text-align: center; }
  .ttd img { height: 52px; object-fit: contain; }
  .ruang { height: 58px; }
</style></head>
<body><div class="lembar">
  <div class="kop">
    <div class="y">${esc(kop1)}</div>
    <div class="n">${esc(kop2)}</div>
    <div class="t">${esc(kop3)}</div>
  </div>
  <h1>Rapor Peserta Didik Pendidikan Anak Usia Dini</h1>
  <p class="sub">Sekolah Alam Montessori · Kurikulum Merdeka · Periode ${esc(r.cycle_theme || "")} (${tanggalPanjang(r.cycle_start)} – ${tanggalPanjang(r.cycle_end)})</p>
  <div class="status">Dokumen ini <strong>disiapkan untuk kebutuhan Dinas Pendidikan</strong> mengikuti proses perizinan KB/TK SAM yang sedang berjalan. Rapor Dinas dihasilkan dari data observasi yang sama dengan laporan orang tua, tidak tampil di Portal Orang Tua, dan tidak mengubah laporan untuk orang tua.</div>

  <table class="ident">
    <tr><td>Nama Peserta Didik</td><td>: <strong>${esc(r.child_name)}</strong></td></tr>
    <tr><td>Tempat, Tanggal Lahir</td><td>: ${esc(r.birth_place || "-")}, ${r.birth_date ? tanggalPanjang(r.birth_date) : "-"}</td></tr>
    <tr><td>Jenis Kelamin</td><td>: ${esc(r.gender === "L" ? "Laki-laki" : r.gender === "P" ? "Perempuan" : r.gender || "-")}</td></tr>
    <tr><td>Kelompok / Kelas</td><td>: ${esc(r.class_name || "-")}</td></tr>
    <tr><td>Sekolah</td><td>: Sekolah Alam Montessori — ${esc(r.branch_name || "")}</td></tr>
  </table>

  <h2>A. Nilai Agama dan Budi Pekerti</h2>
  ${paragraf(elemenAgama)}
  <h2>B. Jati Diri</h2>
  ${paragraf(elemenJatiDiri)}
  <h2>C. Dasar Literasi, Matematika, Sains, Teknologi, Rekayasa, dan Seni</h2>
  ${paragraf(elemenSteam)}

  <h2>D. Kehadiran dan Pertumbuhan</h2>
  <p>Kehadiran selama periode: hadir ${agregat.hadir} hari, izin ${agregat.izin} hari, sakit ${agregat.sakit} hari, tanpa keterangan ${agregat.tanpa_keterangan} hari, dari ${agregat.hari_sekolah} hari sekolah. Pertumbuhan terakhir (${agregat.tanggal_ukur ? tanggalPanjang(agregat.tanggal_ukur) : "-"}): berat badan ${agregat.berat_kg ?? "-"} kg, tinggi badan ${agregat.tinggi_cm ?? "-"} cm.${r.narasi_pertumbuhan ? ` ${esc(r.narasi_pertumbuhan)}` : ""}</p>

  <h2>E. Catatan Guru</h2>
  ${paragraf(gabung(r.conclusion, r.narrative_gambaran))}

  <div class="ttd">
    <div class="kotak">
      <div>Mengetahui,</div>
      <div>Kepala Sekolah</div>
      <div class="ruang"></div>
      <div>( ______________________ )</div>
    </div>
    <div class="kotak">
      <div>Guru Kelas</div>
      <div class="ruang">${r.teacher_ttd ? `<img src="${esc(r.teacher_ttd)}" alt="Tanda tangan guru" />` : ""}</div>
      <div>( ${esc(r.teacher_name || "______________________")} )</div>
    </div>
  </div>
</div></body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
