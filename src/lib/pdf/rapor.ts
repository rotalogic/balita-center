import PDFDocument from "pdfkit";
import { NARASI_MONTESSORI, NARASI_STPPA, labelGizi, type AgregatRapor } from "../rapor-data";

// PDF rapor periodik: susunan mengikuti halaman web rapor
// (components/rapor-web.tsx) dan rapor portal lama — judul bagian marun,
// kartu narasi berbingkai, kotak Kesimpulan/Saran krem berpalang emas,
// Dokumentasi Kegiatan, dan dua panel Ringkasan.
type Data = {
  child_name: string; class_name: string | null; branch_name: string;
  cycle_theme: string; cycle_start: string; cycle_end: string;
  teacher: string | null; status: string;
  narratives: Record<string, string | null>;
  agregat: AgregatRapor;
  photos?: Array<Buffer | null>; // sejajar agregat.foto
};

const MARUN = "#7a1f3d";
const TINTA = "#232a31";
const GELAP = "#191d22";
const ABU = "#77828e";
const PANEL = "#faf7f2";
const KREM = "#fdfbf1";
const EMAS = "#d9a92c";
const GARIS = "#e3e7ec";

const tgl = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })
    .format(new Date(`${String(iso).slice(0, 10)}T00:00:00+07:00`));

const angka = (v: string | null, satuan: string) =>
  v === null || v === undefined || v === "" ? `- ${satuan}` : `${Number(v).toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${satuan}`;

// Dimensi gambar dari buffer (PNG/JPEG) tanpa dependensi tambahan.
function ukuranGambar(b: Buffer): { w: number; h: number } | null {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) {
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const penanda = b[i + 1];
      if (penanda >= 0xc0 && penanda <= 0xc3) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

export function buatPdfRapor(d: Data): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `Rapor-${d.child_name}-${d.cycle_theme}` } });
  const kiri = 40;
  const lebar = doc.page.width - 80;
  const bawah = doc.page.height - 44;
  let y = 40;

  const pastikan = (butuh: number) => { if (y + butuh > bawah) { doc.addPage(); y = 40; } };
  const tinggi = (teks: string, font: string, ukuran: number, w: number) => {
    doc.font(font).fontSize(ukuran);
    return doc.heightOfString(teks, { width: w, lineGap: 1.5 });
  };

  const judulSeksi = (teks: string) => {
    pastikan(30);
    doc.font("Helvetica-Bold").fontSize(12.5).fillColor(MARUN).text(teks, kiri, y, { width: lebar });
    y += 17;
    doc.moveTo(kiri, y).lineTo(kiri + lebar, y).lineWidth(0.7).strokeColor("#e8dde2").stroke();
    y += 10;
  };

  const kartuNarasi = (judul: string, isi: string) => {
    const wTeks = lebar - 28;
    const h = 14 + tinggi(isi, "Helvetica", 9.8, wTeks) + 16;
    pastikan(Math.min(h, 190));
    const yAwal = y;
    doc.roundedRect(kiri, yAwal, lebar, h, 7).fillAndStroke("#ffffff", GARIS);
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(GELAP).text(judul, kiri + 14, yAwal + 9, { width: wTeks });
    doc.font("Helvetica").fontSize(9.8).fillColor("#3c454e").text(isi, kiri + 14, yAwal + 26, { width: wTeks, lineGap: 1.5 });
    y = yAwal + h + 10;
  };

  const kotakKrem = (isi: string) => {
    const wTeks = lebar - 28;
    const h = tinggi(isi, "Helvetica", 9.8, wTeks) + 20;
    pastikan(Math.min(h, 190));
    const yAwal = y;
    doc.roundedRect(kiri, yAwal, lebar, h, 5).fill(KREM);
    doc.rect(kiri, yAwal + 3, 4, h - 6).fill(EMAS);
    doc.font("Helvetica").fontSize(9.8).fillColor("#2f353c").text(isi, kiri + 14, yAwal + 10, { width: wTeks, lineGap: 1.5 });
    y = yAwal + h + 4;
  };

  // ---------- Kepala ----------
  doc.font("Helvetica-Bold").fontSize(9).fillColor(ABU).text("BALITA CENTER — MONTESSORI & CHILDCARE", kiri, y, { width: lebar, characterSpacing: 1 });
  y += 14;
  doc.font("Helvetica-Bold").fontSize(19).fillColor(GELAP).text("Rapor Perkembangan", kiri, y, { width: lebar });
  y += 24;
  const barisIdent: Array<[string, string]> = [
    ["Nama Anak", d.child_name],
    ["Kelas", d.class_name || "—"],
    ["Siklus", d.cycle_theme],
    ["Periode", `${tgl(d.cycle_start)} – ${tgl(d.cycle_end)}`],
    ["Cabang", d.branch_name],
  ];
  const hIdent = barisIdent.length * 14 + 16;
  doc.roundedRect(kiri, y, lebar, hIdent, 8).fill(PANEL);
  let yi = y + 8;
  for (const [k, v] of barisIdent) {
    doc.font("Helvetica").fontSize(9.5).fillColor("#4a545e").text(k, kiri + 14, yi, { width: 70 });
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(GELAP).text(v, kiri + 90, yi, { width: lebar - 104 });
    yi += 14;
  }
  y += hIdent + 20;

  // ---------- Narasi ----------
  const stppa = NARASI_STPPA.filter(([k]) => d.narratives[k]);
  if (stppa.length) {
    judulSeksi("Aspek Perkembangan (STPPA)");
    for (const [k, label] of stppa) kartuNarasi(label, String(d.narratives[k]));
  }
  const montessori = NARASI_MONTESSORI.filter(([k]) => d.narratives[k]);
  if (montessori.length) {
    judulSeksi("Area Montessori");
    for (const [k, label] of montessori) kartuNarasi(label, String(d.narratives[k]));
  }
  if (d.narratives.conclusion) { judulSeksi("Kesimpulan"); kotakKrem(String(d.narratives.conclusion)); }
  if (d.narratives.parent_suggestion) { judulSeksi("Saran untuk Orang Tua"); kotakKrem(String(d.narratives.parent_suggestion)); }

  // ---------- Dokumentasi ----------
  const foto = (d.photos || []).map((b, i) => {
    const asal = d.agregat.foto[i];
    // Di PDF, video tampil sebagai gambar sampulnya dengan penanda video.
    const caption = asal?.media_type === "video"
      ? `${asal.caption || "Video kegiatan"} · Video — tonton di versi web`
      : asal?.caption || null;
    return { b, caption };
  }).filter((f) => f.b);
  if (foto.length) {
    judulSeksi("Dokumentasi Kegiatan");
    const celah = 8;
    const wSel = (lebar - celah * 2) / 3;
    const hFoto = 96;
    for (let awal = 0; awal < foto.length; awal += 3) {
      pastikan(hFoto + 38);
      const yBaris = y;
      foto.slice(awal, awal + 3).forEach((f, j) => {
        const x = kiri + j * (wSel + celah);
        try {
          // Potong manual dengan klip: opsi cover pdfkit tidak selalu memotong.
          const ukuran = ukuranGambar(f.b as Buffer);
          if (!ukuran) { doc.image(f.b as Buffer, x, yBaris, { width: wSel, height: hFoto }); return; }
          const skala = Math.max(wSel / ukuran.w, hFoto / ukuran.h);
          const wG = ukuran.w * skala;
          const hG = ukuran.h * skala;
          doc.save();
          doc.rect(x, yBaris, wSel, hFoto).clip();
          doc.image(f.b as Buffer, x + (wSel - wG) / 2, yBaris + (hFoto - hG) / 2, { width: wG, height: hG });
          doc.restore();
        } catch { return; }
        if (f.caption) {
          doc.font("Helvetica").fontSize(7.5).fillColor(ABU).text(f.caption, x, yBaris + hFoto + 3, { width: wSel, height: 12, ellipsis: true });
        }
      });
      y = yBaris + hFoto + 32;
    }
  }

  // ---------- Ringkasan ----------
  judulSeksi("Ringkasan Kehadiran & Tumbuh Kembang");
  const a = d.agregat;
  const wPanel = (lebar - 10) / 2;
  const barisKiri: Array<[string, string]> = [
    ["Hadir", `${a.hadir} hari`], ["Izin", `${a.izin} hari`], ["Sakit", `${a.sakit} hari`],
    ["Tanpa Keterangan", `${a.tanpa_keterangan} hari`],
    ["Hari sekolah pada periode ini", `${a.hari_sekolah} hari`],
    ["Tanpa catatan", `${a.tanpa_catatan} hari`],
    ["Catatan Harian", `${a.catatan_harian} laporan`],
  ];
  const barisKanan: Array<[string, string]> = [
    ["Berat Badan", angka(a.berat_kg, "kg")],
    ["Tinggi Badan", angka(a.tinggi_cm, "cm")],
    ["Lingkar Kepala", angka(a.lingkar_kepala_cm, "cm")],
    ["Status Gizi", labelGizi(a.status_gizi)],
  ];
  const catatanKiri = "Hari tanpa catatan berarti sistem tidak menerima presensi pada hari itu — bukan berarti ananda tidak hadir.";
  const hPanel = 22 + Math.max(barisKiri.length, barisKanan.length) * 13.5 + tinggi(catatanKiri, "Helvetica", 7.8, wPanel - 24) + 22;
  pastikan(hPanel + 6);
  const yPanel = y;
  const gambarPanel = (x: number, judul: string, baris: Array<[string, string]>, catatan?: string) => {
    doc.roundedRect(x, yPanel, wPanel, hPanel, 9).fill(PANEL);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MARUN).text(judul, x + 12, yPanel + 10, { width: wPanel - 24, characterSpacing: 0.5 });
    let yy = yPanel + 26;
    for (const [k, v] of baris) {
      doc.font("Helvetica").fontSize(9).fillColor("#4a545e").text(k, x + 12, yy, { width: wPanel - 90 });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(GELAP).text(v, x + wPanel - 76, yy, { width: 64, align: "right" });
      yy += 13.5;
    }
    if (catatan) doc.font("Helvetica").fontSize(7.8).fillColor(ABU).text(catatan, x + 12, yy + 4, { width: wPanel - 24, lineGap: 1.5 });
    if (a.tanggal_ukur && judul.includes("TUMBUH")) {
      doc.font("Helvetica").fontSize(7.8).fillColor(ABU).text(`Pengukuran terakhir: ${tgl(a.tanggal_ukur)}`, x + 12, yy + 4, { width: wPanel - 24 });
    }
  };
  gambarPanel(kiri, "REKAP PRESENSI", barisKiri, catatanKiri);
  gambarPanel(kiri + wPanel + 10, "TUMBUH KEMBANG TERKINI", barisKanan);
  y = yPanel + hPanel + 16;

  // ---------- Kaki ----------
  const guru = d.teacher || "Guru kelas";
  doc.moveTo(kiri, y).lineTo(kiri + lebar, y).lineWidth(0.7).strokeColor("#edf0f3").stroke();
  y += 9;
  doc.font("Helvetica").fontSize(9.5).fillColor("#5b656f").text(`Dilaporkan oleh: ${guru}`, kiri, y, { width: lebar });
  y += 14;
  doc.fontSize(8).fillColor(ABU).text("Dokumen dibuat otomatis dari data Balita Center. Rapor disusun dan disetujui oleh guru kelas; analisa internal tidak termasuk dalam dokumen ini.", kiri, y, { width: lebar });

  return doc;
}
