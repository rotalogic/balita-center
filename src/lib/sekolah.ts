import { query } from "./db";

// Identitas sekolah (school_settings, baris tunggal) — dipakai kop dokumen
// resmi dan pemberitahuan. Nilai bawaan menjaga dokumen tetap benar
// sebelum admin mengisi identitas sekolahnya sendiri.

export type Identitas = {
  nama: string;
  tagline: string;
  alamat: string | null;
  telepon: string | null;
  email: string | null;
  logo_url: string | null;
};

const BAWAAN: Identitas = {
  nama: "Balita Center",
  tagline: "Montessori & Childcare",
  alamat: null,
  telepon: null,
  email: null,
  logo_url: null,
};

let cache: { data: Identitas; at: number } | null = null;

export async function getIdentitas(paksa = false): Promise<Identitas> {
  if (!paksa && cache && Date.now() - cache.at < 15000) return cache.data;
  let data = BAWAAN;
  try {
    const rows = await query<Identitas>("SELECT nama, tagline, alamat, telepon, email, logo_url FROM school_settings WHERE id = 1");
    if (rows[0]) data = { ...BAWAAN, ...rows[0] };
  } catch {
    /* database belum bermigrasi — pakai nilai bawaan */
  }
  cache = { data, at: Date.now() };
  return data;
}

// Baris kop dokumen, mis. "BALITA CENTER — MONTESSORI & CHILDCARE".
export function kopLengkap(i: Identitas): string {
  return i.tagline ? `${i.nama} — ${i.tagline}` : i.nama;
}
