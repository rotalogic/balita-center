-- Blok 3A — satu sumber aspek STPPA (7 aspek), butir bisa dinonaktifkan.
-- Aman dijalankan berulang.

-- 1) Longgarkan dulu supaya UPDATE pemecahan fisik_motorik tidak ditolak.
ALTER TABLE stppa_items DROP CONSTRAINT IF EXISTS stppa_items_aspect_check;

-- 2) Pecah aspek lama "fisik_motorik" jadi kasar + halus (data lama tetap aman).
UPDATE stppa_items SET aspect = 'motorik_kasar' WHERE aspect = 'fisik_motorik';

-- 3) Kunci ulang ke 7 aspek — sama persis dengan ASPEK di src/lib/stppa.ts.
ALTER TABLE stppa_items ADD CONSTRAINT stppa_items_aspect_check CHECK (aspect IN (
  'nilai_agama_moral','motorik_kasar','motorik_halus','bahasa','kognitif','sosial_emosional','kemandirian'
));

-- 4) Butir bisa dinonaktifkan tanpa dihapus (riwayat penilaian tetap utuh).
ALTER TABLE stppa_items ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 5) Cegah butir kembar saat impor CSV diulang.
CREATE UNIQUE INDEX IF NOT EXISTS stppa_items_unik
    ON stppa_items (age_group, aspect, lower(item_text));
