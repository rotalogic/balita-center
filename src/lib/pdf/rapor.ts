import PDFDocument from "pdfkit";
import {
  LABEL_TAHAP_INGGRIS, NARASI_ATENSI, NARASI_INGGRIS, NARASI_ISLAM_ARAB,
  NARASI_MONTESSORI, NARASI_PERKEMBANGAN, NARASI_STPPA, labelGizi, type AgregatRapor,
} from "../rapor-data";

// PDF rapor periodik: susunan mengikuti halaman web rapor
// (components/rapor-web.tsx) dan rapor portal lama — judul bagian marun,
// kartu narasi berbingkai, kotak Kesimpulan/Saran krem berpalang emas,
// Dokumentasi Kegiatan, dan dua panel Ringkasan.
type Data = {
  child_name: string; class_name: string | null; branch_name: string;
  cycle_theme: string; cycle_start: string; cycle_end: string;
  teacher: string | null; status: string;
  narratives: Record<string, string | null>;
  inggris_tahap?: number | null;
  child_photo?: Buffer | null; folder_dokumentasi?: string | null;
  tanggapan_ortu?: string | null;
  agregat: AgregatRapor;
  photos?: Array<Buffer | null>; // sejajar agregat.foto
  sekolah_kop?: string; // baris kop dari identitas sekolah, mis. "BALITA CENTER — MONTESSORI & CHILDCARE"
  kop_baris?: [string, string, string]; // kop resmi tiga baris (yayasan, nama gabungan, tagline gabungan)
  logo?: Buffer | null; // logo sekolah dari identitas (digambar di kepala dokumen)
  pratinjau?: boolean; // true untuk draf: pita penanda DRAF digambar mencolok
  ttd?: Buffer | null; // tanda tangan digital guru pembuat rapor
  banner?: Buffer | null; // ilustrasi sampul rapor (public/ilustrasi/sampul-rapor.jpg)
  ilustrasi?: Buffer | null; // pengisi Dokumentasi bila belum ada foto (sampul-laporan.jpg)
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
  let geserLogo = 0;
  if (d.logo) {
    try {
      doc.image(d.logo, kiri, y - 2, { fit: [104, 38] });
      geserLogo = 116;
    } catch { /* logo gagal dimuat — kop teks tetap tampil */ }
  }
  if (d.kop_baris) {
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(ABU).text(d.kop_baris[0].toUpperCase(), kiri + geserLogo, y, { width: lebar - geserLogo, characterSpacing: 1 });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(GELAP).text(d.kop_baris[1], kiri + geserLogo, y + 10, { width: lebar - geserLogo });
    doc.font("Helvetica").fontSize(7.5).fillColor(ABU).text(d.kop_baris[2], kiri + geserLogo, y + 25, { width: lebar - geserLogo });
    y += 38;
  } else {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(ABU).text((d.sekolah_kop || "BALITA CENTER — MONTESSORI & CHILDCARE").toUpperCase(), kiri + geserLogo, y, { width: lebar - geserLogo, characterSpacing: 1 });
    y += 14;
  }
  doc.font("Helvetica-Bold").fontSize(19).fillColor(GELAP).text("Rapor Perkembangan", kiri + geserLogo, y, { width: lebar - geserLogo });
  y += 24;
  const barisIdent: Array<[string, string]> = [
    ["Nama Anak", d.child_name],
    ["Kelas", d.class_name || "—"],
    ["Siklus", d.cycle_theme],
    ["Periode", `${tgl(d.cycle_start)} – ${tgl(d.cycle_end)}`],
    ["Cabang", d.branch_name],
    ...(d.folder_dokumentasi ? [["Folder Dokumentasi", d.folder_dokumentasi] as [string, string]] : []),
  ];
  const hIdent = barisIdent.length * 14 + 16;
  doc.roundedRect(kiri, y, lebar, hIdent, 8).fill(PANEL);
  let yi = y + 8;
  for (const [k, v] of barisIdent) {
    doc.font("Helvetica").fontSize(9.5).fillColor("#4a545e").text(k, kiri + 14, yi, { width: 110 });
    if (k === "Folder Dokumentasi") {
      doc.font("Helvetica").fontSize(8.5).fillColor("#15608a").text(v, kiri + 130, yi, { width: lebar - 144, link: v, underline: true });
    } else {
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(GELAP).text(v, kiri + 130, yi, { width: lebar - 144 });
    }
    yi += 14;
  }
  if (d.child_photo) {
    doc.save();
    doc.roundedRect(kiri + lebar - 66, y + 8, 54, 54, 8).clip();
    try { doc.image(d.child_photo, kiri + lebar - 66, y + 8, { width: 54, height: 54 }); } catch { /* abaikan */ }
    doc.restore();
  }
  y += hIdent + 20;

  if (d.pratinjau) {
    doc.save();
    doc.roundedRect(kiri, y - 8, lebar, 19, 5).fill("#b3261e");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9)
      .text("PRATINJAU DRAF — dokumen ini belum diterbitkan dan bukan dokumen resmi", kiri, y - 3, { width: lebar, align: "center", characterSpacing: 0.6 });
    doc.restore();
    y += 20;
  }

  if (d.banner) {
    try {
      pastikan(120);
      doc.save();
      doc.roundedRect(kiri, y, lebar, 104, 10).clip();
      doc.image(d.banner, kiri, y, { cover: [lebar, 104], align: "center", valign: "center" });
      doc.restore();
      y += 104 + 14;
    } catch {
      /* ilustrasi gagal dimuat — rapor tetap terbit tanpa gambar */
    }
  }

  // ---------- Narasi ----------
  // ---------- Ringkasan pembuka ----------
  if (d.narratives.ringkasan_ortu) {
    judulSeksi("Ringkasan untuk Orang Tua");
    kotakKrem(String(d.narratives.ringkasan_ortu));
    y += 6;
  }

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
  const perkembanganPdf = NARASI_PERKEMBANGAN.filter(([k]) => d.narratives[k]);
  if (perkembanganPdf.length) {
    judulSeksi("Catatan Perkembangan");
    for (const [k, label] of perkembanganPdf) kartuNarasi(label, String(d.narratives[k]));
  }
  const ekstraPdf: Array<[string, string]> = [
    ["narrative_kelekatan", "Keterangan Kelekatan"],
    ["narrative_tema", "Observasi dari Tema Mingguan"],
    ["profil_cara_belajar", "Profil Cara Belajar"],
  ];
  const ekstraIsi = ekstraPdf.filter(([k]) => d.narratives[k]);
  if (ekstraIsi.length) {
    judulSeksi("Kelekatan, Tema & Cara Belajar");
    for (const [k, label] of ekstraIsi) kartuNarasi(label, String(d.narratives[k]));
  }
  const inggrisPdf = NARASI_INGGRIS.filter(([k]) => d.narratives[k]);
  if (inggrisPdf.length || d.inggris_tahap) {
    judulSeksi("Bahasa Inggris");
    if (d.inggris_tahap) {
      pastikan(16);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(GELAP)
        .text(`Posisi anak: ${LABEL_TAHAP_INGGRIS[d.inggris_tahap] || `Tahap ${d.inggris_tahap}`}`, kiri, y, { width: lebar });
      y += 16;
    }
    for (const [k, label] of inggrisPdf) kartuNarasi(label, String(d.narratives[k]));
  }
  const islamPdf = NARASI_ISLAM_ARAB.filter(([k]) => d.narratives[k]);
  if (islamPdf.length) {
    judulSeksi("Kehidupan Islam & Bahasa Arab");
    for (const [k, label] of islamPdf) kartuNarasi(label, String(d.narratives[k]));
  }
  const atensiPdf = NARASI_ATENSI.filter(([k]) => d.narratives[k]);
  if (atensiPdf.length) {
    judulSeksi("Atensi & Konsentrasi");
    for (const [k, label] of atensiPdf) kartuNarasi(label, String(d.narratives[k]));
  }

  if (d.narratives.conclusion) { judulSeksi("Kesimpulan"); kotakKrem(String(d.narratives.conclusion)); }
  if (d.narratives.parent_suggestion) { judulSeksi("Saran untuk Orang Tua"); kotakKrem(String(d.narratives.parent_suggestion)); }
  if (d.narratives.tips_pola_asuh) { judulSeksi("Tips Pola Asuh di Rumah"); kotakKrem(String(d.narratives.tips_pola_asuh)); }

  // ---------- Dokumentasi ----------
  const foto = (d.photos || []).map((b, i) => {
    const asal = d.agregat.foto[i];
    // Di PDF, video tampil sebagai gambar sampulnya dengan penanda video.
    const caption = asal?.media_type === "video"
      ? `${asal.caption || "Video kegiatan"} · Video — tonton di versi web`
      : asal?.caption || null;
    return { b, caption };
  }).filter((f) => f.b);
  if (!foto.length && d.ilustrasi) {
    judulSeksi("Dokumentasi Kegiatan");
    try {
      pastikan(150);
      doc.save();
      doc.roundedRect(kiri, y, lebar, 120, 8).clip();
      doc.image(d.ilustrasi, kiri, y, { cover: [lebar, 120], align: "center", valign: "center" });
      doc.restore();
      y += 126;
      doc.font("Helvetica").fontSize(8.5).fillColor(ABU)
        .text("Ilustrasi — dokumentasi foto belum ditambahkan guru pada siklus ini.", kiri, y, { width: lebar });
      y += 14;
    } catch {
      /* lewati */
    }
  }
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

  // ---------- Pertumbuhan Fisik (diagram dari titik ukur anak sendiri) ----------
  const diagramPdf = (judul: string, satuan: string, warna: string, titik: Array<{ tanggal: string; nilai: number }>) => {
    if (titik.length === 0) return;
    const hChart = 92;
    pastikan(hChart + 30);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(GELAP).text(`${judul} (${satuan})`, kiri, y, { width: lebar });
    y += 14;
    const x0 = kiri + 32, x1 = kiri + lebar - 8;
    const yAtas = y + 10, yBawah = y + hChart - 16;
    const vals = titik.map((t) => t.nilai);
    let mn = Math.min(...vals);
    let mx = Math.max(...vals);
    if (mn === mx) { mn -= 1; mx += 1; }
    const padN = (mx - mn) * 0.15;
    mn -= padN;
    mx += padN;
    const X = (i: number) => (titik.length === 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (titik.length - 1));
    const Y = (v: number) => yAtas + (1 - (v - mn) / (mx - mn)) * (yBawah - yAtas);
    doc.font("Helvetica").fontSize(7.5).fillColor(ABU);
    doc.text(mx.toFixed(1), kiri, yAtas - 3, { width: 28, align: "right" });
    doc.text(mn.toFixed(1), kiri, yBawah - 3, { width: 28, align: "right" });
    if (titik.length > 1) {
      doc.moveTo(X(0), Y(titik[0].nilai));
      for (let i = 1; i < titik.length; i++) doc.lineTo(X(i), Y(titik[i].nilai));
      doc.lineWidth(1.4).strokeColor(warna).stroke();
    }
    for (let i = 0; i < titik.length; i++) {
      doc.circle(X(i), Y(titik[i].nilai), 2.6).fill(warna);
      doc.font("Helvetica").fontSize(7.5).fillColor(TINTA)
        .text(String(titik[i].nilai).replace(".", ","), X(i) - 14, Y(titik[i].nilai) - 12, { width: 28, align: "center" });
    }
    y = yBawah + 16;
  };

  judulSeksi("Pertumbuhan Fisik");
  if (d.agregat.pengukuran.length === 0) {
    pastikan(16);
    doc.font("Helvetica").fontSize(9.8).fillColor("#3c454e")
      .text("Belum ada data pengukuran berat dan tinggi badan anak sampai akhir periode ini. Bagian ini terisi otomatis dari titik pengukuran anak sendiri — tanpa garis acuan dan tanpa penilaian medis.", kiri, y, { width: lebar, lineGap: 1.5 });
    y += 30;
  } else {
    diagramPdf("Berat Badan", "kg", "#b3541e",
      d.agregat.pengukuran.filter((p) => p.berat_kg !== null).map((p) => ({ tanggal: p.tanggal, nilai: p.berat_kg as number })));
    diagramPdf("Tinggi Badan", "cm", "#4F7A54",
      d.agregat.pengukuran.filter((p) => p.tinggi_cm !== null).map((p) => ({ tanggal: p.tanggal, nilai: p.tinggi_cm as number })));
    if (d.agregat.pengukuran.length === 1) {
      doc.font("Helvetica").fontSize(8.5).fillColor(ABU)
        .text("Baru satu titik pengukuran tercatat — garis pertumbuhan tergambar sesudah pengukuran berikutnya.", kiri, y, { width: lebar });
      y += 14;
    }
  }
  if (d.narratives.narasi_pertumbuhan) kotakKrem(String(d.narratives.narasi_pertumbuhan));

  if (d.tanggapan_ortu) {
    judulSeksi("Tanggapan & Masukan Orang Tua");
    kotakKrem(d.tanggapan_ortu);
  }

  // ---------- Kaki ----------
  const guru = d.teacher || "Guru kelas";
  doc.moveTo(kiri, y).lineTo(kiri + lebar, y).lineWidth(0.7).strokeColor("#edf0f3").stroke();
  y += 9;
  doc.font("Helvetica").fontSize(9.5).fillColor("#5b656f").text(`Dilaporkan oleh: ${guru}`, kiri, y, { width: lebar - 170 });
  if (d.ttd) {
    try {
      doc.image(d.ttd, kiri + lebar - 118, y - 6, { fit: [110, 30], align: "right" });
      doc.fontSize(7).fillColor(ABU).text("Tanda tangan digital guru", kiri + lebar - 118, y + 25, { width: 110, align: "right" });
    } catch { /* tanda tangan gagal dimuat — dokumen tetap terbit */ }
  }
  y += 14;
  doc.fontSize(8).fillColor(ABU).text("Dokumen dibuat otomatis dari data Balita Center. Rapor disusun dan disetujui oleh guru kelas; analisa internal tidak termasuk dalam dokumen ini.", kiri, y, { width: lebar });

  return doc;
}
