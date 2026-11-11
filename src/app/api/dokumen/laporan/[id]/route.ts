import { query } from "@/lib/db";
import { currentUser, hasPermission } from "@/lib/current-user";
import { tanggalPanjang, jamRapi } from "@/lib/format";
import { kataSkor } from "@/lib/skala";
import { SEGMEN_ZKC } from "@/lib/segmen";

export const dynamic = "force-dynamic";

// PDF Laporan Anak. Dihasilkan sebagai dokumen HTML siap cetak (Ctrl/Cmd+P →
// Simpan sebagai PDF) dari data laporan yang sama — bukan tangkapan layar.
const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LABEL_ASPEK: Record<string, string> = {
  nilai_agama_moral: "Nilai Agama dan Moral", fisik_motorik: "Fisik Motorik",
  motorik_kasar: "Motorik Kasar", motorik_halus: "Motorik Halus", kognitif: "Kognitif",
  bahasa: "Bahasa", sosial_emosional: "Sosial Emosional", kemandirian: "Kemandirian",
};
const MOOD: Record<string, string> = { ceria: "Ceria", tenang: "Tenang", aktif: "Aktif", lelah: "Lelah", murung: "Murung", rewel: "Rewel" };
const MAKAN: Record<string, string> = { habis: "habis", sebagian: "sebagian", sedikit: "sedikit", tidak_makan: "tidak makan" };
const TIDUR: Record<string, string> = { nyenyak: "nyenyak", gelisah: "gelisah", tidak_tidur: "tidak tidur" };

const kata = (n: number) => kataSkor(n);

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return new Response("Silakan login.", { status: 401 });

  const rows = await query<Record<string, string | number | boolean | null> & { child_id: string }>(
    `SELECT r.id, r.report_date, r.status, r.mood, r.mood_notes, r.meals_text, r.meal_level,
            r.snack_text, r.snack_level, r.nap_start, r.nap_end, r.nap_quality,
            r.toilet_pee_count, r.toilet_poop_count, r.notes,
            to_char(r.published_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI') AS published_at,
            c.id AS child_id, c.full_name AS child_name, cl.name AS class_name, b.name AS branch_name,
            s.full_name AS teacher
       FROM daily_reports r
       JOIN children c ON c.id = r.child_id
       JOIN branches b ON b.id = r.branch_id
       LEFT JOIN classes cl ON cl.id = r.class_id
       LEFT JOIN staff s ON s.id = r.lead_facilitator_id
      WHERE r.id = $1::uuid AND r.deleted_at IS NULL`,
    [params.id]
  );
  const r = rows[0];
  if (!r) return new Response("Laporan tidak ditemukan.", { status: 404 });
  if (r.status !== "published") return new Response("Laporan belum diterbitkan.", { status: 404 });

  // Wali hanya untuk anaknya sendiri — ditegakkan di server, bukan dengan menyembunyikan tombol.
  let boleh = hasPermission(user, "reports.view") || user.roles.includes("super_admin");
  if (!boleh) {
    const wali = await query<{ n: string }>(
      `SELECT count(*) AS n FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
        WHERE cg.child_id = $1::uuid AND lower(g.email) = lower($2)`,
      [r.child_id, user.email]
    );
    boleh = Number(wali[0]?.n || 0) > 0;
  }
  if (!boleh) return new Response("Anda tidak berhak mengunduh laporan ini.", { status: 403 });

  const [aktivitas, foto, aspek, segmenRows] = await Promise.all([
    query<{ activity_time: string | null; title: string; apparatus: string | null; rating: string | null }>(
      `SELECT activity_time, title, apparatus, rating FROM daily_report_activities
        WHERE report_id = $1::uuid ORDER BY sort_order, activity_time NULLS LAST`,
      [params.id]
    ),
    query<{ photo_url: string }>(
      `SELECT photo_url FROM daily_report_photos WHERE report_id = $1::uuid ORDER BY created_at LIMIT 3`,
      [params.id]
    ),
    query<{ aspect: string; achieved: boolean; item: string | null }>(
      `SELECT COALESCE(si.aspect, 'lain') AS aspect, sa.achieved, si.item_text AS item
         FROM stppa_assessments sa
         LEFT JOIN stppa_items si ON si.id = sa.item_id
        WHERE sa.child_id = $1::uuid AND sa.assessed_at::date = $2::date
        ORDER BY si.aspect`,
      [r.child_id, String(r.report_date)]
    ),
    query<{ segmen: string; catatan: string }>(
      "SELECT segmen, catatan FROM daily_report_segments WHERE report_id = $1::uuid",
      [params.id]
    ),
  ]);
  const segmenHtml = SEGMEN_ZKC
    .map((s) => ({ label: s.label, catatan: segmenRows.find((x) => x.segmen === s.kunci)?.catatan || "" }))
    .filter((s) => s.catatan.trim());

  const makan = [r.meals_text, r.meal_level ? MAKAN[String(r.meal_level)] || r.meal_level : null].filter(Boolean).join(" — ");
  const snack = [r.snack_text, r.snack_level ? MAKAN[String(r.snack_level)] || r.snack_level : null].filter(Boolean).join(" — ");
  const tidur = r.nap_start && r.nap_end
    ? `${jamRapi(String(r.nap_start))}–${jamRapi(String(r.nap_end))}${r.nap_quality ? `, ${TIDUR[String(r.nap_quality)] || r.nap_quality}` : ""}`
    : r.nap_quality ? TIDUR[String(r.nap_quality)] || String(r.nap_quality) : "";

  const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8" />
<title>Laporan-${esc(r.child_name)}-${esc(String(r.report_date))}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif; color:#16202e; margin:0; padding:24px; background:#eef1f6; }
  .lembar { max-width:780px; margin:0 auto; background:#fff; border-radius:12px; padding:32px 36px; box-shadow:0 10px 30px rgba(16,24,40,.08); }
  .baris { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; }
  .merek { font-size:13px; letter-spacing:.14em; font-weight:700; color:#3c5a8a; }
  .cabang { font-size:12px; color:#5b6b82; margin-top:2px; }
  .judul { font-size:24px; font-weight:800; margin:0; }
  .sub { font-size:12px; color:#5b6b82; }
  .kotak { display:grid; grid-template-columns:1.2fr 1fr 1fr 1fr; gap:14px; margin:20px 0 6px; padding:16px 0; border-top:1px solid #e6eaf1; border-bottom:1px solid #e6eaf1; }
  .kotak span { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#7a8798; margin-bottom:4px; }
  .kotak strong { font-size:13px; }
  h3 { font-size:12px; margin:22px 0 10px; text-transform:uppercase; letter-spacing:.08em; color:#3c5a8a; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; }
  th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#7a8798; border-bottom:1px solid #e6eaf1; padding:8px 0; }
  td { padding:9px 0; border-bottom:1px solid #f1f4f9; vertical-align:top; }
  .kanan { text-align:right; }
  .catatan { font-size:12.5px; color:#3f4f63; line-height:1.6; }
  ul { margin:0; padding-left:18px; font-size:12.5px; }
  .tanda { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:34px; }
  .tanda .nama { margin-top:44px; font-size:13px; font-weight:600; border-top:1px solid #c9d3e0; padding-top:6px; }
  .kaki { margin-top:26px; padding-top:14px; border-top:1px dashed #dfe5ee; font-size:11px; color:#7a8798; line-height:1.6; }
  .aksi { max-width:780px; margin:0 auto 14px; display:flex; justify-content:flex-end; }
  .aksi button { font:inherit; font-size:13px; padding:8px 14px; border-radius:8px; border:1px solid #2f5d9e; background:#2f5d9e; color:#fff; cursor:pointer; }
  .foto { display:flex; gap:8px; flex-wrap:wrap; }
  .foto img { width:180px; height:135px; object-fit:cover; border-radius:6px; border:1px solid #e6eaf1; }
  @media print { body{background:#fff;padding:0;} .lembar{box-shadow:none;border-radius:0;padding:0;max-width:none;} .aksi{display:none;} }
</style></head>
<body>
  <div class="aksi"><button onclick="window.print()">Cetak / Simpan PDF</button></div>
  <div class="lembar">
    <div class="baris">
      <div><div class="merek">BALITA CENTER</div>
        <div class="cabang">Montessori &amp; Childcare — Cabang ${esc(r.branch_name)}</div></div>
      <div style="text-align:right"><div class="judul">LAPORAN HARIAN ANAK</div>
        <div class="sub">Daily Report — Terbit (Published)</div></div>
    </div>

    <div class="kotak">
      <div><span>Nama Anak</span><strong>${esc(r.child_name)}</strong></div>
      <div><span>Kelas</span><strong>${esc(r.class_name || "—")}</strong></div>
      <div><span>Tanggal</span><strong>${tanggalPanjang(String(r.report_date))}</strong></div>
      <div><span>Guru Kelas</span><strong>${esc(r.teacher || "—")}</strong></div>
    </div>

    ${segmenHtml.length ? `<h3>Jalannya Sesi Hari Ini</h3><ul>
      ${segmenHtml.map((s, i) => `<li><strong>${i + 1}. ${esc(s.label)}</strong> — ${esc(s.catatan)}</li>`).join("")}
    </ul>` : ""}

    ${aktivitas.length ? `<h3>Aktivitas Hari Ini</h3>
    <table><thead><tr><th style="width:70px">Waktu</th><th>Aktivitas</th><th>Aparatus</th><th class="kanan">Penilaian</th></tr></thead><tbody>
      ${aktivitas.map((a) => `<tr><td>${a.activity_time ? jamRapi(String(a.activity_time)) : "—"}</td>
        <td>${esc(a.title)}</td><td>${esc(a.apparatus || "—")}</td>
        <td class="kanan">${kata(Number(a.rating || 0))}</td></tr>`).join("")}
    </tbody></table>` : ""}

    ${aspek.length ? `<h3>Aspek Perkembangan yang Teramati (STPPA)</h3><ul>
      ${aspek.map((a) => `<li><strong>${esc(LABEL_ASPEK[a.aspect] || a.aspect)}</strong> — ${esc(a.item || "")} ${a.achieved ? "(teramati)" : "(belum teramati)"}</li>`).join("")}
    </ul>` : ""}

    <h3>Makan, Tidur &amp; Kesehatan</h3>
    <p class="catatan">
      ${makan ? `Makan siang: ${esc(makan)}. ` : ""}${snack ? `Camilan: ${esc(snack)}. ` : ""}
      ${tidur ? `Tidur siang ${esc(tidur)}. ` : ""}
      ${r.toilet_pee_count !== null ? `Toilet: pipis ${Number(r.toilet_pee_count) || 0}×, BAB ${Number(r.toilet_poop_count) || 0}×. ` : ""}
      ${r.mood ? `Mood hari ini: ${esc(MOOD[String(r.mood)] || r.mood)}.` : ""}
    </p>
    ${r.mood_notes ? `<p class="catatan">${esc(r.mood_notes)}</p>` : ""}

    ${r.notes ? `<h3>Catatan Guru</h3><p class="catatan" style="white-space:pre-wrap">${esc(r.notes)}</p>` : ""}

    ${foto.length ? `<h3>Foto Dokumentasi</h3><div class="foto">
      ${foto.map((f) => `<img src="/api/files/${esc(f.photo_url)}" alt="Dokumentasi kegiatan" />`).join("")}
    </div>` : ""}

    <div class="tanda">
      <div><div class="sub">Guru Kelas,</div><div class="nama">${esc(r.teacher || "________________")}</div></div>
      <div><div class="sub">Mengetahui, Kepala Sekolah</div><div class="nama">________________</div></div>
    </div>

    <div class="kaki">Diterbitkan ${r.published_at ? `${tanggalPanjang(String(r.published_at).slice(0, 10))} pukul ${jamRapi(String(r.published_at))} WIB` : "—"}.
      Dokumen dibuat otomatis dari Daily Report yang telah diterbitkan guru.</div>
  </div>
</body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="Laporan-${String(r.child_name).replace(/\s+/g, "-")}-${String(r.report_date)}.html"`,
    },
  });
}
