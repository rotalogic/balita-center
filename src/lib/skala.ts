// Skala penilaian resmi lembaga — seluruhnya kata, tanpa bintang di mana pun.
// Acuan: Prompt Gabungan ZKC & SAM, Aturan Mengikat Pertama.

// Penilaian ZKC per indikator: skor 1–3 sebagai kata.
export const SKALA_ZKC: Record<number, string> = {
  1: "Belum Mampu",
  2: "Mulai Mampu",
  3: "Mandiri",
};

// Kata untuk skor tersimpan (nilai lama di atas 3 dijepit ke 3 = Mandiri).
export function kataSkor(n: number | string | null | undefined): string {
  const v = Math.round(Number(n ?? 0));
  if (!v || Number.isNaN(v)) return "";
  return SKALA_ZKC[Math.max(1, Math.min(3, v))] ?? "";
}

// Status material SAM pada peta individual anak.
export const STATUS_MATERIAL_SAM = ["Dipresentasikan", "Berlatih", "Menguasai"] as const;
export type StatusMaterialSam = (typeof STATUS_MATERIAL_SAM)[number];

// Skala kata empat tingkat (Filter SAM, penilaian berkala umum).
export const SKALA_KATA_4 = [
  "Belum Teramati",
  "Mulai Teramati",
  "Sering Teramati",
  "Konsisten Teramati",
] as const;

// Masukan orang tua & penilaian layanan: kata, tanpa bintang dan tanpa angka bintang.
export const NILAI_KATA = ["Sangat Baik", "Baik", "Cukup", "Perlu Perbaikan"] as const;

// Nilai kata Laporan Ringan Pop Up (6 aspek, tanpa bintang dan tanpa skor).
export const NILAI_POP_UP = ["Bersinar", "Muncul", "Berlatih"] as const;

// Kategori program & label status anak.
export const KATEGORI_PROGRAM = ["ZKC", "SAM"] as const;
export const LABEL_STATUS_ANAK = [
  "Anggota",
  "Trial",
  "Insidentil",
  "Peserta Event",
  "Klien Skrining",
  "Klien Konsultasi",
] as const;

// Kelompok anak: ZKC berdasarkan tahap perkembangan, SAM tepat dua kelompok.
export const KELOMPOK_ZKC = ["Bibit", "Tunas", "Mekar"] as const;
export const KELOMPOK_SAM = ["NIDO", "CASA"] as const;
