// Konstanta dan tipe rapor periodik yang aman dipakai di klien maupun server.
// Fungsi agregasi yang menyentuh database ada di src/lib/rapor.ts.

export const NARASI_STPPA: Array<[string, string]> = [
  ["narrative_agama_moral", "Nilai Agama dan Moral"],
  ["narrative_fisik_motorik", "Fisik-Motorik"],
  ["narrative_kognitif", "Kognitif"],
  ["narrative_bahasa", "Bahasa"],
  ["narrative_sosial_emosional", "Sosial-Emosional dan Kemandirian"],
  ["narrative_seni", "Seni"],
];

export const NARASI_MONTESSORI: Array<[string, string]> = [
  ["narrative_practical_life", "Practical Life"],
  ["narrative_language", "Language"],
  ["narrative_sensorial", "Sensorial"],
  ["narrative_mathematics", "Mathematics"],
  ["narrative_cultural", "Cultural"],
];

export const KOLOM_NARASI: string[] = [
  ...NARASI_STPPA.map(([k]) => k),
  ...NARASI_MONTESSORI.map(([k]) => k),
  "conclusion",
  "parent_suggestion",
];

const GIZI: Record<string, string> = {
  gizi_baik: "Gizi Baik",
  gizi_kurang: "Gizi Kurang",
  gizi_lebih: "Gizi Lebih",
  obesitas: "Obesitas",
  stunting: "Stunting",
};

// Label manusiawi untuk status gizi. Kode mentah (mis. "GIZI_BAIK") tidak
// boleh tampil ke orang tua — pelajaran dari kebocoran enum di portal lama.
export function labelGizi(v?: string | null): string {
  if (!v) return "-";
  return GIZI[v] || v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type AgregatRapor = {
  hadir: number;
  izin: number;
  sakit: number;
  tanpa_keterangan: number;
  hari_sekolah: number;
  tanpa_catatan: number;
  catatan_harian: number;
  berat_kg: string | null;
  tinggi_cm: string | null;
  lingkar_kepala_cm: string | null;
  status_gizi: string | null;
  tanggal_ukur: string | null;
  foto: Array<{ url: string; caption: string | null; media_type?: string; poster_url?: string | null }>;
};
