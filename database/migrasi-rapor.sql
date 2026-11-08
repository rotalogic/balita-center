-- Rapor periodik: lengkapi struktur sesuai referensi portal lama.
-- cycle_reports sebelumnya hanya punya 5 kolom narasi STPPA; rapor referensi
-- memuat 6 aspek STPPA (termasuk Seni), 5 narasi Area Montessori, Kesimpulan,
-- dan Saran untuk Orang Tua. health_checks mendapat kolom status gizi supaya
-- Ringkasan Tumbuh Kembang rapor bisa menampilkannya (label manusiawi di UI,
-- bukan kode mentah). Aman dijalankan berulang.

ALTER TABLE cycle_reports
  ADD COLUMN IF NOT EXISTS narrative_seni TEXT,
  ADD COLUMN IF NOT EXISTS narrative_practical_life TEXT,
  ADD COLUMN IF NOT EXISTS narrative_language TEXT,
  ADD COLUMN IF NOT EXISTS narrative_sensorial TEXT,
  ADD COLUMN IF NOT EXISTS narrative_mathematics TEXT,
  ADD COLUMN IF NOT EXISTS narrative_cultural TEXT,
  ADD COLUMN IF NOT EXISTS conclusion TEXT,
  ADD COLUMN IF NOT EXISTS parent_suggestion TEXT;

ALTER TABLE health_checks
  ADD COLUMN IF NOT EXISTS nutrition_status VARCHAR(24)
    CHECK (nutrition_status IN ('gizi_baik', 'gizi_kurang', 'gizi_lebih', 'obesitas', 'stunting'));
