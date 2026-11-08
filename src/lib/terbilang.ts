// Terbilang bahasa Indonesia untuk kwitansi.
const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

function bawahSeratus(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  const puluh = Math.floor(n / 10);
  const sisa = n % 10;
  return `${SATUAN[puluh]} puluh${sisa ? ` ${SATUAN[sisa]}` : ""}`;
}

function bawahSeribu(n: number): string {
  if (n < 100) return bawahSeratus(n);
  const ratus = Math.floor(n / 100);
  const sisa = n % 100;
  const depan = ratus === 1 ? "seratus" : `${SATUAN[ratus]} ratus`;
  return `${depan}${sisa ? ` ${bawahSeratus(sisa)}` : ""}`;
}

export function terbilang(nilai: number): string {
  const n = Math.round(Math.abs(nilai));
  if (n === 0) return "nol rupiah";
  const bagian: Array<[number, string]> = [
    [1_000_000_000_000, "triliun"],
    [1_000_000_000, "miliar"],
    [1_000_000, "juta"],
    [1_000, "ribu"],
  ];
  const kata: string[] = [];
  let sisa = n;
  for (const [angka, nama] of bagian) {
    const jumlah = Math.floor(sisa / angka);
    if (jumlah > 0) {
      if (angka === 1_000 && jumlah === 1) kata.push("seribu");
      else kata.push(`${bawahSeribu(jumlah)} ${nama}`);
      sisa %= angka;
    }
  }
  if (sisa > 0) kata.push(bawahSeribu(sisa));
  const teks = kata.join(" ").replace(/\s+/g, " ").trim();
  return `${teks.charAt(0).toUpperCase()}${teks.slice(1)} rupiah`;
}
