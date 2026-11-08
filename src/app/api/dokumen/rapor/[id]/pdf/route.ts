import { readFile } from "node:fs/promises";
import path from "node:path";
import { query } from "@/lib/db";
import { currentUser, hasPermission } from "@/lib/current-user";
import { buatPdfRapor } from "@/lib/pdf/rapor";
import { getIdentitas, kopLengkap } from "@/lib/sekolah";
import { KOLOM_NARASI, agregatRapor } from "@/lib/rapor";

export const dynamic = "force-dynamic";

// Berkas PDF rapor periodik (dihasilkan server). Halaman web tetap bentuk
// kanonis; PDF adalah unduhan dengan susunan yang sama.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return new Response("Silakan login.", { status: 401 });

  const rows = await query<Record<string, string | null> & { child_id: string; cycle_start: string; cycle_end: string }>(
    `SELECT cr.*, c.full_name AS child_name, b.name AS branch_name,
            lc.theme AS cycle_theme, lc.start_date::text AS cycle_start, lc.end_date::text AS cycle_end,
            s.full_name AS teacher_name, s.signature_url AS teacher_ttd,
            (SELECT cl.name FROM enrollments e JOIN classes cl ON cl.id = e.class_id
              WHERE e.child_id = c.id AND e.status = 'aktif'
              ORDER BY e.start_date DESC NULLS LAST LIMIT 1) AS class_name
       FROM cycle_reports cr
       JOIN children c ON c.id = cr.child_id
       JOIN branches b ON b.id = cr.branch_id
       JOIN learning_cycles lc ON lc.id = cr.cycle_id
       LEFT JOIN staff s ON s.id = cr.created_by
      WHERE cr.id = $1::uuid`,
    [params.id]
  );
  const r = rows[0];
  if (!r) return new Response("Rapor tidak ditemukan.", { status: 404 });
  if (r.status !== "published") return new Response("Rapor belum diterbitkan.", { status: 404 });

  let boleh = hasPermission(user, "reports.view") || user.roles.includes("super_admin");
  if (!boleh) {
    const wali = await query<{ n: string }>(
      `SELECT count(*) AS n FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
        WHERE cg.child_id = $1::uuid AND lower(g.email) = lower($2)`,
      [r.child_id, user.email]
    );
    boleh = Number(wali[0]?.n || 0) > 0;
  }
  if (!boleh) return new Response("Anda tidak berhak mengunduh rapor ini.", { status: 403 });

  const agregat = await agregatRapor(r.child_id, r.cycle_start, r.cycle_end, params.id);

  // Foto dokumentasi ikut masuk PDF bila bisa dimuat; untuk video yang masuk
  // adalah gambar sampulnya (poster). Satu berkas gagal tidak menggagalkan
  // seluruh dokumen.
  const asal = new URL(request.url).origin;
  const fotoBuffers: Array<Buffer | null> = await Promise.all(
    agregat.foto.map(async (f) => {
      const sumber = f.media_type === "video" ? f.poster_url : f.url;
      if (!sumber) return null;
      try {
        const lokal = !sumber.startsWith("http");
        const url = lokal ? `${asal}${sumber}` : sumber;
        // Foto lokal tersimpan di balik login: teruskan cookie sesi peminta.
        const respon = await fetch(url, lokal ? { headers: { cookie: request.headers.get("cookie") || "" } } : undefined);
        if (!respon.ok) return null;
        return Buffer.from(await respon.arrayBuffer());
      } catch {
        return null;
      }
    })
  );

  const narratives: Record<string, string | null> = {};
  for (const k of KOLOM_NARASI) narratives[k] = r[k] ? String(r[k]) : null;

  const banner = await readFile(path.join(process.cwd(), "public/ilustrasi/sampul-rapor.jpg")).catch(() => null);
  const identitasRapor = await getIdentitas();
  const logo = await (async () => {
    const url = identitasRapor.logo_url;
    if (!url) return null;
    try {
      const asal = new URL(request.url).origin;
      const lokal = !url.startsWith("http");
      const respon = await fetch(lokal ? `${asal}${url}` : url, lokal ? { headers: { cookie: request.headers.get("cookie") || "" } } : undefined);
      if (!respon.ok) return null;
      return Buffer.from(await respon.arrayBuffer());
    } catch { return null; }
  })();
  const ttd = await (async () => {
    const url = (r as Record<string, unknown>).teacher_ttd as string | null;
    if (!url) return null;
    try {
      const asal = new URL(request.url).origin;
      const lokal = !url.startsWith("http");
      const respon = await fetch(lokal ? `${asal}${url}` : url, lokal ? { headers: { cookie: request.headers.get("cookie") || "" } } : undefined);
      if (!respon.ok) return null;
      return Buffer.from(await respon.arrayBuffer());
    } catch { return null; }
  })();
  const ilustrasi = await readFile(path.join(process.cwd(), "public/ilustrasi/sampul-laporan.jpg")).catch(() => null);
  const doc = buatPdfRapor({
    child_name: String(r.child_name),
    class_name: r.class_name ? String(r.class_name) : null,
    branch_name: String(r.branch_name),
    cycle_theme: String(r.cycle_theme),
    cycle_start: r.cycle_start,
    cycle_end: r.cycle_end,
    teacher: r.teacher_name ? String(r.teacher_name) : null,
    status: String(r.status),
    narratives,
    agregat,
    photos: fotoBuffers,
    sekolah_kop: kopLengkap(identitasRapor),
    banner,
    ilustrasi,
    ttd,
    logo,
  });

  const potongan: Buffer[] = [];
  const selesai = new Promise<Buffer>((resolve) => {
    doc.on("data", (c: Buffer) => potongan.push(c));
    doc.on("end", () => resolve(Buffer.concat(potongan)));
  });
  doc.end();
  const pdf = await selesai;

  const nama = String(r.child_name).replace(/[^\w\-]+/g, "-");
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Rapor-${nama}.pdf"`,
      "Content-Length": String(pdf.length),
    },
  });
}
