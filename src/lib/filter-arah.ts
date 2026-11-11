// Filter Arah & Filter SAM — mesin aturan penerimaan ZKC & SAM.
// Kaidah terbaca sesuai Prompt Gabungan (Modul Penerimaan): saran sistem
// tidak pernah menimpa pilihan orang tua; hasil selalu disertai alasan
// dalam kalimat utuh, tanpa bunyi vonis.

export type ArahRekomendasi = "ZKC" | "SAM" | "ZKC_DAHULU_SAM";
export type HasilSam = "SIAP_SAM" | "SIAP_TRANSISI" | "SIAP_PENYAMAAN" | "BELUM_SIAP";

export const LABEL_ARAH: Record<ArahRekomendasi, string> = {
  ZKC: "Ziel Kids Club",
  SAM: "Sekolah Alam Montessori",
  ZKC_DAHULU_SAM: "Ziel Kids Club dahulu, lalu Sekolah Alam Montessori",
};

export const LABEL_HASIL_SAM: Record<HasilSam, string> = {
  SIAP_SAM: "Siap SAM",
  SIAP_TRANSISI: "Siap SAM dengan Masa Transisi",
  SIAP_PENYAMAAN: "Siap SAM dengan Sesi Penyamaan Terlebih Dahulu",
  BELUM_SIAP: "Belum Siap SAM — Arahkan ZKC Dahulu",
};

// Gugus sisi anak Filter SAM (jumlah butir resmi; teks butir dari paket data).
export const GUGUS_SAM_ANAK = [
  { kunci: "kemandirian_dasar", label: "Kemandirian Dasar", butir: 6 },
  { kunci: "kesiapan_berpisah", label: "Kesiapan Berpisah", butir: 5, penentu: true },
  { kunci: "regulasi_rutinitas", label: "Regulasi dan Rutinitas", butir: 4 },
  { kunci: "bahasa_fungsional", label: "Bahasa Fungsional", butir: 3 },
  { kunci: "gerak_keselamatan", label: "Gerak dan Keselamatan Dasar", butir: 3 },
] as const;
export type GugusSamAnak = (typeof GUGUS_SAM_ANAK)[number]["kunci"];

// Gugus sisi orang tua: Kesiapan Pola Pikir Orang Tua, 7 butir (dari prompt).
export const BUTIR_SAM_ORTU = [
  "Memahami Montessori mengikuti tempo anak, tanpa target calistung paksa",
  "Bersedia tidak membandingkan anak dengan anak lain",
  "Mendukung kemandirian anak di rumah",
  "Bersedia bermitra lewat laporan dan rekomendasi di rumah",
  "Menerima Islamic living dan ritme sekolah sebagai bagian hari anak",
  "Pola layar dan bacaan di rumah yang mendukung",
  "Siap berkomitmen mengikuti program per periode tiga bulan",
] as const;

export function umurBulan(tanggalLahir: string, pada: Date = new Date()): number {
  const lahir = new Date(`${tanggalLahir}T00:00:00`);
  let bulan = (pada.getFullYear() - lahir.getFullYear()) * 12 + (pada.getMonth() - lahir.getMonth());
  if (pada.getDate() < lahir.getDate()) bulan -= 1;
  return Math.max(0, bulan);
}

export type MasukanSam = {
  anak: Partial<Record<GugusSamAnak, number>>;
  ortu: number[];
};

export type KeluaranSam = { hasil: HasilSam; alasan: string[] } | null;

// Filter SAM dua sisi. Nilai gugus/butir 1–4 mengikuti SKALA_KATA_4
// (Belum Teramati, Mulai Teramati, Sering Teramati, Konsisten Teramati).
// Kesiapan Berpisah adalah gugus penentu di sisi anak.
export function filterSam(masukan: MasukanSam): KeluaranSam {
  const { anak, ortu } = masukan;
  const nilaiAnak = GUGUS_SAM_ANAK.map((g) => anak[g.kunci]).filter(
    (v): v is number => typeof v === "number" && v >= 1 && v <= 4
  );
  if (nilaiAnak.length < GUGUS_SAM_ANAK.length) return null;
  if (!Array.isArray(ortu) || ortu.length < BUTIR_SAM_ORTU.length) return null;

  const rata = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const rataAnak = rata(nilaiAnak);
  const rataOrtu = rata(ortu.slice(0, BUTIR_SAM_ORTU.length));
  const berpisah = anak.kesiapan_berpisah as number;

  const alasan: string[] = [];
  for (const g of GUGUS_SAM_ANAK) {
    const v = anak[g.kunci] as number;
    if (v <= 2) alasan.push(`Gugus ${g.label} masih pada tahap awal teramati, sehingga anak membutuhkan pendampingan fondasi yang lebih dekat.`);
  }
  ortu.slice(0, BUTIR_SAM_ORTU.length).forEach((v, i) => {
    if (v <= 2) alasan.push(`Sisi keluarga: butir "${BUTIR_SAM_ORTU[i]}" masih perlu disamakan bersama sebelum anak mulai.`);
  });

  let hasil: HasilSam;
  if (berpisah <= 2 && !(berpisah === 2 && rataAnak >= 3)) {
    hasil = "BELUM_SIAP";
    alasan.unshift("Kesiapan berpisah — gugus penentu untuk memulai di SAM — belum tampak konsisten, sehingga anak diarahkan membangun fondasi rasa aman di Ziel Kids Club dahulu.");
  } else if (berpisah === 2 || rataAnak < 3) {
    hasil = "SIAP_TRANSISI";
    alasan.unshift("Sebagian besar kesiapan anak sudah teramati; kesiapan berpisah dan beberapa gugus masih bertumbuh, sehingga anak siap memulai di SAM dengan masa transisi bertahap.");
  } else if (rataOrtu < 2.5) {
    hasil = "SIAP_PENYAMAAN";
    alasan.unshift("Anak sudah menunjukkan kesiapan untuk SAM; sisi keluarga masih memerlukan sesi penyamaan pola pikir terlebih dahulu agar pendampingan di rumah selaras dengan ritme sekolah.");
  } else {
    hasil = "SIAP_SAM";
    alasan.unshift("Kesiapan anak — termasuk kesiapan berpisah sebagai gugus penentu — dan kesiapan pola pikir keluarga sama-sama teramati konsisten.");
  }
  return { hasil, alasan };
}

export type MasukanArah = {
  umurBulan: number;
  pilihanOrtu: "ZKC" | "SAM";
  sinyalDukunganKonsisten: boolean;
  sam: KeluaranSam;
};

export type KeluaranArah = {
  rekomendasi: ArahRekomendasi;
  keyakinan: string;
  alasan: string[];
  berbeda: boolean;
};

// Filter Arah: kaidah terbaca, berurutan dari yang paling mengikat.
export function filterArah(m: MasukanArah): KeluaranArah {
  const alasan: string[] = [];
  let rekomendasi: ArahRekomendasi;
  let keyakinan: string;

  if (m.umurBulan < 18) {
    rekomendasi = "ZKC";
    keyakinan = "Sangat Yakin";
    alasan.push(`Anak berusia ${m.umurBulan} bulan. Sekolah Alam Montessori mulai pada usia 18 bulan, sehingga arah yang tepat saat ini adalah Ziel Kids Club.`);
  } else if (m.sinyalDukunganKonsisten) {
    rekomendasi = "ZKC_DAHULU_SAM";
    keyakinan = "Yakin";
    alasan.push("Teramati sinyal kebutuhan dukungan perkembangan yang konsisten. Fondasi dibangun terlebih dahulu di Ziel Kids Club, dan pembelajaran sekolah berjalan di Sekolah Alam Montessori sesudah fondasi menguat.");
  } else if (m.pilihanOrtu === "SAM" && m.sam) {
    if (m.sam.hasil === "BELUM_SIAP") {
      rekomendasi = "ZKC_DAHULU_SAM";
      keyakinan = "Yakin";
      alasan.push(...m.sam.alasan);
    } else {
      rekomendasi = "SAM";
      keyakinan = m.sam.hasil === "SIAP_SAM" ? "Yakin" : "Cukup Yakin";
      alasan.push(`Hasil Filter SAM dua sisi: ${LABEL_HASIL_SAM[m.sam.hasil]}.`);
      alasan.push(...m.sam.alasan);
    }
  } else if (m.pilihanOrtu === "SAM") {
    rekomendasi = "SAM";
    keyakinan = "Cukup Yakin";
    alasan.push("Keluarga bertujuan ke Sekolah Alam Montessori dan usia anak sudah memenuhi. Filter SAM dua sisi belum terisi lengkap, sehingga arah ini dikonfirmasi kembali lewat Filter SAM dan hari Discovery.");
  } else {
    rekomendasi = "ZKC";
    keyakinan = "Yakin";
    alasan.push("Usia dan tujuan keluarga selaras dengan pendampingan fondasi di Ziel Kids Club.");
  }

  const berbeda =
    (rekomendasi === "ZKC" && m.pilihanOrtu === "SAM") ||
    (rekomendasi === "SAM" && m.pilihanOrtu === "ZKC") ||
    (rekomendasi === "ZKC_DAHULU_SAM" && m.pilihanOrtu === "SAM");
  if (berbeda) {
    alasan.push("Pilihan awal keluarga berbeda dari saran sistem. Saran ini bersifat rekomendasi — keputusan akhir tetap pada keluarga bersama guru pendamping.");
  }
  return { rekomendasi, keyakinan, alasan, berbeda };
}
