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

// Subkategori resmi per kategori, persis komponen yang disebut prompt
// gabungan lembaga (bahan ajar pelengkap butir Enam + komponen laporan SAM).
export const SUBKATEGORI_RESAMI: Record<string, string[]> = {
  islamic_living: ["Doa Harian", "Hadis Pilihan", "Pengenalan Juz 30", "Huruf Hijaiyah", "Mengaji Metode Ummi", "Tangga Menulis Hijaiyah"],
  bahasa_inggris: ["Gugus Kata", "Ungkapan", "Dialog Situasi"],
  bahasa_arab: ["Tangga Menulis Hijaiyah", "Bahan Dasar"],
  pelengkap: [],
};

// Target jumlah butir per subkategori sesuai angka pada prompt gabungan —
// angka inilah yang diverifikasi terhadap Paket Sistem Terpadu saat dimuat.
export const TARGET_SUBKATEGORI: Record<string, number> = {
  "Doa Harian": 12,
  "Hadis Pilihan": 10,
  "Pengenalan Juz 30": 15,
  "Huruf Hijaiyah": 28,
};

// Target kelengkapan tambahan menurut isi dokumen kurikulum resmi pada
// Paket Sistem Terpadu (bukan angka prompt): jumlah kelompok/tahap yang
// memang dimuat dokumennya. Ditampilkan agar kekosongan terlihat; statusnya
// acuan dokumen, menunggu pengesahan founder sebagai target resmi.
export const TARGET_DOKUMEN: Array<{ subkategori: string; target: number; keterangan: string }> = [
  { subkategori: "Mengaji Metode Ummi", target: 1, keterangan: "1 paket metode, Jilid 1–6" },
  { subkategori: "Gugus Kata", target: 8, keterangan: "8 kelompok kata pada dokumen Bahasa Inggris ZKC" },
  { subkategori: "Ungkapan", target: 8, keterangan: "8 ungkapan momen pada dokumen Bahasa Inggris ZKC" },
  { subkategori: "Dialog Situasi", target: 8, keterangan: "8 dialog pada dokumen Bahasa Inggris ZKC" },
  { subkategori: "Bahan Dasar", target: 11, keterangan: "8 bank kosakata + 3 dialog/ungkapan pada dokumen Bahasa Arab SAM" },
  { subkategori: "Tangga Menulis Hijaiyah", target: 5, keterangan: "5 tahap tangga pada dokumen Bahasa Arab SAM" },
];

// Peta pos pemakaian materi acuan (kaidah prompt gabungan): setiap tabel
// materi wajib punya pos di pembelajaran dan di laporan; yang belum punya
// pos dinyatakan terbuka sebagai pekerjaan yang belum selesai.
export const PETA_POS_PEMAKAIAN: Array<{ tabel: string; pembelajaran: string; laporan: string; berpos: boolean }> = [
  { tabel: "Butir STPPA (Akademik)", pembelajaran: "Daftar amati pembelajaran harian ZKC", laporan: "Tabel observasi per indikator pada laporan & rapor ZKC", berpos: true },
  { tabel: "Katalog Milestone ZKC (Akademik)", pembelajaran: "Daftar amati pembelajaran harian ZKC", laporan: "Instrumen yang dibaca laporan & rapor ZKC", berpos: true },
  { tabel: "Katalog Material SAM (Akademik)", pembelajaran: "Urutan presentasi & pekerjaan anak SAM; peta material per anak", laporan: "Peta material yang dibaca laporan & rapor SAM", berpos: true },
  { tabel: "Kurikulum ZKC 14 Bulan (Bahan Ajar)", pembelajaran: "Isi pembelajaran harian ZKC; sumber observasi dari tema", laporan: "Observasi dari tema pada laporan ZKC", berpos: false },
  { tabel: "Bahan Ajar — Bahasa Inggris ZKC", pembelajaran: "Pembelajaran Bahasa Inggris ZKC", laporan: "Komponen Bahasa Inggris eksplisit pada rapor ZKC (gugus kata, respons lisan, tiga tahap pengamatan)", berpos: false },
  { tabel: "Bahan Ajar — Islamic Living & Bahasa Arab SAM", pembelajaran: "Pembelajaran kehidupan Islam & Bahasa Arab SAM", laporan: "Komponen Kehidupan Islam dan Bahasa Arab pada rapor SAM (empat unsur + perjalanan Ummi)", berpos: false },
  { tabel: "Kurikulum & Materi Movement (Bahan Ajar)", pembelajaran: "Pembelajaran Kelas Movement", laporan: "Laporan Movement", berpos: false },
  { tabel: "Program & Materi Calistung (Bahan Ajar)", pembelajaran: "Pembelajaran program khusus Calistung", laporan: "Laporan hasil program Calistung", berpos: false },
  { tabel: "Bank Sesi Pendampingan Individual (Bahan Ajar)", pembelajaran: "Acuan rencana sesi pendampingan (jadwal di Admission)", laporan: "Belum ada laporan khusus pendampingan pada prompt", berpos: false },
];
