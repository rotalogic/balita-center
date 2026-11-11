-- Migrasi ZKC Tahap 3b: Formulir Insidentil, Kesepakatan Awal Keluarga,
-- dan Peraturan & Kesepakatan Bersama (3 pihak).
-- Acuan: Prompt Gabungan Sistem & Website ZKC & SAM.
BEGIN;

-- 1) Pendaftaran insidentil (jalur ringan, terpisah dari Formulir Trial).
CREATE TABLE IF NOT EXISTS insidentil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  child_name VARCHAR(255) NOT NULL,
  child_birth_date DATE,
  child_age_months SMALLINT,
  parent_name VARCHAR(255) NOT NULL,
  wa_number VARCHAR(32) NOT NULL,
  email VARCHAR(255),
  kegiatan_jenis VARCHAR(16) NOT NULL CHECK (kegiatan_jenis IN ('zkc','sam','pop_up','event_alam','edukasi')),
  kegiatan_label VARCHAR(255),
  tanggal DATE NOT NULL,
  berbayar BOOLEAN NOT NULL DEFAULT false,
  biaya NUMERIC(14,2),
  setuju_ketentuan_bayar BOOLEAN NOT NULL DEFAULT false,
  setuju_ketentuan_bayar_at TIMESTAMPTZ,
  -- Kolom alergi berdiri sendiri; wajib salah satu: rincian alergi ATAU
  -- pernyataan tidak ada alergi yang diketahui (ditegakkan server).
  alergi_tidak_ada BOOLEAN NOT NULL DEFAULT false,
  alergi_jenis VARCHAR(255),
  alergi_pemicu TEXT,
  alergi_reaksi TEXT,
  alergi_tindakan TEXT,
  setuju_dokumentasi BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'baru'
    CHECK (status IN ('baru','terjadwal','selesai','jadi_anggota','batal')),
  child_id UUID REFERENCES children(id) ON DELETE SET NULL,
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS insidentil_tanggal_idx ON insidentil (tanggal);
CREATE INDEX IF NOT EXISTS insidentil_status_idx ON insidentil (status);

-- Paket edukasi yang dikirim ke orang tua peserta insidentil beserta
-- catatan pengirimannya (isi dan waktu kirim tercatat).
CREATE TABLE IF NOT EXISTS insidentil_paket (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insidentil_id UUID NOT NULL REFERENCES insidentil(id) ON DELETE CASCADE,
  kegiatan TEXT NOT NULL,
  aspek_dilatih TEXT NOT NULL,
  cara_anak TEXT NOT NULL,
  ide_rumah TEXT NOT NULL,
  saluran VARCHAR(16) CHECK (saluran IN ('whatsapp','email')),
  dikirim_at TIMESTAMPTZ,
  dikirim_oleh UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS insidentil_paket_ins_idx ON insidentil_paket (insidentil_id);

-- 2) Persetujuan Kesepakatan Awal Keluarga per anak (selain yang tercatat
-- pada Formulir Trial sebelum anak terdaftar).
CREATE TABLE IF NOT EXISTS kesepakatan_keluarga (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL UNIQUE REFERENCES children(id) ON DELETE CASCADE,
  nama_penyetuju VARCHAR(255) NOT NULL,
  sumber VARCHAR(16) NOT NULL DEFAULT 'registrasi' CHECK (sumber IN ('trial','registrasi')),
  disetujui_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dicatat_oleh UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3) Peraturan & Kesepakatan Bersama: tiga perangkat aturan resmi lembaga
-- (guru, anak, orang tua) + versi ramah anak. Isi awal mengikuti uraian
-- Prompt Gabungan; founder/manager dapat memperbarui dari halaman Peraturan.
CREATE TABLE IF NOT EXISTS peraturan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis VARCHAR(16) NOT NULL UNIQUE CHECK (jenis IN ('guru','anak','anak_ramah','ortu')),
  judul VARCHAR(255) NOT NULL,
  isi TEXT NOT NULL,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO peraturan (jenis, judul, isi) VALUES
('guru', 'Aturan Guru dan Guide', $isi$
Menjadi prepared adult: guru dan guide hadir dengan lingkungan yang sudah siap sebelum anak datang.
Mengamati dahulu sebelum mengintervensi, agar anak berkesempatan menemukan caranya sendiri.
Berbahasa yang menjaga martabat anak, tanpa label negatif dalam bentuk apa pun.
Menjaga kerahasiaan data dan cerita anak; yang dibagikan hanya yang perlu bagi pendampingan anak.
Menyelesaikan laporan harian dan menyiapkan bahan esok hari sebelum pulang.
Menjaga keselamatan anak dan menjalankan protokol penjemputan dengan tertib.
Memegang batas non-klinis: tanda kebutuhan spesifik anak dicatat apa adanya dan diteruskan kepada founder pada hari yang sama.
Menjadi teladan adab dan mendampingi Islamic living di SAM sebagai bagian alami hari anak.
Berpakaian rapi dan sopan sebagai cerminan lingkungan yang disiapkan.
Datang dan memulai tepat waktu, karena ritme anak bergantung pada ritme orang dewasa di sekitarnya.
$isi$),
('anak', 'Aturan Anak — Kesepakatan Positif', $isi$
Kami merawat diri kami, teman kami, dan lingkungan kami.
Kami berjalan dan bersuara lembut di dalam ruang.
Kami memakai material dengan baik dan mengembalikannya ke tempatnya sesudah selesai.
Kami menunggu giliran dengan sabar.
Kami menyampaikan kebutuhan dengan kata-kata.
Kami menjaga adab makan dan ikut serta dalam food preparation sesuai kemampuan kami.
Kami bergerak dengan aman di Boulder Wall Climbing, mini gym, dan alam, selalu bersama pendamping.
Di Sekolah Alam Montessori, kami mengikuti irama siklus kerja kelas kami.
$isi$),
('anak_ramah', 'Aturan Anak — Versi Ramah Anak', $isi$
Aku merawat diriku, temanku, dan kelasku.
Aku berjalan pelan dan bicara lembut di dalam kelas.
Aku memakai mainan belajar dengan baik, lalu mengembalikannya ke tempatnya.
Aku menunggu giliranku dengan sabar.
Aku menyampaikan kebutuhanku dengan kata-kata.
Aku makan dengan adab yang baik.
Aku bergerak dengan aman, selalu bersama guruku.
Aku bekerja mengikuti irama kelasku.
$isi$),
('ortu', 'Aturan Orang Tua', $isi$
Bermitra dengan sekolah dengan membaca laporan anak dan melanjutkan rekomendasi di rumah.
Berkomunikasi lewat jalur resmi sekolah pada jam yang ditetapkan, agar guru dapat fokus mendampingi anak pada jam belajar.
Mengantar dan menjemput tepat waktu; anak hanya diserahkan kepada penjemput yang terdaftar.
Mendampingi transisi berpisah secara bertahap di SAM, dan mempercayakan anak belajar tanpa pendamping di area belajar ZKC sesudah masa transisi singkat.
Menyiapkan bekal anak dari rumah untuk anak SAM.
Terbuka menyampaikan keadaan kesehatan dan alergi anak demi keselamatan anak.
Menghormati irama kelas dengan tidak masuk ke area belajar di tengah siklus kerja.
Mempercayakan tempo belajar anak tanpa memaksakan target calistung.
Berkomitmen mengikuti program minimal satu periode tiga bulan, karena fondasi anak dibangun perlahan.
Mengikuti ketentuan administrasi program dengan tertib.
Untuk kegiatan berbayar, pembayaran yang sudah dilakukan tidak dapat dibatalkan dan tidak dapat dikembalikan, termasuk bagi peserta insidentil dan peserta event.
$isi$)
ON CONFLICT (jenis) DO NOTHING;

COMMIT;
