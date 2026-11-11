// Rangka sesi resmi lembaga: 9 segmen ZKC berurutan dan penanda Fokus Amati
// Anekdotal Record SAM. Acuan: Prompt Gabungan ZKC & SAM, Modul Laporan Harian.

export const SEGMEN_ZKC = [
  { kunci: "connect_arrival", label: "Connect & Arrival", petunjuk: "Kedatangan anak, sambutan, dan transisi masuk ke sesi" },
  { kunci: "circle_time_lagu", label: "Circle Time & Lagu", petunjuk: "Lingkaran pembuka, lagu, dan kebersamaan kelompok" },
  { kunci: "senam", label: "Senam", petunjuk: "Gerak pagi dan pemanasan tubuh" },
  { kunci: "read_aloud", label: "Read Aloud", petunjuk: "Membaca nyaring dan respons anak terhadap cerita" },
  { kunci: "sensory_explore", label: "Sensory Explore", petunjuk: "Integrasi sensori dan sensory processing lewat eksplorasi bahan" },
  { kunci: "movement", label: "Movement", petunjuk: "Gerak terarah dan kesadaran tubuh" },
  { kunci: "basic_life_skills", label: "Basic & Life Skills", petunjuk: "Kemandirian dasar dan keterampilan hidup sehari-hari" },
  { kunci: "cooling_down", label: "Cooling Down", petunjuk: "Menurunkan energi dan menenangkan tubuh" },
  { kunci: "recall_doa", label: "Recall & Doa", petunjuk: "Mengingat kembali hari ini dan menutup dengan doa" },
] as const;

export type SegmenZkc = (typeof SEGMEN_ZKC)[number]["kunci"];

export const LABEL_SEGMEN: Record<string, string> = Object.fromEntries(
  SEGMEN_ZKC.map((s) => [s.kunci, s.label])
);

export const FOKUS_AMATI = [
  { kunci: "material", label: "Material" },
  { kunci: "masa_peka", label: "Masa Peka" },
  { kunci: "normalisasi", label: "Normalisasi" },
  { kunci: "islamic_living", label: "Islamic Living" },
  { kunci: "grace_courtesy", label: "Grace & Courtesy" },
] as const;

export type FokusAmati = (typeof FOKUS_AMATI)[number]["kunci"];

export const LABEL_FOKUS: Record<string, string> = Object.fromEntries(
  FOKUS_AMATI.map((f) => [f.kunci, f.label])
);
