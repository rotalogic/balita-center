import { query } from "./db";

// Identitas lembaga (school_settings, baris tunggal) — dipakai kop dokumen
// resmi, pemberitahuan, dan website. Kop resmi adalah susunan tiga baris
// yang terkunci: yayasan, nama gabungan dua rumah, tagline gabungan.
// Nilai bawaan menjaga dokumen tetap benar sebelum admin mengisi identitas.

export type Identitas = {
  nama: string;
  tagline: string;
  alamat: string | null;
  telepon: string | null;
  email: string | null;
  logo_url: string | null;
  nama_yayasan: string;
  nama_gabungan: string;
  tagline_gabungan: string;
  visi: string | null;
  misi: string | null;
  motto: string | null;
  warna_zkc: string;
  warna_sam: string;
};

const BAWAAN: Identitas = {
  nama: "Balita Center",
  tagline: "Montessori & Childcare",
  alamat: null,
  telepon: null,
  email: null,
  logo_url: null,
  nama_yayasan: "Yayasan Tunas Pelita Cakrawala Insani",
  nama_gabungan: "Ziel Kids Club & Sekolah Alam Montessori",
  tagline_gabungan:
    "Understanding Children. Strengthening Families. Learning Naturally. Growing Meaningfully.",
  visi: "Mewujudkan generasi anak yang bertumbuh utuh dan berkarakter, berakar pada nilai Islam, melalui pendidikan yang memahami anak dan menguatkan keluarga",
  misi: "Menyelenggarakan pendampingan perkembangan anak dan pendidikan Montessori autentik berbasis observasi\nMenguatkan keluarga sebagai mitra utama dalam perjalanan tumbuh kembang anak\nMenumbuhkan kesadaran literasi dan deteksi dini yang inklusif bagi masyarakat",
  motto: "Tumbuh Bersama. Menerangi Masa Depan.",
  warna_zkc: "#8A6844",
  warna_sam: "#4F7A54",
};

let cache: { data: Identitas; at: number } | null = null;

export async function getIdentitas(paksa = false): Promise<Identitas> {
  if (!paksa && cache && Date.now() - cache.at < 15000) return cache.data;
  let data = BAWAAN;
  try {
    const rows = await query<Identitas>(
      `SELECT nama, tagline, alamat, telepon, email, logo_url,
              nama_yayasan, nama_gabungan, tagline_gabungan, visi, misi, motto,
              warna_zkc, warna_sam
         FROM school_settings WHERE id = 1`
    );
    if (rows[0]) data = { ...BAWAAN, ...rows[0] };
  } catch {
    /* database belum bermigrasi — pakai nilai bawaan */
  }
  cache = { data, at: Date.now() };
  return data;
}

// Baris kop satu baris (warisan), mis. "BALITA CENTER — MONTESSORI & CHILDCARE".
export function kopLengkap(i: Identitas): string {
  return i.tagline ? `${i.nama} — ${i.tagline}` : i.nama;
}

// Kop resmi tiga baris yang terkunci untuk kop sistem, laporan, surat, website.
export function kopTigaBaris(i: Identitas): [string, string, string] {
  return [i.nama_yayasan, i.nama_gabungan, i.tagline_gabungan];
}
