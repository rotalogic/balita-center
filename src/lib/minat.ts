// Konstanta Konsultasi dan Pemetaan Bakat Minat (aman untuk klien).
// Layanan konsultasi tersendiri — BUKAN jenis skrining kedelapan dan bukan
// bagian dari pemeriksaan skrining. Seluruh bahasanya adalah bahasa
// konsultasi dan pemetaan non klinis: membaca kekuatan dan minat anak untuk
// pengarahan kegiatan — bukan asesmen psikologis, bukan diagnosis, dan bukan
// penentuan bakat yang tetap atau mengikat masa depan anak.
// Satu-satunya instrumen layanan ini adalah perangkat observasi dan
// wawancara milik lembaga sendiri; tidak ada nama, instrumen, istilah, atau
// kerangka asesmen pihak ketiga berlisensi yang dipakai di sini.

export const NAMA_LAYANAN = "Konsultasi dan Pemetaan Bakat Minat";

// Alur layanan empat langkah, berurutan, tersimpan pada berkas yang sama.
export const LANGKAH_KONSULTASI: Array<[number, string, string]> = [
  [1, "Pendaftaran & Wawancara Awal", "Konteks keluarga, riwayat aktivitas anak, dan gambaran minat yang terlihat di rumah dan di sekolah."],
  [2, "Pemetaan Kekuatan & Minat", "Observasi kekuatan anak, penelusuran minat lewat wawancara dengan anak dan orang tua, serta penelaahan riwayat aktivitas."],
  [3, "Sesi Konsultasi Penjelasan Hasil", "Pendiri menyampaikan hasil pemetaan langsung kepada orang tua dan anak/remaja; tanggalnya tercatat."],
  [4, "Peta Kekuatan dan Minat & Rekomendasi Pengarahan", "Keluaran final: peta kekuatan dan minat, Kecenderungan Arah, dan rekomendasi pengarahan yang konkret."],
];

// Empat kekuatan lensa kerangka NoticeAbility yang diterapkan lembaga,
// beserta contoh terjemahan Kecenderungan Arah-nya menurut bahasa lembaga.
export const KEKUATAN_LENGKAP: Array<{ kunci: string; nama: string; arahContoh: string }> = [
  { kunci: "dinamis", nama: "Kekuatan Penalaran Dinamis", arahContoh: "Berjalan bersama keterhubungan sosial terbaca sebagai kecenderungan kewirausahaan, kepemimpinan, dan pekerjaan yang berhadapan dengan orang banyak." },
  { kunci: "sosial", nama: "Kekuatan Penalaran Keterhubungan Sosial", arahContoh: "Terbaca pada kegiatan yang menggerakkan orang dan membangun kerja sama." },
  { kunci: "naratif", nama: "Kekuatan Naratif", arahContoh: "Terbaca sebagai kecenderungan komunikasi, bercerita, dan mengajar." },
  { kunci: "spasial", nama: "Kekuatan Material Spasial", arahContoh: "Terbaca sebagai kecenderungan desain, teknik, dan karya visual." },
];

// Lensa 1 — Kecenderungan Pemrosesan.
export const PEMROSESAN: string[] = ["Visual Spasial", "Verbal Naratif", "Logis Berurutan", "Kinestetik Gerak"];

// Lensa 4 — Ranah Kecerdasan yang Menonjol (dibaca sebagai wilayah minat
// dan kekuatan yang sedang tumbuh, bukan angka kecerdasan).
export const RANAH_MENONJOL: string[] = [
  "Linguistik", "Logis Matematis", "Spasial", "Kinestetik",
  "Musikal", "Interpersonal", "Intrapersonal", "Naturalis",
];

// Rumusan plakat lembaga tentang kerangka NoticeAbility — penyebutannya
// bukan sertifikasi dan bukan afiliasi resmi.
export const PLAKAT_NOTICEABILITY =
  "Pemetaan pada layanan ini diperkaya kerangka kekuatan dari kurikulum NoticeAbility, yang dipelajari dan diterapkan pendiri melalui program kandidasi Indonesia Dyslexia Specialist Teacher. Penerapan kerangka ini bukan sertifikasi NoticeAbility dan bukan afiliasi resmi lembaga dengan organisasi NoticeAbility.";

// SOP sesi konsultasi (keterampilan dasar sesi yang baik, bahasa lembaga):
export const SOP_SESI: string[] = [
  "Bangun rapport di awal sesi — sambut anak dan orang tua dengan hangat dan setara.",
  "Jelaskan kerahasiaan dan batas layanan sejak awal: konsultasi dan pemetaan non klinis, bukan asesmen psikologis.",
  "Dengarkan secara reflektif — pantulkan kembali yang disampaikan anak dan orang tua sebelum memberi bacaan.",
  "Buka dan tutup sesi dengan tertib — sampaikan alur sesi di awal dan rangkum hasilnya di akhir.",
];

// Usia minimum layanan tersendiri ini: empat tahun (48 bulan), ditegakkan
// pada formulir pendaftaran di lapisan server.
export const USIA_MINIMUM_BULAN = 48;

export function umurBulanDariLahir(lahirIso: string, pada: Date = new Date()): number {
  const [y, m, d] = lahirIso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return -1;
  let bulan = (pada.getFullYear() - y) * 12 + (pada.getMonth() + 1 - m);
  if (pada.getDate() < d) bulan -= 1;
  return bulan;
}
