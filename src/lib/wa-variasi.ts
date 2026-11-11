// Mesin variasi pesan WhatsApp keluar.
// Setiap pesan yang dikirim lewat gateway OpenWA dibuat berbeda dari pesan
// lainnya memakai dua cara yang jujur dan terbaca manusia:
//   1) Spintax pada templat: {Halo|Hai|Selamat pagi} — satu pilihan diambil
//      per pesan, dapat bersarang dan berulang.
//   2) Placeholder per penerima: {nama}, {nama_anak}, dan {salam} (sapaan
//      mengikuti jam Asia/Jakarta: pagi/siang/sore/malam).
// Pilihan ditentukan PRNG berbenih dari id antrean, sehingga variasi tiap
// pesan berbeda tetapi dapat direproduksi persis untuk keperluan audit.

export function benihDari(teks: string): number {
  let h = 2166136261;
  for (let i = 0; i < teks.length; i++) {
    h ^= teks.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function salamSekarang(pada: Date = new Date()): string {
  const jam = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(pada)
  );
  if (jam >= 4 && jam < 11) return "Selamat pagi";
  if (jam >= 11 && jam < 15) return "Selamat siang";
  if (jam >= 15 && jam < 19) return "Selamat sore";
  return "Selamat malam";
}

export type KonteksVariasi = { nama?: string; nama_anak?: string };

export function variasikan(teks: string, konteks: KonteksVariasi, seed: number): string {
  // Benih dicampur dulu (hash atas representasi benih) agar dua benih yang
  // berdekatan tetap menghasilkan pilihan yang menyebar — tanpa ini, benih
  // berurutan dapat memberi variasi yang sama pada banyak pesan.
  const acak = mulberry32(benihDari(`variasi:${seed}`));
  let hasil = teks;
  // Spintax: selesaikan kelompok terdalam lebih dulu, ulangi sampai bersih.
  for (let putaran = 0; putaran < 12; putaran++) {
    const cocok = /\{([^{}]*\|[^{}]*)\}/.exec(hasil);
    if (!cocok) break;
    const opsi = cocok[1].split("|");
    const pilih = opsi[Math.min(opsi.length - 1, Math.floor(acak() * opsi.length))];
    hasil = hasil.slice(0, cocok.index) + pilih + hasil.slice(cocok.index + cocok[0].length);
  }
  hasil = hasil
    .replaceAll("{nama}", konteks.nama || "")
    .replaceAll("{nama_anak}", konteks.nama_anak || "")
    .replaceAll("{salam}", salamSekarang());
  return hasil.replace(/[ \t]{2,}/g, " ").replace(/ +([,.!?])/g, "$1").trim();
}

// Tiga contoh variasi dari satu templat — untuk pratinjau di layar admin.
export function contohVariasi(teks: string, konteks: KonteksVariasi): string[] {
  const dasar = benihDari(teks + (konteks.nama || ""));
  return [0, 1, 2].map((i) => variasikan(teks, konteks, dasar + i * 7919));
}
