"use client";

// Tombol cetak kecil: PDF dibuat lewat dialog cetak peramban (tanpa pustaka PDF).
export function TombolCetak() {
  return (
    <button type="button" className="utama" onClick={() => window.print()}>
      Cetak / Simpan PDF
    </button>
  );
}
