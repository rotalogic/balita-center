-- Migrasi ZKC Tahap 3e: Modul Program Event — edisi (termasuk seri Pop Up
-- Class Grand Mercure 18 edisi, THE BAREFOOT, Holiday Camp), Dokumen &
-- Anggaran Edisi (RAB rencana/realisasi), peserta dari Formulir Insidentil,
-- dan Laporan Ringan Pop Up enam aspek bernilai kata.
-- Acuan: Prompt Gabungan Sistem & Website ZKC & SAM (Modul Program Event).
BEGIN;

CREATE TABLE IF NOT EXISTS event_edisi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  jenis VARCHAR(24) NOT NULL
    CHECK (jenis IN ('pop_up','seminar','event_alam','edukasi','barefoot','holiday_camp','lainnya')),
  nama VARCHAR(200) NOT NULL,
  tema VARCHAR(200),
  tanggal DATE,
  kuota INTEGER,
  htm_reguler NUMERIC(12,2),
  htm_early_bird NUMERIC(12,2),
  persen_bagi_hasil NUMERIC(5,2) NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'rancangan'
    CHECK (status IN ('rancangan','buka','tutup','selesai')),
  proposal_url TEXT,
  rundown TEXT,
  surat_ref TEXT,
  catatan TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_edisi_branch ON event_edisi (branch_id, tanggal);

CREATE TABLE IF NOT EXISTS event_rab (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edisi_id UUID NOT NULL REFERENCES event_edisi(id) ON DELETE CASCADE,
  pos VARCHAR(200) NOT NULL,
  rencana NUMERIC(12,2) NOT NULL DEFAULT 0,
  realisasi NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_event_rab_edisi ON event_rab (edisi_id, sort_order);

ALTER TABLE insidentil
  ADD COLUMN IF NOT EXISTS event_edisi_id UUID REFERENCES event_edisi(id),
  ADD COLUMN IF NOT EXISTS tarif_jenis VARCHAR(16) CHECK (tarif_jenis IN ('reguler','early_bird')),
  ADD COLUMN IF NOT EXISTS bayar_status VARCHAR(16) NOT NULL DEFAULT 'belum'
    CHECK (bayar_status IN ('belum','lunas')),
  ADD COLUMN IF NOT EXISTS closing_lead_id UUID REFERENCES leads(id);

CREATE TABLE IF NOT EXISTS laporan_ringan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insidentil_id UUID NOT NULL UNIQUE REFERENCES insidentil(id) ON DELETE CASCADE,
  -- Tepat enam aspek [{label, nilai}] — nilai kata Bersinar/Muncul/Berlatih.
  aspek JSONB NOT NULL DEFAULT '[]',
  catatan TEXT,
  saluran VARCHAR(16) CHECK (saluran IN ('whatsapp','email')),
  dikirim_at TIMESTAMPTZ,
  dikirim_oleh UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seri Pop Up Class Grand Mercure: 18 edisi (12 bulanan + 6 liburan), HTM
-- resmi lembaga, bagi hasil hotel 20%. Tema menyusul dari lembaga.
DO $$
DECLARE b UUID;
BEGIN
  SELECT id INTO b FROM branches ORDER BY created_at LIMIT 1;
  IF b IS NOT NULL AND NOT EXISTS (SELECT 1 FROM event_edisi WHERE jenis = 'pop_up') THEN
    INSERT INTO event_edisi (branch_id, jenis, nama, htm_reguler, htm_early_bird, persen_bagi_hasil, status)
    SELECT b, 'pop_up', 'Pop Up Class Grand Mercure — Edisi Bulanan ' || g, 125000, 100000, 20, 'rancangan'
      FROM generate_series(1, 12) AS g;
    INSERT INTO event_edisi (branch_id, jenis, nama, htm_reguler, htm_early_bird, persen_bagi_hasil, status)
    SELECT b, 'pop_up', 'Pop Up Class Grand Mercure — Edisi Liburan ' || g, 125000, 100000, 20, 'rancangan'
      FROM generate_series(1, 6) AS g;
  END IF;
  IF b IS NOT NULL AND NOT EXISTS (SELECT 1 FROM event_edisi WHERE jenis = 'barefoot') THEN
    INSERT INTO event_edisi (branch_id, jenis, nama, status, rundown)
    VALUES (b, 'barefoot', 'THE BAREFOOT', 'rancangan',
      '07.30 Gathering' || chr(10) ||
      '08.00–08.15 Opening Circle: doa, nafas lebah, nafas api, nafas naga, dan tadabur alam dengan pengiring murottal serta lagu relaksasi alam' || chr(10) ||
      'Alur 1: gambar hewan' || chr(10) ||
      'Alur 2: ladder yang ditempatkan mendatar di tanah, mainan lompat tali, dan engklek' || chr(10) ||
      'Alur 3: Water Exploration — Bak IKEA, sabun cuci, lap, spons, dan mainan bubble bawaan tim' || chr(10) ||
      'Kegiatan penanaman' || chr(10) ||
      'Cicip Rasa Tradisional (data alergi peserta wajib terbaca sebelum kegiatan)' || chr(10) ||
      'Penutup: Yoga Anak dan Savasana bersama, makan bersama, Lingkaran Cerita, Sesi Parenting, pengenalan SAM, dan doa' || chr(10) ||
      'Catatan agenda final: tidak memakai lempung atau tanah liat, gambar ikan, dan cotton bud dalam bentuk apa pun.');
  END IF;
  IF b IS NOT NULL AND NOT EXISTS (SELECT 1 FROM event_edisi WHERE jenis = 'holiday_camp') THEN
    -- Holiday Camp Ziel Kids Club: Tutup sampai HTM ditetapkan.
    INSERT INTO event_edisi (branch_id, jenis, nama, status)
    VALUES (b, 'holiday_camp', 'Holiday Camp Ziel Kids Club', 'tutup');
  END IF;
END $$;

COMMIT;
