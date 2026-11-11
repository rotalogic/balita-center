// Konstanta Modul Program Event (aman untuk klien). Aturan branding lembaga:
// event ke alam membawa nama Sekolah Alam Montessori; event reguler membawa
// nama Ziel Kids Club. Rundown event ZKC memakai istilah Kemandirian / Life
// Skills — nama area Practical Life hanya hidup pada konteks SAM.

export const JENIS_EVENT: Array<[string, string]> = [
  ["pop_up", "Pop Up Class"],
  ["seminar", "Seminar"],
  ["event_alam", "Event Alam (SAM)"],
  ["edukasi", "Acara Edukasi"],
  ["barefoot", "THE BAREFOOT"],
  ["holiday_camp", "Holiday Camp"],
  ["lainnya", "Event Lainnya"],
];

export const LABEL_JENIS_EVENT: Record<string, string> = Object.fromEntries(JENIS_EVENT);

export function merekEvent(jenis: string): string {
  return jenis === "event_alam" || jenis === "barefoot"
    ? "Sekolah Alam Montessori"
    : "Ziel Kids Club";
}

// Angka anggaran edisi hanya terlihat oleh founder & manager (hak akses
// keuangan) — selalu ditegakkan di server, bukan sekadar disembunyikan di UI.
export function bolehKeuangan(user: { roles: string[]; role: string }): boolean {
  return [...user.roles, user.role].some((r) =>
    ["owner", "super_admin", "branch_manager", "founder", "staf_keuangan", "kepala_sekolah"].includes(r)
  );
}

export const STATUS_EDISI: Record<string, string> = {
  rancangan: "Rancangan",
  buka: "Pendaftaran Buka",
  tutup: "Tutup",
  selesai: "Selesai",
};

export type BarisPesertaEvent = { tarif_jenis: string | null; bayar_status: string };
export type BarisRab = { rencana: string | number; realisasi: string | number };

export type RingkasanEdisi = {
  peserta_terdaftar: number;
  peserta_lunas: number;
  pemasukan_reguler: number;
  pemasukan_early_bird: number;
  total_pemasukan: number;
  bagi_hasil: number;
  total_rencana: number;
  total_realisasi: number;
  sisa_bersih: number;
};

// Ringkasan otomatis edisi dari data peserta & pembayaran yang tercatat:
// pemasukan HTM dibedakan reguler/early bird, bagi hasil dari total
// pemasukan, sisa bersih = pemasukan − bagi hasil − realisasi biaya.
export function hitungRingkasanEdisi(
  peserta: BarisPesertaEvent[],
  rab: BarisRab[],
  htmReguler: number,
  htmEarlyBird: number,
  persenBagiHasil: number
): RingkasanEdisi {
  const lunas = peserta.filter((p) => p.bayar_status === "lunas");
  const pemasukanReguler = lunas.filter((p) => p.tarif_jenis !== "early_bird").length * htmReguler;
  const pemasukanEarly = lunas.filter((p) => p.tarif_jenis === "early_bird").length * htmEarlyBird;
  const totalPemasukan = pemasukanReguler + pemasukanEarly;
  const bagiHasil = Math.round((totalPemasukan * persenBagiHasil) / 100);
  const totalRencana = rab.reduce((s, r) => s + Number(r.rencana || 0), 0);
  const totalRealisasi = rab.reduce((s, r) => s + Number(r.realisasi || 0), 0);
  return {
    peserta_terdaftar: peserta.length,
    peserta_lunas: lunas.length,
    pemasukan_reguler: pemasukanReguler,
    pemasukan_early_bird: pemasukanEarly,
    total_pemasukan: totalPemasukan,
    bagi_hasil: bagiHasil,
    total_rencana: totalRencana,
    total_realisasi: totalRealisasi,
    sisa_bersih: totalPemasukan - bagiHasil - totalRealisasi,
  };
}
