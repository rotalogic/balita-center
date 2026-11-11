// Konstanta Tahap 4 (aman untuk klien): skala kata masukan & penilaian,
// tingkat kompetensi, dan penomoran surat.

// Skala kata Masukan Orang Tua & Penilaian Guru oleh Wali Murid — tanpa
// bintang dan tanpa angka bintang dalam bentuk apa pun pada permukaan.
export const SKALA_MASUKAN = ["Sangat Baik", "Baik", "Cukup", "Perlu Perbaikan"] as const;

// Ubahan internal skala kata -> poin (hanya untuk Papan Poin Guru di dasbor
// founder dan portal manager; tidak ditampilkan ke penilai).
export const POIN_DARI_KATA: Record<string, number> = {
  "Sangat Baik": 4, "Baik": 3, "Cukup": 2, "Perlu Perbaikan": 1,
};

// Empat aspek Masukan Orang Tua (nama aspek mengikuti dokumen lembaga;
// konstanta tunggal ini tempat penyesuaiannya).
export const ASPEK_MASUKAN: Array<[string, string]> = [
  ["pelayanan_guru", "Pelayanan Guru kepada Anak"],
  ["komunikasi", "Komunikasi dengan Orang Tua"],
  ["lingkungan_kegiatan", "Lingkungan & Kegiatan Belajar"],
  ["administrasi", "Administrasi & Layanan Umum"],
];

// Empat aspek Penilaian Guru oleh Wali Murid.
export const ASPEK_PENILAIAN_GURU: Array<[string, string]> = [
  ["kedekatan", "Kedekatan & Kepedulian kepada Anak"],
  ["komunikasi", "Komunikasi Guru dengan Orang Tua"],
  ["ketelatenan", "Ketelatenan & Kesabaran"],
  ["laporan", "Kerapian Laporan & Dokumentasi"],
];

// Standar & Kompetensi Guru: skala kata empat tingkat; Tingkat 3 Kompeten
// adalah standar minimum (kelulusan probation & standar sesudah probation).
export const TINGKAT_KOMPETENSI: Record<number, string> = {
  1: "Tingkat 1 — Perlu Bimbingan",
  2: "Tingkat 2 — Sedang Berkembang",
  3: "Tingkat 3 — Kompeten",
  4: "Tingkat 4 — Teladan",
};
export const TINGKAT_MINIMUM = 3;
export const JUMLAH_GUGUS = 10;

const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
export function bulanRomawi(bulan1sampai12: number): string {
  return ROMAWI[Math.max(1, Math.min(12, bulan1sampai12)) - 1] || "I";
}

// Format nomor surat: nomor urut, kode jenis, bulan Romawi, tahun.
export function formatNomorSurat(urut: number, kode: string, tanggal: Date): string {
  return `${String(urut).padStart(3, "0")}/${kode}/${bulanRomawi(tanggal.getMonth() + 1)}/${tanggal.getFullYear()}`;
}

// Tahap probation dari tanggal mulai: bulan 1 Adaptasi & Pelatihan, bulan 2
// Praktik Terbimbing, bulan 3 Penilaian Standar.
export function tahapProbation(mulaiIso: string, pada: Date = new Date()): { bulanKe: number; nama: string } {
  const [y, m, d] = mulaiIso.slice(0, 10).split("-").map(Number);
  let bulan = (pada.getFullYear() - y) * 12 + (pada.getMonth() + 1 - m) + (pada.getDate() >= d ? 1 : 0);
  if (bulan < 1) bulan = 1;
  const nama = bulan === 1 ? "Adaptasi dan Pelatihan" : bulan === 2 ? "Praktik Terbimbing" : bulan === 3 ? "Penilaian Standar" : "Melewati Periode 3 Bulan";
  return { bulanKe: bulan, nama };
}

// Pertanyaan penyaring pertama rekrutmen — bunyi resmi lembaga.
export const PERTANYAAN_PERTAMA =
  "Apa alasan kuat dan motivasi Anda ingin bekerja di lembaga ini?";
