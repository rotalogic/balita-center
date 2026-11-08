// Format tanggal & jam untuk seluruh UI. Zona waktu dikunci Asia/Jakarta
// supaya tanggal tidak bergeser sehari karena zona peramban.
const ZONA = "Asia/Jakarta";

export function tanggalPanjang(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ZONA,
  }).format(date);
}

export function tanggalPendek(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: ZONA,
  }).format(date);
}

// Terima "12:00", "12.00", atau timestamp ISO penuh ("2026-11-04T15:10:45Z").
// Dulu ISO dipotong 5 karakter -> "2026-" di layar.
export function jamRapi(value?: string | null): string {
  if (!value) return "--:--";
  const s = String(value).trim();
  if (/^\d{1,2}[:.]\d{2}$/.test(s)) return s.replace(".", ":");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 5);
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONA,
  }).format(d).replace(".", ":");
}

// Terima "1200", "12.00", "12:00", "1230" -> "12:00" / "12:30".
export function normalisasiJam(input: string): string | null {
  const bersih = input.replace(/[^0-9]/g, "");
  if (bersih.length === 0) return "";
  // 3 digit hanya diterima bila menitnya masuk akal (mis. "930" -> 09:30).
  // "120" akan jadi 01:20 — itu sebabnya input "1200" dulu berubah di tengah jalan.
  if (bersih.length === 3) {
    const jam = Number(bersih.slice(0, 1));
    const menit = Number(bersih.slice(1));
    return jam <= 23 && menit <= 59 ? `${String(jam).padStart(2, "0")}:${String(menit).padStart(2, "0")}` : null;
  }
  if (bersih.length !== 4) return null;
  const jam = Number(bersih.slice(0, 2));
  const menit = Number(bersih.slice(2));
  if (jam > 23 || menit > 59) return null;
  return `${String(jam).padStart(2, "0")}:${String(menit).padStart(2, "0")}`;
}
