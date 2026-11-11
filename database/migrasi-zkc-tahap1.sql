-- Migrasi ZKC & SAM Tahap 1: identitas tiga baris + dua rumah + kategori anak.
-- Acuan: Prompt Gabungan Sistem dan Website ZKC & SAM (10 Nov 2026), Tahap 1.
-- Semua kolom memakai nilai bawaan lembaga; admin dapat mengubahnya dari
-- Pengaturan > Identitas Sekolah. Aman dijalankan berulang.

-- ---------- Identitas tiga baris yang terkunci ----------
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS nama_yayasan varchar(200) NOT NULL DEFAULT 'Yayasan Tunas Pelita Cakrawala Insani';
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS nama_gabungan varchar(200) NOT NULL DEFAULT 'Ziel Kids Club & Sekolah Alam Montessori';
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS tagline_gabungan varchar(320) NOT NULL DEFAULT 'Understanding Children. Strengthening Families. Learning Naturally. Growing Meaningfully.';
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS visi text;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS misi text;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS motto varchar(200);
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS warna_zkc varchar(9) NOT NULL DEFAULT '#8A6844';
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS warna_sam varchar(9) NOT NULL DEFAULT '#4F7A54';

UPDATE school_settings SET visi = 'Mewujudkan generasi anak yang bertumbuh utuh dan berkarakter, berakar pada nilai Islam, melalui pendidikan yang memahami anak dan menguatkan keluarga' WHERE visi IS NULL;
UPDATE school_settings SET misi = 'Menyelenggarakan pendampingan perkembangan anak dan pendidikan Montessori autentik berbasis observasi
Menguatkan keluarga sebagai mitra utama dalam perjalanan tumbuh kembang anak
Menumbuhkan kesadaran literasi dan deteksi dini yang inklusif bagi masyarakat' WHERE misi IS NULL;
UPDATE school_settings SET motto = 'Tumbuh Bersama. Menerangi Masa Depan.' WHERE motto IS NULL;

-- ---------- Area program: dua rumah ----------
ALTER TABLE programs ADD COLUMN IF NOT EXISTS area varchar(8) NOT NULL DEFAULT 'ZKC';
DO $$ BEGIN
  ALTER TABLE programs ADD CONSTRAINT programs_area_check CHECK (area IN ('ZKC','SAM'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
UPDATE programs SET area = 'SAM' WHERE name ILIKE '%montessori%' AND area = 'ZKC';

-- ---------- Kategori & label status anak ----------
ALTER TABLE children ADD COLUMN IF NOT EXISTS kategori_program varchar(8) NOT NULL DEFAULT 'ZKC';
ALTER TABLE children ADD COLUMN IF NOT EXISTS label_status varchar(24) NOT NULL DEFAULT 'Anggota';
DO $$ BEGIN
  ALTER TABLE children ADD CONSTRAINT children_kategori_check CHECK (kategori_program IN ('ZKC','SAM'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE children ADD CONSTRAINT children_label_check CHECK (label_status IN ('Anggota','Trial','Insidentil','Peserta Event','Klien Skrining','Klien Konsultasi'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Kategori anak mengikuti area program pada pendaftaran aktifnya.
UPDATE children c SET kategori_program = p.area
  FROM enrollments e JOIN programs p ON p.id = e.program_id
 WHERE e.child_id = c.id AND e.status = 'aktif';

-- ---------- Kelompok tahap (ZKC: Bibit/Tunas/Mekar; SAM: NIDO/CASA) ----------
ALTER TABLE classes ADD COLUMN IF NOT EXISTS kelompok varchar(16);
DO $$ BEGIN
  ALTER TABLE classes ADD CONSTRAINT classes_kelompok_check CHECK (kelompok IS NULL OR kelompok IN ('Bibit','Tunas','Mekar','NIDO','CASA'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
