// Penataan nama lead: nama orang tua dan nama anak tidak boleh tertukar, dan
// usia anak tidak boleh menempel di nama. Bila ragu, data dibiarkan apa adanya
// tetapi ditandai "perlu ditinjau" — jangan mengarang nama (Blok 2 Jilid 5).

const ORANG_DEWASA = /^(ibu|bapak|pak|bu|bunda|ayah|mama|papa|om|tante)\b/i;
const POLA_USIA = /[,;]?\s*(\d{1,2})\s*(tahun|thn|tahun\s+lebih|bulan)\b/i;

export type HasilRapikan = {
  parent_name: string | null;
  child_name: string | null;
  child_age_months: number | null;
  perlu_tinjau: boolean;
  alasan: string | null;
};

export function rapikanLead(
  parentMasuk: string | undefined | null,
  childMasuk: string | undefined | null,
  umurMasuk: number | string | undefined | null
): HasilRapikan {
  let parent = (parentMasuk || "").trim();
  let child = (childMasuk || "").trim();
  let umur: number | null =
    umurMasuk === undefined || umurMasuk === null || umurMasuk === "" ? null : Number(umurMasuk);
  if (umur !== null && !Number.isFinite(umur)) umur = null;

  let alasan: string | null = null;

  // Usia menempel di nama anak: "Anak Uji B, 4 tahun" -> umur 48 bulan.
  const usia = child.match(POLA_USIA);
  if (usia) {
    if (umur === null) {
      const angka = Number(usia[1]);
      umur = /bulan/i.test(usia[2]) ? angka : angka * 12;
    }
    child = child.replace(POLA_USIA, "").replace(/[,;]\s*$/, "").trim();
    alasan = "Usia dipisahkan dari nama anak.";
  }

  // Nama orang tua masuk ke kolom anak.
  if (!parent && child && ORANG_DEWASA.test(child) && child.split(/\s+/).length <= 4) {
    parent = child;
    child = "";
    alasan = `${alasan ? alasan + " " : ""}Nama orang tua dipindahkan dari kolom anak.`;
  }

  // Nama anak yang jelas-jelas nama dewasa padahal kolom orang tua sudah terisi.
  if (parent && child && ORANG_DEWASA.test(child)) {
    alasan = `${alasan ? alasan + " " : ""}Kolom anak berisi panggilan orang dewasa — perlu ditinjau.`;
  }

  return {
    parent_name: parent || null,
    child_name: child || null,
    child_age_months: umur,
    perlu_tinjau: Boolean(alasan),
    alasan,
  };
}
