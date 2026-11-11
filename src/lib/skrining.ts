// Konstanta Layanan Skrining & Berkas Rujukan (aman untuk klien).
// Batas non-klinis berlaku di setiap langkah: skrining adalah pemetaan dan
// deteksi dini — bukan diagnosis, bukan terapi, bukan janji hasil. Bahasa
// seluruh layanan ini menjaga batas tersebut.

// Taksonomi aktif: hanya tujuh jenis final ini. Daftar sepuluh jenis lama
// berstatus arsip — tidak tampil, tidak dapat dipilih, tidak dipakai laporan.
export const JENIS_SKRINING: Array<[string, string]> = [
  ["tumbuh_kembang", "Skrining Tumbuh Kembang"],
  ["kesiapan_tk", "Skrining Kesiapan Belajar TK"],
  ["kesiapan_sd", "Skrining Kesiapan dan Kesulitan Belajar SD"],
  ["kesiapan_smp", "Skrining Kesiapan dan Kesulitan Belajar SMP"],
  ["indikasi_lain", "Skrining Indikasi Lain"],
  ["risiko_disleksia", "Skrining Risiko Disleksia"],
  ["kesiapan_pesantren", "Skrining Kesiapan Pesantren dan Sekolah Berasrama"],
];

export const LABEL_JENIS_SKRINING: Record<string, string> = Object.fromEntries(JENIS_SKRINING);

// Alur resmi terkunci Tahapan Skrining — tidak dapat dilompati atau dibalik.
export const TAHAP_SKRINING: Array<[number, string, string]> = [
  [1, "Penerimaan & Wawancara Awal", "Pendaftaran klien, persetujuan tertulis orang tua, anamnesis, dan konteks keluarga."],
  [2, "Kejiwaan & Sosial Emosi", "Selalu dibaca lebih dulu sebelum domain lain dinilai: sosial emosi, kelekatan, dan regulasi anak."],
  [3, "Domain Sesuai Tujuan Skrining", "Pemeriksaan domain tujuan layanan: tumbuh kembang, kesiapan belajar, literasi & risiko disleksia, atau kesiapan pesantren."],
  [4, "Pemetaan Indikasi", "Membaca kelompok indikasi Panduan Red Flag lembaga dari seluruh hasil tahap sebelumnya."],
  [5, "Sintesis & Laporan", "Penyusunan Laporan Hasil Skrining, sesi penjelasan hasil kepada orang tua, dan penentuan rekomendasi."],
];

export const LABEL_TAHAP: Record<number, string> = Object.fromEntries(
  TAHAP_SKRINING.map(([n, nama]) => [n, nama])
);

export const STATUS_SKRINING: Record<string, string> = {
  pendaftaran: "Pendaftaran",
  berjalan: "Skrining Berjalan",
  selesai: "Selesai",
};

// Pilihan cepat tujuan Berkas Rujukan — kolom tujuan selalu KOSONG sampai
// berkas diterbitkan, lalu diketik atau dipilih dari daftar ini saat terbit.
export const TUJUAN_CEPAT_RUJUKAN: string[] = [
  "Psikolog Klinis",
  "Psikolog Klinis Rumah Tambida",
  "Psikiater",
  "Dokter Anak",
  "Terapi Miracle",
  "Profesional relevan lainnya",
];

export const PILIHAN_TINDAK_LANJUT: Array<[string, string]> = [
  ["rujukan", "Rujukan langsung kepada profesional berwenang (berkas rujukan)"],
  ["observasi_lanjutan", "Observasi Lanjutan Terstruktur (sejumlah sesi tercatat)"],
  ["keduanya", "Keduanya berjalan bersamaan"],
];

export type BarisHasil = { ranah: string; indikator: string; hasil: string; bukti: string };
export type BarisIndikasi = { kelompok: string; indikator: string; ambang: boolean; catatan: string };
export type BacaanPeta = { teks: string; bukti: string };
export type PetaPerkembangan = { kekuatan: BacaanPeta; berkembang: BacaanPeta; dukungan: BacaanPeta };

// Penyusun draf Laporan Hasil Skrining: hanya menyalin fakta yang diisikan
// pemeriksa pada formulir tahap — tidak pernah menentukan nilai, status,
// indikasi, atau kesimpulan di luar isian itu. Teks soal, bunyi tugas,
// pilihan jawaban, dan kunci jawaban tidak pernah masuk ke draf.
export function susunDrafLaporan(input: {
  tahap3Rows: BarisHasil[];
  tahap4Rows: BarisIndikasi[];
}): { tabel_hasil: BarisHasil[]; indikasi: BarisIndikasi[] } {
  return {
    tabel_hasil: input.tahap3Rows.map((r) => ({ ...r })),
    indikasi: input.tahap4Rows.map((r) => ({ ...r })),
  };
}
