// Konstanta kamar Bahan Ajar & Program Khusus — kerangka Tahap 2.
// Kategori mengikuti pengelompokan bahan ajar pada prompt gabungan lembaga;
// isi resmi setiap kategori dimuat dari Paket Sistem Terpadu lembaga.

export const KATEGORI_BAHAN_AJAR: Array<{ kode: string; label: string; petunjuk: string }> = [
  { kode: "islamic_living", label: "Islamic Living", petunjuk: "Doa harian, hadis, surah pendek Juz 30, hijaiyah, dan bacaan Ummi." },
  { kode: "bahasa_inggris", label: "Bahasa Inggris ZKC", petunjuk: "Bahan bahasa Inggris bertahap untuk anak Ziel Kids Club." },
  { kode: "bahasa_arab", label: "Bahasa Arab SAM", petunjuk: "Bahan Kehidupan Islam & Bahasa Arab Sekolah Alam Montessori." },
  { kode: "pelengkap", label: "Pelengkap Lainnya", petunjuk: "Bahan pelengkap lain yang disahkan lembaga." },
];

export function labelKategoriBahanAjar(kode: string): string {
  return KATEGORI_BAHAN_AJAR.find((k) => k.kode === kode)?.label || kode;
}
