// Jadwal sesi & kuota — aturan terkunci Modul Penerimaan ZKC & SAM.
// Server menolak: sesi yang melewati jam istirahat guru 12.00–13.00, dan
// Pendampingan Individual / Kelas Movement yang mulai sebelum 13.00.

export type JenisSesi =
  | "trial_zkc" | "asesmen_zkc" | "reguler_zkc" | "community_class"
  | "movement" | "pendampingan_individual" | "discovery_sam" | "nido" | "casa";

export const JENIS_SESI: Record<JenisSesi, { label: string; durasiMenit: number; kuotaBawaan: number; sesudah13?: boolean }> = {
  trial_zkc: { label: "Trial ZKC", durasiMenit: 60, kuotaBawaan: 10 },
  asesmen_zkc: { label: "Asesmen ZKC", durasiMenit: 60, kuotaBawaan: 10 },
  reguler_zkc: { label: "Kelas Reguler ZKC", durasiMenit: 60, kuotaBawaan: 10 },
  community_class: { label: "Community Class", durasiMenit: 60, kuotaBawaan: 10 },
  movement: { label: "Kelas Movement", durasiMenit: 90, kuotaBawaan: 6, sesudah13: true },
  pendampingan_individual: { label: "Pendampingan Individual", durasiMenit: 60, kuotaBawaan: 1, sesudah13: true },
  discovery_sam: { label: "Discovery SAM", durasiMenit: 90, kuotaBawaan: 4 },
  nido: { label: "Sesi NIDO (SAM)", durasiMenit: 120, kuotaBawaan: 10 },
  casa: { label: "Sesi CASA (SAM)", durasiMenit: 180, kuotaBawaan: 15 },
};

export const ISTIRAHAT_MULAI = 12 * 60;
export const ISTIRAHAT_SELESAI = 13 * 60;

function keMenit(jam: string): number | null {
  const cocok = /^(\d{1,2}):(\d{2})/.exec(jam || "");
  if (!cocok) return null;
  const j = Number(cocok[1]);
  const m = Number(cocok[2]);
  if (j > 23 || m > 59) return null;
  return j * 60 + m;
}

export function keJam(menit: number): string {
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  return `${String(j).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type HasilValidasiJadwal =
  | { ok: true; jamSelesai: string }
  | { ok: false; error: string };

// Memvalidasi satu sesi terhadap aturan terkunci dan menghitung jam selesai
// dari durasi resmi jenis sesinya (durasi tidak dapat diubah dari formulir).
export function validasiJadwal(jenis: JenisSesi, jamMulai: string): HasilValidasiJadwal {
  const info = JENIS_SESI[jenis];
  if (!info) return { ok: false, error: "Jenis sesi tidak dikenal." };
  const mulai = keMenit(jamMulai);
  if (mulai === null) return { ok: false, error: "Jam mulai tidak sah (format JJ:MM)." };
  const selesai = mulai + info.durasiMenit;
  if (selesai > 24 * 60) return { ok: false, error: "Sesi melewati tengah malam; periksa jam mulai." };
  if (info.sesudah13 && mulai < ISTIRAHAT_SELESAI) {
    return {
      ok: false,
      error: `${info.label} hanya dapat dijadwalkan sesudah pukul 13.00 (aturan jadwal terkunci).`,
    };
  }
  if (mulai < ISTIRAHAT_SELESAI && selesai > ISTIRAHAT_MULAI) {
    return {
      ok: false,
      error: "Sesi melewati jam istirahat guru pukul 12.00–13.00, saat tidak ada sesi apa pun (aturan jadwal terkunci).",
    };
  }
  return { ok: true, jamSelesai: keJam(selesai) };
}
