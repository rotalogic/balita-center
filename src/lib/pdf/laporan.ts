import PDFDocument from "pdfkit";

// PDF laporan harian: berkas sungguhan dari data laporan (bukan tangkapan layar).
// Susunan dan warnanya mengikuti halaman web laporan (components/laporan-web.tsx)
// dan portal lama sekolah: pita tanggal biru muda + pill mood, kartu aktivitas
// berbintang 1-4 dengan chip area/lokasi/mode, kartu Makan/Tidur/Toilet,
// Catatan Tambahan, Circle Time, Moment Special, Saran di Rumah, kaki pelapor.
type Data = {
  child_name: string; class_name: string | null; branch_name: string; report_date: string;
  teacher: string | null; mood: string | null; meals_text: string | null; meal_level: string | null;
  snack_text: string | null; snack_level: string | null; nap_start: string | null; nap_end: string | null;
  nap_quality: string | null; toilet_pee_count: number | null; toilet_poop_count: number | null;
  notes: string | null; circle_theme: string | null; circle_rating: number | null; circle_notes: string | null;
  special_moment: string | null; home_suggestion: string | null; published_at: string | null;
  activities: Array<{
    title: string; apparatus: string | null; area: string | null; rating: number | null;
    activity_time: string | null; notes: string | null; work_location: string | null; work_mode: string | null;
  }>;
  // Foto aktivitas (buffer gambar) sejajar urutan activities; null bila tidak ada/gagal dimuat.
  photos?: Array<Buffer | null>;
};

const AREA: Record<string, string> = {
  practical_life: "Practical Life", language: "Language", sensorial: "Sensorial",
  mathematics: "Mathematics", cultural: "Cultural", observasi: "Observasi",
};
const LOKASI: Record<string, string> = { lantai: "Lantai", meja: "Meja", alas: "Alas Kerja", alas_kerja: "Alas Kerja" };
const MODE: Record<string, string> = {
  sendiri: "Sendiri", berpasangan: "Berpasangan", kelompok_kecil: "Kelompok Kecil", kelompok_besar: "Kelompok Besar",
};
// Kode mood sesuai batasan database (daily_reports.mood).
const MOOD: Record<string, string> = {
  sedih: "Sad", cemas: "Anxious", biasa: "Calm", ceria: "Happy", sangat_ceria: "Very Happy",
  lelah: "Tired", tenang: "Calm", aktif: "Active", rewel: "Fussy", murung: "Gloomy",
};
const PORSI: Record<string, string> = { tidak: "Tidak makan", sedikit: "Makan sedikit", cukup: "Makan cukup", banyak: "Makan banyak" };
const NAP: Record<string, string> = { buruk: "Tidur kurang nyenyak", cukup: "Tidur cukup", baik: "Tidur nyenyak", sangat_baik: "Tidur sangat nyenyak" };

const W = {
  tinta: "#232a31", gelap: "#191d22", abu: "#77828e", abuMuda: "#e6ebef",
  teal: "#1d7fa8", tealGelap: "#15608a", pita: "#e9f4fb",
  emas: "#f5b81d", emasPudar: "#ccd4db",
  merah: "#cf3365", marun: "#8e2247", ungu: "#5b54c7",
  chipAreaBg: "#fce9ef", chipAreaTx: "#9d2c4a",
  chipLokBg: "#e8f3fa", chipLokTx: "#1d6f9f",
  chipModeBg: "#fbf6df", chipModeTx: "#857017",
  krimBg: "#fdfbf1", krimGaris: "#f2ead2",
  biruBg: "#eff7fc", biruGaris: "#d9ebf6",
  saranBg: "#fdeef1", saranGaris: "#f7d2da",
};

const tgl = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })
    .format(new Date(`${iso.slice(0, 10)}T00:00:00+07:00`));

const jamTitik = (v: string | null) => {
  if (!v) return "";
  const m = String(v).match(/^(\d{1,2})[:.](\d{2})/);
  return m ? `${m[1].padStart(2, "0")}.${m[2]}` : "";
};

// Bintang digambar sebagai jalur vektor: font standar PDF tidak punya glif bintang.
function gambarBintang(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number, terisi: boolean) {
  const titik: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const sudut = -Math.PI / 2 + (i * Math.PI) / 5;
    const jari = i % 2 === 0 ? r : r * 0.45;
    titik.push([cx + jari * Math.cos(sudut), cy + jari * Math.sin(sudut)]);
  }
  doc.save();
  doc.path(titik.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + " Z");
  if (terisi) doc.fill(W.emas); else doc.strokeColor(W.emasPudar).lineWidth(0.8).stroke();
  doc.restore();
}

function barisBintang(doc: PDFKit.PDFDocument, xKanan: number, y: number, n: number, r = 5) {
  const v = Math.max(0, Math.min(4, Math.round(Number(n) || 0)));
  doc.fontSize(8).font("Helvetica").fillColor("#68727d");
  const teksSkor = `${v}/4`;
  const lebarSkor = doc.widthOfString(teksSkor) + 5;
  doc.text(teksSkor, xKanan - lebarSkor, y - 3, { width: lebarSkor, align: "right" });
  const langkah = r * 2 + 3.5;
  for (let i = 0; i < 4; i++) {
    gambarBintang(doc, xKanan - lebarSkor - langkah * (4 - i) + r, y, r, i < v);
  }
  return lebarSkor + langkah * 4;
}

export function buatPdfLaporan(d: Data): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `Laporan-${d.child_name}-${d.report_date}` } });
  const kiri = 40;
  const lebar = doc.page.width - 80;
  const bawah = doc.page.height - 44;
  let y = 40;

  const pastikanRuang = (butuh: number) => {
    if (y + butuh > bawah) {
      doc.addPage();
      y = 40;
    }
  };
  const tinggiTeks = (teks: string, font: string, ukuran: number, w: number) => {
    doc.font(font).fontSize(ukuran);
    return doc.heightOfString(teks, { width: w, lineGap: 1.5 });
  };

  // ---------- Pita kepala ----------
  const moodLabel = d.mood ? MOOD[d.mood] || d.mood : "";
  doc.save();
  doc.roundedRect(kiri, y, lebar, 62, 14).fill(W.pita);
  doc.roundedRect(kiri + 13, y + 13, 36, 36, 9).fill("#ffffff");
  // Ikon kalender sederhana
  doc.strokeColor(W.teal).lineWidth(1.6);
  doc.roundedRect(kiri + 22, y + 23, 18, 16, 2).stroke();
  doc.moveTo(kiri + 22, y + 28.5).lineTo(kiri + 40, y + 28.5).stroke();
  doc.moveTo(kiri + 26, y + 20).lineTo(kiri + 26, y + 26).stroke();
  doc.moveTo(kiri + 36, y + 20).lineTo(kiri + 36, y + 26).stroke();
  doc.fillColor(W.teal).font("Helvetica-Bold").fontSize(8.5).text("L A P O R A N  H A R I A N", kiri + 60, y + 10, { width: lebar - 190 });
  doc.fillColor(W.gelap).fontSize(14.5).text(tgl(d.report_date), kiri + 60, y + 22, { width: lebar - 190 });
  doc.fillColor("#5b6b82").font("Helvetica").fontSize(9)
    .text(`${d.child_name}${d.class_name ? ` · ${d.class_name}` : ""} · ${d.branch_name}`, kiri + 60, y + 41, { width: lebar - 190 });
  if (moodLabel) {
    doc.font("Helvetica-Bold").fontSize(8.5);
    const teksMood = `Mood: ${moodLabel}`;
    const lebarPil = doc.widthOfString(teksMood) + 24;
    doc.roundedRect(kiri + lebar - lebarPil - 13, y + 19, lebarPil, 22, 11).fill("#ffffff");
    doc.fillColor(W.tealGelap).text(teksMood, kiri + lebar - lebarPil - 13, y + 25.5, { width: lebarPil, align: "center" });
  }
  doc.restore();
  y += 62 + 18;

  // ---------- Aktivitas ----------
  doc.fillColor("#33383e").font("Helvetica-Bold").fontSize(11).text("AKTIVITAS & PEMBELAJARAN", kiri, y);
  y += 15;
  doc.fillColor(W.abu).font("Helvetica").fontSize(8.5).text("Skala penilaian: 1–4 bintang (4 = sempurna)", kiri, y);
  y += 14;

  if (d.activities.length === 0) {
    doc.fillColor("#3c454e").fontSize(9.5).text("Belum ada aktivitas tercatat pada laporan ini.", kiri, y);
    y += 14;
  }

  d.activities.forEach((a, idx) => {
    const chips: Array<{ teks: string; bg: string; tx: string }> = [];
    if (a.area) chips.push({ teks: AREA[a.area] || a.area, bg: W.chipAreaBg, tx: W.chipAreaTx });
    if (a.work_location) chips.push({ teks: LOKASI[a.work_location] || a.work_location, bg: W.chipLokBg, tx: W.chipLokTx });
    if (a.work_mode) chips.push({ teks: MODE[a.work_mode] || a.work_mode, bg: W.chipModeBg, tx: W.chipModeTx });

    const lebarIsi = lebar - 28;
    const catatan = a.notes ? `Catatan guru: ${a.notes}` : "";
    const tinggiCatatan = catatan ? tinggiTeks(catatan, "Helvetica", 9.5, lebarIsi) : 0;

    let foto: { buf: Buffer; w: number; h: number } | null = null;
    const buf = d.photos?.[idx];
    if (buf) {
      try {
        const img = (doc as unknown as { openImage: (b: Buffer) => { width: number; height: number } }).openImage(buf);
        const w = Math.min(250, lebarIsi);
        const h = Math.min(190, (img.height / img.width) * w);
        foto = { buf, w, h: (img.height / img.width) * w > 190 ? 190 : (img.height / img.width) * w };
      } catch {
        foto = null;
      }
    }

    const tinggiKartu = 13 + 15 + (chips.length ? 21 : 0) + (catatan ? tinggiCatatan + 7 : 0) + (foto ? foto.h + 9 : 0) + 12;
    pastikanRuang(Math.min(tinggiKartu, bawah - 40));
    const yKartu = y;
    doc.save();
    doc.lineWidth(0.8);
    doc.roundedRect(kiri, yKartu, lebar, tinggiKartu, 12).fillAndStroke("#ffffff", W.abuMuda);
    doc.restore();

    let cy = yKartu + 13;
    doc.fillColor(W.gelap).font("Helvetica-Bold").fontSize(11).text(a.title, kiri + 14, cy, { width: lebarIsi - 130 });
    if (Number(a.rating) > 0) barisBintang(doc, kiri + lebar - 14, cy + 5, Number(a.rating));
    cy += 15;
    if (chips.length) {
      let cx = kiri + 14;
      doc.font("Helvetica-Bold").fontSize(8);
      for (const c of chips) {
        const wChip = doc.widthOfString(c.teks) + 18;
        doc.save();
        doc.roundedRect(cx, cy, wChip, 15, 5).fill(c.bg);
        doc.fillColor(c.tx).text(c.teks, cx, cy + 3.5, { width: wChip, align: "center" });
        doc.restore();
        cx += wChip + 6;
      }
      cy += 21;
    }
    if (catatan) {
      doc.fontSize(9.5).fillColor("#3c454e");
      const label = "Catatan guru: ";
      doc.font("Helvetica-Bold").fillColor(W.tinta).text(label, kiri + 14, cy, { continued: true });
      doc.font("Helvetica").fillColor("#3c454e").text(a.notes || "", { width: lebarIsi - doc.widthOfString(label) });
      cy += tinggiCatatan + 7;
    }
    if (foto) {
      try {
        doc.image(foto.buf, kiri + 14, cy, { width: foto.w, height: foto.h });
      } catch {
        /* foto rusak: lewati, teks laporan tetap utuh */
      }
      cy += foto.h + 9;
    }
    y = yKartu + tinggiKartu + 10;
  });

  // ---------- Makan / Tidur / Toilet ----------
  y += 4;
  const lebarMini = (lebar - 10) / 2;
  const makanBesar = d.meals_text || d.snack_text || (d.meal_level ? PORSI[d.meal_level] || d.meal_level : "-");
  const makanSub: string[] = [];
  if (d.meals_text && d.meal_level) makanSub.push(PORSI[d.meal_level] || d.meal_level);
  if (d.snack_text) makanSub.push(`Snack: ${d.snack_text}${d.snack_level ? ` · ${PORSI[d.snack_level] || d.snack_level}` : ""}`);
  const tidurBesar = d.nap_start || d.nap_end
    ? `${jamTitik(d.nap_start) || "--.--"}–${jamTitik(d.nap_end) || "--.--"}`
    : d.nap_quality ? NAP[d.nap_quality] || d.nap_quality : "-";
  const tidurSub = (d.nap_start || d.nap_end) && d.nap_quality ? [NAP[d.nap_quality] || d.nap_quality] : [];

  const tinggiMini = (besar: string, subs: string[]) =>
    12 + 11 + 4 + tinggiTeks(besar, "Helvetica-Bold", 12, lebarMini - 32) + subs.reduce((t, s) => t + tinggiTeks(s, "Helvetica", 8.5, lebarMini - 32) + 1, 0) + 12;
  const tinggiDua = Math.max(tinggiMini(makanBesar, makanSub), tinggiMini(tidurBesar, tidurSub));
  pastikanRuang(tinggiDua + 52);
  const gambarMini = (x: number, label: string, warna: string, besar: string, subs: string[]) => {
    doc.save();
    doc.lineWidth(0.8);
    doc.roundedRect(x, y, lebarMini, tinggiDua, 12).fillAndStroke("#ffffff", W.abuMuda);
    doc.restore();
    doc.fillColor(warna).font("Helvetica-Bold").fontSize(9).text(label, x + 16, y + 12);
    let ty = y + 27;
    doc.fillColor(W.gelap).fontSize(12).text(besar, x + 16, ty, { width: lebarMini - 32 });
    ty += tinggiTeks(besar, "Helvetica-Bold", 12, lebarMini - 32) + 2;
    for (const s of subs) {
      doc.fillColor(W.abu).font("Helvetica").fontSize(8.5).text(s, x + 16, ty, { width: lebarMini - 32 });
      ty += tinggiTeks(s, "Helvetica", 8.5, lebarMini - 32) + 1;
    }
  };
  gambarMini(kiri, "MAKAN", W.merah, makanBesar, makanSub);
  gambarMini(kiri + lebarMini + 10, "TIDUR", W.ungu, tidurBesar, tidurSub);
  y += tinggiDua + 10;

  // Toilet
  pastikanRuang(46);
  doc.save();
  doc.lineWidth(0.8);
  doc.roundedRect(kiri, y, lebar, 40, 12).fillAndStroke("#ffffff", W.abuMuda);
  doc.restore();
  doc.fillColor(W.teal).font("Helvetica-Bold").fontSize(9.5).text("TOILET", kiri + 16, y + 15);
  const selToilet = (tengah: number, angka: number, ket: string) => {
    doc.fillColor(W.gelap).font("Helvetica-Bold").fontSize(13).text(String(angka), tengah - 20, y + 8, { width: 40, align: "center" });
    doc.fillColor(W.abu).font("Helvetica").fontSize(7.5).text(ket, tengah - 20, y + 25, { width: 40, align: "center" });
  };
  doc.save();
  doc.moveTo(kiri + lebar * 0.66, y + 8).lineTo(kiri + lebar * 0.66, y + 32).strokeColor(W.abuMuda).lineWidth(0.8).stroke();
  doc.restore();
  selToilet(kiri + lebar * 0.55, Number(d.toilet_pee_count) || 0, "BAK");
  selToilet(kiri + lebar * 0.85, Number(d.toilet_poop_count) || 0, "BAB");
  y += 50;

  // ---------- Bagian teks ----------
  const seksiTeks = (judul: string, warnaJudul: string, isi: string, bg: string | null, garis: string, warnaIsi: string, kosongAbu = false) => {
    const tinggiIsi = tinggiTeks(isi, "Helvetica", 9.5, lebar - 28);
    pastikanRuang(16 + tinggiIsi + 24 + 10);
    doc.fillColor(warnaJudul).font("Helvetica-Bold").fontSize(10.5).text(judul.toUpperCase(), kiri, y);
    y += 16;
    doc.save();
    doc.lineWidth(0.8);
    if (bg) doc.roundedRect(kiri, y, lebar, tinggiIsi + 20, 12).fillAndStroke(bg, garis);
    else doc.roundedRect(kiri, y, lebar, tinggiIsi + 20, 12).strokeColor(garis).stroke();
    doc.restore();
    doc.fillColor(kosongAbu ? "#8a94a0" : warnaIsi).font("Helvetica").fontSize(9.5).text(isi, kiri + 14, y + 10, { width: lebar - 28 });
    y += tinggiIsi + 20 + 14;
  };

  if (d.notes) seksiTeks("Catatan Tambahan", "#33383e", d.notes, W.krimBg, W.krimGaris, "#2f353c");

  if (d.circle_theme || d.circle_notes) {
    const isi = d.circle_notes || "";
    const tinggiIsi = (d.circle_theme ? 15 : 0) + (Number(d.circle_rating) > 0 ? 13 : 0) + (isi ? tinggiTeks(isi, "Helvetica", 9.5, lebar - 28) + 4 : 0);
    pastikanRuang(16 + tinggiIsi + 24 + 10);
    doc.fillColor(W.tealGelap).font("Helvetica-Bold").fontSize(10.5).text("CIRCLE TIME", kiri, y);
    y += 16;
    doc.save();
    doc.lineWidth(0.8);
    doc.roundedRect(kiri, y, lebar, tinggiIsi + 22, 12).fillAndStroke(W.biruBg, W.biruGaris);
    doc.restore();
    let cy = y + 11;
    if (d.circle_theme) {
      doc.fillColor(W.tealGelap).font("Helvetica-Bold").fontSize(11).text(d.circle_theme, kiri + 14, cy, { width: lebar - 28 });
      cy += 15;
    }
    if (Number(d.circle_rating) > 0) {
      const v = Math.max(0, Math.min(4, Math.round(Number(d.circle_rating))));
      for (let i = 0; i < v; i++) gambarBintang(doc, kiri + 14 + 5 + i * 13, cy + 5, 5, true);
      cy += 13;
    }
    if (isi) {
      doc.fillColor("#2f353c").font("Helvetica").fontSize(9.5).text(isi, kiri + 14, cy, { width: lebar - 28 });
      cy += tinggiTeks(isi, "Helvetica", 9.5, lebar - 28);
    }
    y += tinggiIsi + 22 + 14;
  }

  seksiTeks(
    "Moment Special", "#555b63",
    d.special_moment || "Tidak ada kejadian spesifik hari ini.",
    "#ffffff", "#dde3e8", "#2f353c", !d.special_moment
  );

  if (d.home_suggestion) seksiTeks("Saran di Rumah", W.merah, d.home_suggestion, W.saranBg, W.saranGaris, W.marun);

  // ---------- Kaki ----------
  pastikanRuang(46);
  doc.save();
  doc.moveTo(kiri, y + 2).lineTo(kiri + lebar, y + 2).strokeColor("#edf0f3").lineWidth(0.8).stroke();
  doc.restore();
  const pelapor = d.teacher || "Guru kelas";
  doc.save();
  doc.circle(kiri + 13, y + 20, 13).fill("#e8ebee");
  doc.restore();
  doc.fillColor("#5b656f").font("Helvetica-Bold").fontSize(10).text(pelapor.charAt(0).toUpperCase(), kiri, y + 15.5, { width: 26, align: "center" });
  doc.font("Helvetica").fontSize(9).text(`Dilaporkan oleh: ${pelapor}`, kiri + 34, y + 16, { width: lebar - 34 });
  doc.fontSize(7.5).fillColor("#98a2ad").text(
    `Dokumen ini dibuat otomatis oleh aplikasi Balita Center dari laporan yang telah diterbitkan${d.published_at ? ` pada ${tgl(d.published_at)}` : ""}.`,
    kiri, y + 34, { width: lebar }
  );

  return doc;
}
