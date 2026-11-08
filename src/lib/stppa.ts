// Satu-satunya sumber daftar aspek STPPA.
// Dipakai oleh: API (/api/academic), UI editor, validasi impor CSV, ekspor,
// dan cermin CHECK constraint stppa_items_aspect_check (migrasi-blok-3.sql).
// Kalau daftar ini berubah, ubah migrasi + komentar ini sekaligus.
export const ASPEK_STPPA = [
  { code: "nilai_agama_moral", label: "Nilai Agama & Moral" },
  { code: "motorik_kasar", label: "Motorik Kasar" },
  { code: "motorik_halus", label: "Motorik Halus" },
  { code: "bahasa", label: "Bahasa" },
  { code: "kognitif", label: "Kognitif" },
  { code: "sosial_emosional", label: "Sosial Emosional" },
  { code: "kemandirian", label: "Kemandirian" },
] as const;

export type AspekCode = (typeof ASPEK_STPPA)[number]["code"];

export const KODE_ASPEK: string[] = ASPEK_STPPA.map((a) => a.code);

// Terima kode ("motorik_kasar") maupun label ("Motorik Kasar"/"Nilai Agama"),
// supaya isi CSV karangan guru tidak gagal total hanya karena beda penulisan.
export function aspekDari(teks: string): AspekCode | null {
  const t = teks.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!t) return null;
  const langsung = ASPEK_STPPA.find((a) => a.code.replace(/_/g, " ") === t);
  if (langsung) return langsung.code;
  const persis = ASPEK_STPPA.find((a) => a.label.toLowerCase() === t);
  if (persis) return persis.code;
  // "Nilai Agama" (tanpa "& Moral") tetap diterima.
  const sebagian = ASPEK_STPPA.find((a) => a.label.toLowerCase().startsWith(t) || t.startsWith(a.label.toLowerCase()));
  return sebagian ? sebagian.code : null;
}

export function labelAspek(code: string): string {
  return ASPEK_STPPA.find((a) => a.code === code)?.label || code;
}
