-- Migrasi Penyempurnaan mengikuti Tur Demo Sistem Terpadu ZKC & SAM
-- (perintah pemilik 15 Nov 2026). Tiga perubahan:
-- 1) Penanda laporan harian sudah dibaca orang tua dari Balita Connect,
--    menutup garis riwayat Satu Meja Laporan (Draf > Periksa > Setujui >
--    Terbit > Terbaca).
-- 2) Tabel paket_sesi_anak: paket sesi berbayar per anak (mis. Movement
--    10x) agar Riwayat Sesi & Sisa Paket di berkas anak punya sumber data
--    resmi, bukan hitungan karangan. Sesi terpakai dihitung dari
--    child_attendance berstatus hadir sejak tanggal paket mulai.
-- Aman dijalankan berulang (IF NOT EXISTS).

ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS dibaca_ortu_at timestamptz;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS dibaca_ortu_nama text;

CREATE TABLE IF NOT EXISTS paket_sesi_anak (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid,
  child_id uuid NOT NULL REFERENCES children(id),
  nama_paket text NOT NULL,
  total_sesi integer NOT NULL CHECK (total_sesi > 0),
  mulai_pada date NOT NULL,
  selesai_pada date,
  status text NOT NULL DEFAULT 'aktif',
  catatan text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paket_sesi_anak_child
  ON paket_sesi_anak (child_id, status);
