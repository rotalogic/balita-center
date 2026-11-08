import PDFDocument from "pdfkit";

// PDF tagihan SPP: isi mengikuti halaman cetak tagihan
// (app/tagihan/[id]/cetak) — nomor, pihak, rincian, total, cara bayar.
// Dipakai sebagai lampiran email tagihan & pengingat ke wali.
export type DataTagihan = {
  invoice_number: string | null;
  status: string;
  description: string | null;
  amount: number;
  period_month: string; // 'YYYY-MM-DD'
  created_on: string; // tanggal terbit
  due_date: string | null;
  child_name: string;
  class_name: string | null;
  guardian_name: string | null;
  branch_name: string;
  branch_city: string | null;
};

const MARUN = "#7a1f3d";
const TINTA = "#232a31";
const ABU = "#77828e";
const PANEL = "#faf7f2";
const GARIS = "#e3e7ec";
const EMAS = "#d9a92c";

const LABEL_STATUS: Record<string, string> = {
  belum_bayar: "Belum Bayar",
  menunggu_konfirmasi: "Menunggu Konfirmasi",
  lunas: "Lunas",
  batal: "Dibatalkan",
};

const tgl = (iso: string | null) =>
  !iso
    ? "—"
    : new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })
        .format(new Date(`${String(iso).slice(0, 10)}T00:00:00+07:00`));

export const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

export function buatPdfTagihan(d: DataTagihan): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `Tagihan-${d.invoice_number || d.child_name}` } });
  const kiri = 40;
  const lebar = doc.page.width - 80;
  let y = 44;

  // Kepala: merek kiri, judul kanan, palang emas di bawahnya.
  doc.fillColor(MARUN).font("Helvetica-Bold").fontSize(17).text("BALITA CENTER", kiri, y);
  doc.fillColor(ABU).font("Helvetica").fontSize(9)
    .text(`Montessori & Childcare — Cabang ${d.branch_name}${d.branch_city ? ` (${d.branch_city})` : ""}`, kiri, y + 21, { width: 300 });
  doc.fillColor(TINTA).font("Helvetica-Bold").fontSize(15)
    .text("TAGIHAN SPP", kiri, y, { width: lebar, align: "right" });
  doc.fillColor(ABU).font("Helvetica").fontSize(9)
    .text("Terkirim otomatis ke wali", kiri, y + 19, { width: lebar, align: "right" });
  y += 40;
  doc.save().fillColor(EMAS).rect(kiri, y, lebar, 2.5).fill().restore();
  y += 16;

  doc.fillColor(TINTA).font("Helvetica").fontSize(10.5)
    .text(`Nomor Tagihan:  `, kiri, y, { continued: true })
    .font("Helvetica-Bold").text(d.invoice_number || "—", { continued: true })
    .font("Helvetica").fillColor(d.status === "lunas" ? "#1d7a4f" : MARUN)
    .text(`    ${LABEL_STATUS[d.status] || d.status}`);
  y += 26;

  // Kotak empat kolom.
  const kotakH = 62;
  doc.save().fillColor(PANEL).roundedRect(kiri, y, lebar, kotakH, 6).fill().restore();
  doc.save().strokeColor(GARIS).roundedRect(kiri, y, lebar, kotakH, 6).stroke().restore();
  const kolW = lebar / 4;
  const sel = (i: number, label: string, nilai: string, sub?: string | null) => {
    const x = kiri + 12 + i * kolW;
    doc.fillColor(ABU).font("Helvetica").fontSize(8).text(label.toUpperCase(), x, y + 10, { width: kolW - 18 });
    doc.fillColor(TINTA).font("Helvetica-Bold").fontSize(10).text(nilai, x, y + 22, { width: kolW - 18 });
    if (sub) doc.fillColor(ABU).font("Helvetica").fontSize(8.5).text(sub, x, y + 37, { width: kolW - 18 });
  };
  sel(0, "Ditagihkan kepada", d.guardian_name || "—", d.child_name ? `Wali dari ${d.child_name}` : null);
  sel(1, "Anak / Kelas", d.child_name, d.class_name);
  sel(2, "Tanggal terbit", tgl(d.created_on));
  sel(3, "Jatuh tempo", tgl(d.due_date));
  y += kotakH + 20;

  // Rincian.
  doc.fillColor(TINTA).font("Helvetica-Bold").fontSize(11.5).text("Rincian", kiri, y);
  y += 18;
  doc.save().strokeColor(GARIS).moveTo(kiri, y).lineTo(kiri + lebar, y).stroke().restore();
  y += 8;
  doc.font("Helvetica").fontSize(10).fillColor(TINTA)
    .text(d.description || `SPP Program — ${tgl(d.period_month)}`, kiri, y, { width: lebar - 130 });
  doc.font("Helvetica-Bold").text(rupiah(d.amount), kiri + lebar - 130, y, { width: 130, align: "right" });
  y += 22;
  doc.save().strokeColor(GARIS).moveTo(kiri, y).lineTo(kiri + lebar, y).stroke().restore();
  y += 10;
  doc.font("Helvetica").fontSize(10.5).fillColor(TINTA).text("Total yang harus dibayar", kiri, y);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(MARUN)
    .text(rupiah(d.amount), kiri + lebar - 160, y - 1, { width: 160, align: "right" });
  y += 32;

  // Cara pembayaran.
  doc.fillColor(TINTA).font("Helvetica-Bold").fontSize(11.5).text("Cara Pembayaran", kiri, y);
  y += 17;
  doc.font("Helvetica").fontSize(9.5).fillColor(TINTA).text(
    `Transfer ke Virtual Account sekolah atau tunai/QRIS di administrasi Cabang ${d.branch_name}. Setelah pembayaran tercatat, kwitansi resmi terbit otomatis dan terkirim ke Balita Connect wali.`,
    kiri, y, { width: lebar, lineGap: 3 }
  );
  y += 34;
  doc.fillColor(ABU).fontSize(9).text(
    "Pengingat otomatis: saat tagihan terbit, 3 hari sebelum jatuh tempo, dan 1 hari setelah jatuh tempo bila belum lunas — berhenti sendiri begitu pembayaran tercatat.",
    kiri, y, { width: lebar, lineGap: 3 }
  );
  y += 40;
  doc.fillColor(ABU).fontSize(8.5).text(
    "Tagihan ini dibuat otomatis oleh aplikasi Balita Center dari tarif program anak. Rincian dapat diperiksa di Balita Connect.",
    kiri, y, { width: lebar }
  );

  return doc;
}

// Muat data tagihan dari database lalu susun buffer PDF-nya.
// Dipakai job tagihan untuk lampiran email.
export async function pdfTagihanBuffer(invoiceId: string): Promise<{ buffer: Buffer; data: DataTagihan } | null> {
  const { query } = await import("../db");
  const rows = await query<DataTagihan & { amount: string }>(
    `SELECT i.invoice_number, i.status, i.description, i.amount::float8 AS amount,
            to_char(i.period_month, 'YYYY-MM-DD') AS period_month,
            to_char(i.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS created_on,
            to_char(i.due_date, 'YYYY-MM-DD') AS due_date,
            c.full_name AS child_name, cl.name AS class_name,
            (SELECT g.full_name FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
              WHERE cg.child_id = c.id ORDER BY cg.is_primary DESC LIMIT 1) AS guardian_name,
            b.name AS branch_name, b.city AS branch_city
       FROM invoices i
       JOIN children c ON c.id = i.child_id
       JOIN branches b ON b.id = i.branch_id
       LEFT JOIN enrollments e ON e.child_id = c.id AND e.status = 'aktif'
       LEFT JOIN classes cl ON cl.id = e.class_id
      WHERE i.id = $1::uuid`,
    [invoiceId]
  );
  if (!rows[0]) return null;
  const data = rows[0];
  const doc = buatPdfTagihan(data);
  const chunks: Buffer[] = [];
  const selesai = new Promise<Buffer>((resolve) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  doc.end();
  return { buffer: await selesai, data };
}
