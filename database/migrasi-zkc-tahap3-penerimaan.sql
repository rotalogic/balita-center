-- Migrasi ZKC Tahap 3a: Penerimaan — pipeline 8 tahap, Formulir Trial,
-- Filter Arah & Filter SAM, ACC guru, jadwal sesi dengan kuota & aturan terkunci.
-- Acuan: Prompt Gabungan Sistem & Website ZKC & SAM (Modul Penerimaan).
BEGIN;

-- 1) Pipeline Admission menjadi 8 tahap penerimaan.
UPDATE leads SET stage = CASE stage
  WHEN 'lead_masuk' THEN 'inquiry'
  WHEN 'dihubungi' THEN 'formulir_triase'
  WHEN 'trial_terjadwal' THEN 'penjadwalan'
  WHEN 'trial_selesai' THEN 'trial_discovery'
  WHEN 'diterima' THEN 'sesi_hasil'
  WHEN 'terdaftar' THEN 'registrasi_orientasi'
  WHEN 'ditolak' THEN 'tidak_lanjut'
  ELSE stage END
WHERE stage IN ('lead_masuk','dihubungi','trial_terjadwal','trial_selesai','diterima','terdaftar','ditolak');

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_stage_check;
ALTER TABLE leads ADD CONSTRAINT leads_stage_check CHECK (stage IN (
  'inquiry', 'formulir_triase', 'penjadwalan', 'trial_discovery',
  'wawancara', 'sesi_hasil', 'registrasi_orientasi', 'baseline', 'tidak_lanjut'
));

-- 2) Formulir Trial: satu formulir per lead (dapat diperbarui).
CREATE TABLE IF NOT EXISTS trial_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  child_birth_date DATE,
  child_gender VARCHAR(16) CHECK (child_gender IN ('laki_laki','perempuan')),
  program_pilihan VARCHAR(8) CHECK (program_pilihan IN ('ZKC','SAM')),
  program_id UUID REFERENCES programs(id),
  tujuan_keluarga TEXT,
  sinyal_dukungan_konsisten BOOLEAN NOT NULL DEFAULT false,
  sinyal_catatan TEXT,
  -- Blok Observasi Awal Orang Tua (19 pertanyaan, 7 gugus) — struktur jawaban;
  -- teks butir resmi dimuat dari Paket Sistem Terpadu Versi Final (Tahap 2).
  observasi_awal JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Blok Riwayat Awal & Konteks Keluarga — berlabel keterangan orang tua.
  riwayat_awal JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Filter SAM dua sisi: nilai gugus 1–4 skala kata empat tingkat.
  filter_sam_anak JSONB,
  filter_sam_ortu JSONB,
  -- Hasil Filter Arah (dihitung server, tidak pernah menimpa pilihan orang tua).
  arah_rekomendasi VARCHAR(16) CHECK (arah_rekomendasi IN ('ZKC','SAM','ZKC_DAHULU_SAM')),
  arah_keyakinan VARCHAR(32),
  arah_alasan TEXT,
  arah_berbeda BOOLEAN NOT NULL DEFAULT false,
  -- Hasil Filter SAM (khusus calon SAM).
  sam_hasil VARCHAR(24) CHECK (sam_hasil IN ('SIAP_SAM','SIAP_TRANSISI','SIAP_PENYAMAAN','BELUM_SIAP')),
  sam_alasan TEXT,
  -- ACC arah oleh guru program terkait.
  acc_status VARCHAR(24) NOT NULL DEFAULT 'menunggu'
    CHECK (acc_status IN ('menunggu','disetujui','disetujui_bersyarat')),
  acc_oleh UUID REFERENCES users(id),
  acc_nama VARCHAR(255),
  acc_peran VARCHAR(64),
  acc_program VARCHAR(8) CHECK (acc_program IN ('ZKC','SAM')),
  acc_at TIMESTAMPTZ,
  acc_catatan TEXT,
  -- Discovery sebagai konfirmasi lapangan.
  discovery_status VARCHAR(16) CHECK (discovery_status IN ('sesuai','berbeda')),
  discovery_catatan TEXT,
  -- Kesepakatan Awal Keluarga (centang di alur formulir).
  kesepakatan_awal BOOLEAN NOT NULL DEFAULT false,
  kesepakatan_awal_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS trial_forms_branch_idx ON trial_forms (branch_id);

-- Riwayat ACC: founder & manager membaca siapa menyetujui dan kapan.
CREATE TABLE IF NOT EXISTS trial_acc_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trial_form_id UUID NOT NULL REFERENCES trial_forms(id) ON DELETE CASCADE,
  oleh_id UUID REFERENCES users(id),
  oleh_nama VARCHAR(255) NOT NULL,
  oleh_peran VARCHAR(64),
  program VARCHAR(8) CHECK (program IN ('ZKC','SAM')),
  keputusan VARCHAR(24) NOT NULL CHECK (keputusan IN ('disetujui','disetujui_bersyarat')),
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS trial_acc_log_form_idx ON trial_acc_log (trial_form_id, created_at);

-- 3) Jadwal sesi: kuota nyata + aturan jadwal terkunci ditegakkan server.
CREATE TABLE IF NOT EXISTS sesi_jadwal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  jenis VARCHAR(28) NOT NULL CHECK (jenis IN (
    'trial_zkc','asesmen_zkc','reguler_zkc','community_class','movement',
    'pendampingan_individual','discovery_sam','nido','casa')),
  tanggal DATE NOT NULL,
  jam_mulai TIME NOT NULL,
  jam_selesai TIME NOT NULL,
  kuota SMALLINT NOT NULL CHECK (kuota > 0),
  catatan TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS sesi_jadwal_tanggal_idx ON sesi_jadwal (tanggal, jam_mulai);

CREATE TABLE IF NOT EXISTS sesi_peserta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesi_id UUID NOT NULL REFERENCES sesi_jadwal(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  child_id UUID REFERENCES children(id) ON DELETE SET NULL,
  nama_anak VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'terkonfirmasi'
    CHECK (status IN ('terkonfirmasi','daftar_tunggu','batal','hadir','tidak_hadir')),
  urutan_tunggu SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS sesi_peserta_sesi_idx ON sesi_peserta (sesi_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS sesi_peserta_lead_unik
  ON sesi_peserta (sesi_id, lead_id) WHERE lead_id IS NOT NULL AND status <> 'batal';
CREATE UNIQUE INDEX IF NOT EXISTS sesi_peserta_anak_unik
  ON sesi_peserta (sesi_id, child_id) WHERE child_id IS NOT NULL AND status <> 'batal';

COMMIT;
