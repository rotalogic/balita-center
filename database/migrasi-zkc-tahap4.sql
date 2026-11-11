-- Migrasi ZKC Tahap 4: Skema Biaya Final/Rancangan (kunci server) · Surat &
-- Proposal bernomor otomatis · Masukan Orang Tua · Penilaian Guru oleh Wali
-- & Papan Poin · Standar Kompetensi & Probation · Rekrutmen · Kalender
-- tiga lapis.
-- Acuan: Prompt Gabungan Sistem & Website ZKC & SAM (Modul Keuangan; Modul
-- Surat dan Proposal; Modul Masukan Orang Tua; Modul SDM; Modul Kalender).
BEGIN;

-- ---------- Skema Biaya ----------
CREATE TABLE IF NOT EXISTS skema_biaya (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  nama VARCHAR(200) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'rancangan'
    CHECK (status IN ('final','rancangan')),
  komponen JSONB NOT NULL DEFAULT '[]',
  keterangan TEXT,
  difinalkan_oleh UUID REFERENCES users(id),
  difinalkan_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE programs ADD COLUMN IF NOT EXISTS skema_id UUID REFERENCES skema_biaya(id);

-- ---------- Surat & Proposal ----------
CREATE TABLE IF NOT EXISTS surat_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(200) NOT NULL,
  kode_jenis VARCHAR(16) NOT NULL,
  perihal_default VARCHAR(300),
  isi TEXT NOT NULL,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS surat_counter (
  tahun INT NOT NULL,
  kode_jenis VARCHAR(16) NOT NULL,
  terakhir INT NOT NULL DEFAULT 0,
  PRIMARY KEY (tahun, kode_jenis)
);
CREATE TABLE IF NOT EXISTS surat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  template_id UUID REFERENCES surat_template(id),
  kode_jenis VARCHAR(16) NOT NULL,
  nomor VARCHAR(64) UNIQUE,
  urut INT,
  perihal VARCHAR(300) NOT NULL,
  tujuan VARCHAR(300),
  isi TEXT NOT NULL,
  variabel JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(16) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','terbit','arsip')),
  diterbitkan_oleh UUID REFERENCES users(id),
  diterbitkan_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Masukan Orang Tua ----------
CREATE TABLE IF NOT EXISTS masukan_ortu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id),
  child_name VARCHAR(200) NOT NULL,
  guardian_email VARCHAR(200) NOT NULL,
  periode VARCHAR(7) NOT NULL,
  aspek JSONB NOT NULL DEFAULT '{}',
  cerita TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'baru'
    CHECK (status IN ('baru','dibaca','ditindaklanjuti')),
  tindak_lanjut TEXT,
  ditindak_oleh UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (child_id, periode, guardian_email)
);

-- ---------- Penilaian Guru oleh Wali Murid + Papan Poin ----------
CREATE TABLE IF NOT EXISTS penilaian_guru (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  child_id UUID NOT NULL REFERENCES children(id),
  guardian_email VARCHAR(200) NOT NULL,
  periode VARCHAR(7) NOT NULL,
  aspek JSONB NOT NULL DEFAULT '{}',
  -- Poin internal hasil ubahan skala kata (Sangat Baik=4 … Perlu
  -- Perbaikan=1), dihitung server; tidak pernah tampil ke orang tua/guru
  -- sebagai "nilai bintang" — guru hanya membaca rata-rata aspek & cerita.
  poin NUMERIC(4,2) NOT NULL,
  cerita TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (child_id, staff_id, periode, guardian_email)
);

-- ---------- Standar Kompetensi & Probation ----------
CREATE TABLE IF NOT EXISTS kompetensi_penilaian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  semester VARCHAR(16) NOT NULL,
  gugus JSONB NOT NULL DEFAULT '[]',
  penilai_nama VARCHAR(200),
  catatan TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kompetensi_staff ON kompetensi_penilaian (staff_id, created_at DESC);

CREATE TABLE IF NOT EXISTS probation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL UNIQUE REFERENCES staff(id),
  mulai DATE NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'berjalan'
    CHECK (status IN ('berjalan','selesai')),
  hasil VARCHAR(20) CHECK (hasil IN ('diangkat','diperpanjang','tidak_lanjut')),
  pelanggaran_berat BOOLEAN NOT NULL DEFAULT false,
  pelanggaran_keterangan TEXT,
  pelanggaran_at TIMESTAMPTZ,
  persetujuan JSONB NOT NULL DEFAULT '{}',
  rencana_perbaikan TEXT,
  perpanjangan_bulan SMALLINT,
  diputuskan_oleh UUID REFERENCES users(id),
  diputuskan_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Rekrutmen ----------
CREATE TABLE IF NOT EXISTS lowongan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  judul VARCHAR(200) NOT NULL,
  program_label VARCHAR(200),
  deskripsi TEXT,
  syarat_mutlak JSONB NOT NULL DEFAULT '[]',
  pertanyaan JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(16) NOT NULL DEFAULT 'buka' CHECK (status IN ('buka','tutup')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lamaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lowongan_id UUID NOT NULL REFERENCES lowongan(id),
  nama VARCHAR(200) NOT NULL,
  email VARCHAR(200),
  wa_number VARCHAR(32),
  cv_nama VARCHAR(300) NOT NULL,
  cv_url TEXT,
  syarat JSONB NOT NULL DEFAULT '{}',
  jawaban JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'masuk'
    CHECK (status IN ('masuk','tidak_memenuhi','tersaring','wawancara','observasi','diterima','ditolak','onboarding')),
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Kalender Tiga Lapis ----------
CREATE TABLE IF NOT EXISTS kalender_entri (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  tanggal DATE NOT NULL,
  judul VARCHAR(300) NOT NULL,
  lapis VARCHAR(16) NOT NULL CHECK (lapis IN ('momen','pembelajaran','dapodik')),
  keterangan TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kalender_tanggal ON kalender_entri (tanggal);

-- Template surat bawaan (isi memakai variabel {{...}}; kop tiga baris
-- ditambahkan saat cetak, bukan di dalam isi).
INSERT INTO surat_template (nama, kode_jenis, perihal_default, isi)
SELECT 'Surat Keterangan Anak', 'SK', 'Surat Keterangan',
  'Yang bertanda tangan di bawah ini menerangkan bahwa:' || chr(10) || chr(10) ||
  'Nama anak: {{nama_anak}}' || chr(10) || 'Tanggal lahir: {{tanggal_lahir}}' || chr(10) || chr(10) ||
  'adalah peserta program {{program}} di lembaga kami sejak {{tanggal_masuk}}.' || chr(10) || chr(10) ||
  'Surat keterangan ini dibuat untuk keperluan {{keperluan}}.'
WHERE NOT EXISTS (SELECT 1 FROM surat_template WHERE kode_jenis = 'SK');
INSERT INTO surat_template (nama, kode_jenis, perihal_default, isi)
SELECT 'Proposal Kerja Sama', 'PROP', 'Proposal Kerja Sama {{mitra}}',
  'Proposal kerja sama antara lembaga kami dan {{mitra}}.' || chr(10) || chr(10) ||
  'Latar belakang: {{latar}}' || chr(10) || chr(10) || 'Rencana kegiatan: {{rencana}}'
WHERE NOT EXISTS (SELECT 1 FROM surat_template WHERE kode_jenis = 'PROP');

COMMIT;
