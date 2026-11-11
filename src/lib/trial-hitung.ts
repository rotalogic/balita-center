import {
  filterArah,
  filterSam,
  umurBulan,
  type GugusSamAnak,
  type KeluaranArah,
  type KeluaranSam,
} from "@/lib/filter-arah";

// Menghitung Filter SAM lalu Filter Arah dari isian Formulir Trial.
// Dipakai bersama oleh pembuatan dan pembaruan formulir.
export function hitungSemua(input: {
  tanggalLahir?: string | null;
  umurFallback?: number | null;
  pilihan: "ZKC" | "SAM";
  sinyalDukungan: boolean;
  samAnak?: Record<string, unknown> | null;
  samOrtu?: unknown;
}): { umurBulan: number | null; sam: KeluaranSam; arah: KeluaranArah | null } {
  const umur =
    input.tanggalLahir && /^\d{4}-\d{2}-\d{2}/.test(input.tanggalLahir)
      ? umurBulan(input.tanggalLahir.slice(0, 10))
      : typeof input.umurFallback === "number"
        ? input.umurFallback
        : null;

  let sam: KeluaranSam = null;
  if (input.pilihan === "SAM" && input.samAnak && typeof input.samAnak === "object") {
    const anak: Partial<Record<GugusSamAnak, number>> = {};
    for (const [k, v] of Object.entries(input.samAnak as Record<string, unknown>)) {
      const n = Number(v);
      if (n >= 1 && n <= 4) anak[k as GugusSamAnak] = n;
    }
    const ortu = Array.isArray(input.samOrtu) ? input.samOrtu.map((v) => Number(v)) : [];
    sam = filterSam({ anak, ortu });
  }

  if (umur === null) return { umurBulan: null, sam, arah: null };
  const arah = filterArah({
    umurBulan: umur,
    pilihanOrtu: input.pilihan,
    sinyalDukunganKonsisten: input.sinyalDukungan,
    sam,
  });
  return { umurBulan: umur, sam, arah };
}
