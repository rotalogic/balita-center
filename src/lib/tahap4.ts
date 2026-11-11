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

// Formulir Masukan Orang Tua resmi lembaga (Formulir_Masukan_Orang_Tua_
// ZKC_SAM): lima bidang, masing-masing tiga pernyataan, dinilai dengan
// SKALA_MASUKAN; empat isian cerita; satu penilaian rekomendasi penutup.
export const BIDANG_MASUKAN: Array<{ bidang: string; pernyataan: Array<[string, string]> }> = [
  { bidang: "Guru & Pendamping", pernyataan: [
    ["guru_memahami", "Guru memahami karakter dan kebutuhan anak kami"],
    ["guru_komunikasi", "Guru berkomunikasi dengan ramah, jelas, dan menghormati keluarga kami"],
    ["guru_aman", "Kami merasa anak kami aman dan diterima apa adanya oleh gurunya"],
  ] },
  { bidang: "Program & Pembelajaran", pernyataan: [
    ["program_bermakna", "Kegiatan anak bermakna dan sesuai tahap perkembangannya"],
    ["program_kemajuan", "Perkembangan anak kami terlihat dan terasa kemajuannya"],
    ["program_variasi", "Tema dan kegiatan anak bervariasi dan tidak membosankan"],
  ] },
  { bidang: "Fasilitas & Lingkungan", pernyataan: [
    ["fasilitas_lingkungan", "Lingkungan belajar bersih, aman, dan nyaman untuk anak"],
    ["fasilitas_material", "Material dan alat bermain anak terawat dan memadai"],
    ["fasilitas_tunggu", "Area tunggu dan fasilitas untuk orang tua memadai"],
  ] },
  { bidang: "Administrasi & Komunikasi", pernyataan: [
    ["admin_respons", "Admin cepat dan jelas menanggapi pertanyaan kami"],
    ["admin_informasi", "Informasi jadwal, biaya, dan perubahan disampaikan dengan jelas dan tepat waktu"],
    ["admin_pendaftaran", "Proses pendaftaran dan pemilihan jadwal mudah bagi kami"],
  ] },
  { bidang: "Laporan & Dokumentasi", pernyataan: [
    ["laporan_mudah", "Laporan perkembangan anak mudah dipahami dan terasa menggambarkan anak kami"],
    ["laporan_dokumentasi", "Foto dan dokumentasi kegiatan anak yang kami terima memadai"],
    ["laporan_portal", "Portal dan sistem informasi mudah kami gunakan"],
  ] },
];

// Daftar rata seluruh pernyataan (dipakai validasi server & ringkasan admin).
export const ASPEK_MASUKAN: Array<[string, string]> = BIDANG_MASUKAN.flatMap((b) => b.pernyataan);

// Empat isian cerita Bagian 3 formulir resmi.
export const CERITA_MASUKAN: Array<[string, string]> = [
  ["syukuri", "Hal yang paling kami syukuri dari pengalaman anak kami di sini"],
  ["perbaiki", "Hal yang menurut kami paling perlu diperbaiki (untuk guru, program, fasilitas, atau layanan)"],
  ["momen", "Kejadian atau momen tertentu yang ingin kami sampaikan"],
  ["harapan", "Harapan kami untuk periode berikutnya"],
];

// Penilaian penutup formulir: kemungkinan merekomendasikan lembaga.
export const SKALA_REKOMENDASI = ["Sangat Besar", "Besar", "Cukup", "Kecil"] as const;
export const KUNCI_REKOMENDASI = "rekomendasi";

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

// Format nomor surat resmi lembaga (Paket Surat & Proposal ZKC SAM):
// nomor urut, kode jenis, segmen ZKC-SAM, bulan Romawi, tahun —
// contoh 014/KSM/ZKC-SAM/XI/2026.
export function formatNomorSurat(urut: number, kode: string, tanggal: Date): string {
  return `${String(urut).padStart(3, "0")}/${kode}/ZKC-SAM/${bulanRomawi(tanggal.getMonth() + 1)}/${tanggal.getFullYear()}`;
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
