// Konstanta dan tipe rapor periodik yang aman dipakai di klien maupun server.
// Fungsi agregasi yang menyentuh database ada di src/lib/rapor.ts.

export const NARASI_STPPA: Array<[string, string]> = [
  ["narrative_agama_moral", "Nilai Agama dan Moral"],
  ["narrative_fisik_motorik", "Fisik-Motorik"],
  ["narrative_kognitif", "Kognitif"],
  ["narrative_bahasa", "Bahasa"],
  ["narrative_sosial_emosional", "Sosial-Emosional dan Kemandirian"],
  ["narrative_seni", "Seni"],
];

export const NARASI_MONTESSORI: Array<[string, string]> = [
  ["narrative_practical_life", "Practical Life"],
  ["narrative_language", "Language"],
  ["narrative_sensorial", "Sensorial"],
  ["narrative_mathematics", "Mathematics"],
  ["narrative_cultural", "Cultural"],
];

// Catatan perkembangan dalam urutan resmi lembaga: latar belakang, gambaran
// umum, kekuatan anak, kemampuan yang sedang berkembang, area dukungan.
export const NARASI_PERKEMBANGAN: Array<[string, string]> = [
  ["narrative_latar", "Latar Belakang"],
  ["narrative_gambaran", "Gambaran Umum"],
  ["narrative_kekuatan", "Kekuatan Anak"],
  ["narrative_berkembang", "Kemampuan yang Sedang Berkembang"],
  ["narrative_dukungan", "Area yang Memerlukan Dukungan"],
];

export const NARASI_INGGRIS: Array<[string, string]> = [
  ["inggris_kata", "Gugus Kata & Ungkapan yang Dikenalkan"],
  ["inggris_respons", "Respons Lisan Anak"],
];

// Tahap pengamatan Kurikulum Bahasa Inggris Dasar lembaga (tiga tahap);
// nama tahap resmi mengikuti kurikulum lembaga.
export const LABEL_TAHAP_INGGRIS: Record<number, string> = {
  1: "Tahap Pengamatan 1",
  2: "Tahap Pengamatan 2",
  3: "Tahap Pengamatan 3",
};

export const NARASI_ISLAM_ARAB: Array<[string, string]> = [
  ["islam_doa", "Doa Harian"],
  ["islam_hadis", "Hadis Pilihan"],
  ["islam_juz30", "Pengenalan Juz 30"],
  ["islam_hijaiyah", "Huruf Hijaiyah & Tangga Menulis"],
  ["islam_ummi", "Mengaji Metode Ummi"],
];

export const NARASI_ATENSI: Array<[string, string]> = [
  ["atensi_durasi", "Lama Bertahan pada Satu Pekerjaan"],
  ["atensi_pengulangan", "Pengulangan yang Dipilih Anak"],
  ["atensi_siklus", "Penyelesaian Siklus Kerja"],
  ["atensi_fokus", "Kembali Fokus Sesudah Terdistraksi"],
];

export const KOLOM_NARASI: string[] = [
  ...NARASI_STPPA.map(([k]) => k),
  ...NARASI_MONTESSORI.map(([k]) => k),
  "conclusion",
  "parent_suggestion",
  "ringkasan_ortu",
  ...NARASI_PERKEMBANGAN.map(([k]) => k),
  "narrative_kelekatan",
  "narrative_tema",
  "profil_cara_belajar",
  ...NARASI_INGGRIS.map(([k]) => k),
  ...NARASI_ISLAM_ARAB.map(([k]) => k),
  ...NARASI_ATENSI.map(([k]) => k),
  "narasi_pertumbuhan",
  "tips_pola_asuh",
];

const GIZI: Record<string, string> = {
  gizi_baik: "Gizi Baik",
  gizi_kurang: "Gizi Kurang",
  gizi_lebih: "Gizi Lebih",
  obesitas: "Obesitas",
  stunting: "Stunting",
};

// Label manusiawi untuk status gizi. Kode mentah (mis. "GIZI_BAIK") tidak
// boleh tampil ke orang tua — pelajaran dari kebocoran enum di portal lama.
export function labelGizi(v?: string | null): string {
  if (!v) return "-";
  return GIZI[v] || v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type AgregatRapor = {
  hadir: number;
  izin: number;
  sakit: number;
  tanpa_keterangan: number;
  hari_sekolah: number;
  tanpa_catatan: number;
  catatan_harian: number;
  berat_kg: string | null;
  tinggi_cm: string | null;
  lingkar_kepala_cm: string | null;
  status_gizi: string | null;
  tanggal_ukur: string | null;
  // Seluruh titik pengukuran anak sampai akhir siklus (untuk diagram garis
  // berat & tinggi badan dari data anak itu sendiri).
  pengukuran: Array<{ tanggal: string; berat_kg: number | null; tinggi_cm: number | null }>;
  foto: Array<{ url: string; caption: string | null; media_type?: string; poster_url?: string | null }>;
};
