-- Gabungan migrasi + seed untuk pemasangan lokal/Docker (dijalankan setelah SQL utama)

-- ===== database/migrasi-ailsa-llm.sql =====
-- Blok Ailsa LLM — kanal WhatsApp Cloud API + otak LLM + pengawalan + analisa.
-- Aman dijalankan berulang.

-- 1) Log percakapan: ID pesan WhatsApp (dedupe), status kirim, sumber balasan.
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS wa_message_id text;
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS delivery_status varchar(16);
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS meta_error text;
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS unanswered_question text;
ALTER TABLE bot_conversations ADD COLUMN IF NOT EXISTS blocked_reason varchar(64);
CREATE UNIQUE INDEX IF NOT EXISTS bot_conversations_wamid
    ON bot_conversations (wa_message_id) WHERE wa_message_id IS NOT NULL;

-- 2) Lead: state alur dari database (bukan dari ingatan model) + opt-out.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ailsa_state jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS opt_out boolean NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS opt_out_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS wa_verified boolean NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS guardian_id uuid REFERENCES guardians(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS takeover_at timestamptz;

-- 3) Setelan bot (satu baris).
CREATE TABLE IF NOT EXISTS bot_settings (
    id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    notify_published boolean NOT NULL DEFAULT true,
    remind_invoice boolean NOT NULL DEFAULT true,
    admin_number varchar(32),
    hours_start smallint NOT NULL DEFAULT 7,
    hours_end smallint NOT NULL DEFAULT 21,
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO bot_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 4) Artefak analisa perkembangan (staf) — bisa diaudit, tidak dihitung ulang.
CREATE TABLE IF NOT EXISTS ailsa_analyses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id uuid NOT NULL REFERENCES children(id),
    period_start date NOT NULL,
    period_end date NOT NULL,
    published_count int NOT NULL,
    content jsonb NOT NULL,
    model varchar(64),
    needs_teacher_review boolean NOT NULL DEFAULT false,
    reviewed_by uuid REFERENCES users(id),
    reviewed_at timestamptz,
    created_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ailsa_analyses_child ON ailsa_analyses (child_id, period_end DESC);

-- ===== database/migrasi-auth.sql =====
-- Migrasi: reset kata sandi + 2FA (TOTP)
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS password_resets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_resets_token_hash_idx ON password_resets (token_hash);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id);

COMMIT;

SELECT column_name FROM information_schema.columns
 WHERE table_name='users' AND column_name LIKE 'totp%';
SELECT 'password_resets ada' WHERE EXISTS (
  SELECT 1 FROM information_schema.tables WHERE table_name='password_resets');

-- ===== database/migrasi-blok-1-2.sql =====
-- Blok 1 & 2 — soft delete laporan, riwayat status, dan penautan akun-staf.
-- Aman dijalankan berulang (IF NOT EXISTS / IF EXISTS).

-- 1) Soft delete: laporan tidak pernah benar-benar hilang.
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id);

-- 2) Unique (child_id, report_date) harus jadi unik PARSIAL, kalau tidak
--    laporan yang sudah di-soft-delete akan menghalangi pembuatan laporan baru
--    untuk anak+tanggal yang sama.
ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS daily_reports_child_id_report_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_child_date_aktif
    ON daily_reports (child_id, report_date)
 WHERE deleted_at IS NULL;

-- 3) Akun pengguna ditautkan eksplisit ke baris staf (Blok 3B).
ALTER TABLE staff ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id);
CREATE UNIQUE INDEX IF NOT EXISTS staff_user_id_unik ON staff (user_id) WHERE user_id IS NOT NULL;

-- 4) Ditautkan otomatis lewat email yang sama, supaya akun lama tidak perlu diisi manual.
UPDATE staff s SET user_id = u.id
  FROM users u
 WHERE s.user_id IS NULL AND lower(s.email) = lower(u.email);

-- 5) Indeks bantu daftar & laporan.
CREATE INDEX IF NOT EXISTS daily_reports_aktif ON daily_reports (branch_id, report_date DESC)
 WHERE deleted_at IS NULL;

-- 6) Audit tidak boleh menghalangi penghapusan cabang, dan tidak boleh ikut
--    terhapus. Riwayat tetap ada dengan branch_id NULL.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_branch_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;

-- ===== database/migrasi-blok-3.sql =====
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

-- ===== database/migrasi-blok-c.sql =====
-- Blok C: status akun, organisasi, dan cabang pengguna.
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_name text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aktif';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('aktif', 'menunggu_persetujuan', 'nonaktif'));

CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);

COMMIT;

SELECT status, count(*) FROM users GROUP BY status;

-- ===== database/migrasi-blok-e.sql =====
-- Blok E3: pipeline Admission pada tabel leads.
BEGIN;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'lead_masuk';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS trial_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_child_id uuid REFERENCES children(id);

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_stage_check;
ALTER TABLE leads ADD CONSTRAINT leads_stage_check CHECK (stage IN (
  'lead_masuk', 'dihubungi', 'trial_terjadwal', 'trial_selesai',
  'diterima', 'ditolak', 'terdaftar'
));

CREATE INDEX IF NOT EXISTS leads_stage_idx ON leads (stage);

COMMIT;

SELECT stage, count(*) FROM leads GROUP BY stage;

-- ===== database/migrasi-jilid4-blok1.sql =====
-- Jilid 4 Blok 1 — anak tidak boleh hilang.
-- 1) Soft delete wajib: hard delete anak diblokir di level database.
-- 2) Cascade ke data turunan dimatikan (guardian, alergi, dokumen).
-- Aman dijalankan berulang.

ALTER TABLE children ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id);
ALTER TABLE children ADD COLUMN IF NOT EXISTS deleted_reason text;

CREATE OR REPLACE FUNCTION tolak_hapus_anak() RETURNS trigger AS $$
BEGIN
  IF current_setting('balita.izinkan_hapus', true) IS DISTINCT FROM 'ya' THEN
    RAISE EXCEPTION 'Hard delete rekaman anak dilarang. Pakai soft delete (deleted_at) lewat API.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tolak_hapus_anak ON children;
CREATE TRIGGER trg_tolak_hapus_anak BEFORE DELETE ON children
FOR EACH ROW EXECUTE FUNCTION tolak_hapus_anak();

-- Cascade dimatikan: menghapus (soft) anak tidak boleh menghapus wali/alergi/dokumen.
ALTER TABLE child_guardians DROP CONSTRAINT IF EXISTS child_guardians_child_id_fkey;
ALTER TABLE child_guardians ADD CONSTRAINT child_guardians_child_id_fkey
    FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE RESTRICT;

ALTER TABLE child_allergies DROP CONSTRAINT IF EXISTS child_allergies_child_id_fkey;
ALTER TABLE child_allergies ADD CONSTRAINT child_allergies_child_id_fkey
    FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE RESTRICT;

ALTER TABLE child_documents DROP CONSTRAINT IF EXISTS child_documents_child_id_fkey;
ALTER TABLE child_documents ADD CONSTRAINT child_documents_child_id_fkey
    FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS children_sampah ON children (deleted_at) WHERE deleted_at IS NOT NULL;

-- ===== database/migrasi-jilid5.sql =====
-- Jilid 5: audit, admission, bank pengetahuan, kwitansi, notifikasi tagihan.
-- Aman dijalankan berulang.

-- Blok 2: tandai lead yang perlu ditinjau (nama tercampur usia, dll.)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS perlu_tinjau boolean NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tinjau_alasan text;

-- Blok 3: satu pertanyaan kanonis = satu butir aktif.
CREATE UNIQUE INDEX IF NOT EXISTS bot_knowledge_pertanyaan_unik
  ON bot_knowledge_entries (lower(btrim(question_sample)))
  WHERE status = 'aktif';

-- Blok 4: kwitansi resmi (nomor urut, bisa dibatalkan tanpa dihapus).
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL UNIQUE REFERENCES invoices(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  receipt_number varchar(48),
  amount numeric(14,2) NOT NULL,
  method varchar(32),
  received_by uuid REFERENCES staff(id),
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  cancelled_at timestamptz,
  cancelled_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS receipt_number_seq;

CREATE OR REPLACE FUNCTION set_nomor_kwitansi() RETURNS trigger AS $$
DECLARE kode text;
BEGIN
  IF NEW.receipt_number IS NULL THEN
    SELECT upper(left(coalesce(code,'PST'),3)) INTO kode FROM branches WHERE id = NEW.branch_id;
    NEW.receipt_number := format('KWT/%s/%s/%s/%s',
      coalesce(kode,'PST'),
      to_char(NEW.paid_at,'YYYY'), to_char(NEW.paid_at,'MM'),
      lpad(nextval('receipt_number_seq')::text,6,'0'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nomor_kwitansi ON receipts;
CREATE TRIGGER trg_nomor_kwitansi BEFORE INSERT ON receipts
FOR EACH ROW EXECUTE FUNCTION set_nomor_kwitansi();

-- Log pengiriman tagihan: jujur mencatat "menunggu kanal" bila WhatsApp belum aktif.
CREATE TABLE IF NOT EXISTS invoice_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  jenis varchar(16) NOT NULL,          -- terbit | h3 | h1
  channel varchar(16) NOT NULL,        -- whatsapp | dalam_aplikasi
  status varchar(24) NOT NULL,         -- terkirim | menunggu_kanal | gagal
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_notif_sekali
  ON invoice_notifications (invoice_id, jenis, channel);

-- Pemberitahuan di dalam aplikasi untuk wali.
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  title varchar(160) NOT NULL,
  body text,
  href varchar(200),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Blok 4: tagihan otomatis tidak boleh menggandakan periode yang sama.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_anak_periode_unik
  ON invoices (child_id, period_month)
  WHERE status <> 'batal' AND child_id IS NOT NULL;

-- ===== database/migrasi-jilid6.sql =====
-- Jilid 6: katalog material Montessori AMI, milestone perkembangan, dan
-- struktur laporan harian sesuai referensi sekolah.
-- Aman dijalankan berulang.

-- ---------- Blok 1C: katalog material ----------
CREATE TABLE IF NOT EXISTS materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id),
  name varchar(160) NOT NULL,
  name_en varchar(160),
  area varchar(24) NOT NULL,          -- practical_life|language|sensorial|mathematics|cultural|observasi
  age_group varchar(12),              -- 0-3 | 3-6
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS materials_nama_unik ON materials (lower(btrim(name))) WHERE branch_id IS NULL;

ALTER TABLE daily_report_activities
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES materials(id),
  ADD COLUMN IF NOT EXISTS area varchar(24),
  ADD COLUMN IF NOT EXISTS work_location varchar(16),   -- lantai|meja|alas
  ADD COLUMN IF NOT EXISTS work_mode varchar(16),       -- sendiri|berpasangan|kelompok_kecil|kelompok_besar
  ADD COLUMN IF NOT EXISTS milestone_id uuid;

-- Skala penilaian 1–4 (4 = sempurna). Data lama diskalakan: 1-2 -> 1-2, 3 -> 3, 4 -> 3, 5 -> 4.
ALTER TABLE daily_report_activities ADD COLUMN IF NOT EXISTS rating_lama numeric(3,1);
UPDATE daily_report_activities SET rating_lama = rating WHERE rating_lama IS NULL AND rating IS NOT NULL;
UPDATE daily_report_activities
   SET rating = CASE WHEN rating >= 5 THEN 4 WHEN rating = 4 THEN 3 WHEN rating >= 3 THEN 3
                     WHEN rating = 2 THEN 2 WHEN rating = 1 THEN 1 ELSE rating END
 WHERE rating IS NOT NULL AND rating > 4;

-- ---------- Blok 1B: bagian harian tetap ----------
ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS circle_theme text,
  ADD COLUMN IF NOT EXISTS circle_rating smallint,
  ADD COLUMN IF NOT EXISTS circle_notes text,
  ADD COLUMN IF NOT EXISTS special_moment text,
  ADD COLUMN IF NOT EXISTS home_suggestion text;

-- ---------- Blok 2: katalog milestone ----------
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id),
  indikator varchar(240) NOT NULL,
  age_group varchar(12) NOT NULL,     -- 0-<1 | 1-<2 | 2-<3 | 3-<4 | 4-<5 | 5-6
  aspect varchar(32) NOT NULL,        -- nilai_agama_moral|fisik_motorik|kognitif|bahasa|sosial_emosional|seni
  montessori_area varchar(24),
  status varchar(12) NOT NULL DEFAULT 'draf',  -- draf | aktif | arsip
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS milestones_indikator_unik
  ON milestones (lower(btrim(indikator)), age_group) WHERE branch_id IS NULL;

CREATE TABLE IF NOT EXISTS material_milestones (
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  PRIMARY KEY (material_id, milestone_id)
);

-- Riwayat observasi milestone (dari aktivitas Observasi maupun material terpetakan)
CREATE TABLE IF NOT EXISTS milestone_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id),
  milestone_id uuid NOT NULL REFERENCES milestones(id),
  observed_on date NOT NULL,
  level smallint,                    -- 1..4 (null = observasi ringan dari material)
  report_id uuid REFERENCES daily_reports(id),
  material_id uuid REFERENCES materials(id),
  created_by uuid REFERENCES staff(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS milestone_obs_anak ON milestone_observations (child_id, observed_on DESC);

-- ===== database/migrasi-role-murid.sql =====
-- Tambah peran "murid" (belum ada di seed): hanya boleh lihat data sendiri + RSVP kegiatan.
INSERT INTO roles (code, name, description)
VALUES ('murid', 'Murid / Siswa', 'Akun murid: melihat data sendiri dan RSVP kegiatan')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  JOIN permissions p ON p.code IN ('child.view_own', 'events.rsvp')
 WHERE r.code = 'murid'
ON CONFLICT DO NOTHING;

SELECT r.code || ' → ' || string_agg(p.code, ', ' ORDER BY p.code)
  FROM roles r
  JOIN role_permissions rp ON rp.role_id = r.id
  JOIN permissions p ON p.id = rp.permission_id
 WHERE r.code = 'murid'
 GROUP BY r.code;

-- ===== database/migrasi-role-murid-check.sql =====
-- Izinkan peran 'murid' pada kolom users.role (CHECK constraint dari seed awal).
BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY[
  'super_admin', 'owner', 'branch_manager', 'kepala_sekolah', 'koordinator_akademik',
  'guru', 'staf_keuangan', 'staf_hr', 'admin_cabang', 'staf', 'orang_tua', 'investor',
  'kandidat', 'murid'
]::text[]));

COMMIT;

SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE contype='c' AND conrelid='users'::regclass AND conname='users_role_check';

-- ===== database/migrasi-tagihan-nomor.sql =====
-- Nomor tagihan otomatis + jatuh tempo bawaan (mengikuti contoh dokumen pemilik).
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number varchar(48);

CREATE OR REPLACE FUNCTION set_nomor_tagihan() RETURNS trigger AS $$
DECLARE
  kode text;
BEGIN
  IF NEW.invoice_number IS NULL THEN
    SELECT upper(left(coalesce(code, 'PST'), 3)) INTO kode FROM branches WHERE id = NEW.branch_id;
    NEW.invoice_number := format(
      'INV/%s/%s/%s/%s',
      coalesce(kode, 'PST'),
      to_char(NEW.period_month, 'YYYY'),
      to_char(NEW.period_month, 'MM'),
      lpad(nextval('invoice_number_seq')::text, 6, '0')
    );
  END IF;
  IF NEW.due_date IS NULL THEN
    NEW.due_date := (NEW.period_month + INTERVAL '9 days')::date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nomor_tagihan ON invoices;
CREATE TRIGGER trg_nomor_tagihan BEFORE INSERT ON invoices
FOR EACH ROW EXECUTE FUNCTION set_nomor_tagihan();

CREATE UNIQUE INDEX IF NOT EXISTS invoices_nomor_unik ON invoices (invoice_number) WHERE invoice_number IS NOT NULL;

-- Nomor untuk baris lama yang belum punya.
UPDATE invoices SET invoice_number = format(
  'INV/%s/%s/%s/%s',
  coalesce((SELECT upper(left(code,3)) FROM branches WHERE id = invoices.branch_id), 'PST'),
  to_char(period_month,'YYYY'), to_char(period_month,'MM'),
  lpad(nextval('invoice_number_seq')::text, 6, '0')
) WHERE invoice_number IS NULL;

-- ===== database/seed-jilid6.sql =====
-- Seed katalog material Montessori AMI (0–3 & 3–6) + milestone awal per kelompok usia.
-- Status milestone: 'draf' — sekolah meninjau lalu mengaktifkan.

INSERT INTO materials (name, name_en, area, age_group) VALUES
  ('Menuang air','Pouring water','practical_life','3-6'),
  ('Meronce manik','Threading beads','practical_life','0-3'),
  ('Membuka-menutup wadah','Opening and closing containers','practical_life','0-3'),
  ('Menyapu','Sweeping','practical_life','3-6'),
  ('Merawat tanaman','Care of plants','practical_life','3-6'),
  ('Pink Tower','Pink Tower','sensorial','3-6'),
  ('Knobbed Cylinders','Knobbed Cylinders','sensorial','3-6'),
  ('Brown Stair','Brown Stair','sensorial','3-6'),
  ('Touch Board','Touch Board','sensorial','3-6'),
  ('Bells','Bells','sensorial','3-6'),
  ('Binomial Cube','Binomial Cube','sensorial','3-6'),
  ('Metal Insets','Metal Insets','language','3-6'),
  ('Kartu Gambar dan Kata','Picture and Word Cards','language','3-6'),
  ('Buku cerita','Story books','language','0-3'),
  ('Mendengarkan cerita','Listening to stories','language','0-3'),
  ('Number Rods','Number Rods','mathematics','3-6'),
  ('Papan Mencocokkan Angka','Number Matching Board','mathematics','3-6'),
  ('Golden Beads','Golden Beads','mathematics','3-6'),
  ('Puzzle Peta Dunia','World Map Puzzle','cultural','3-6'),
  ('Puzzle Peta Indonesia','Indonesia Map Puzzle','cultural','3-6')
ON CONFLICT DO NOTHING;

INSERT INTO milestones (indikator, age_group, aspect, montessori_area) VALUES
  ('Mampu berpisah dari orang tua/pendamping tanpa tangis panjang','1-<2','sosial_emosional','practical_life'),
  ('Mampu bekerja mandiri memilih aktivitas','2-<3','sosial_emosional','practical_life'),
  ('Bersabar menunggu giliran','2-<3','sosial_emosional',NULL),
  ('Menyebut nama sendiri','1-<2','bahasa',NULL),
  ('Menyebut 6 warna dengan benar','3-<4','kognitif','sensorial'),
  ('Mengelompokkan benda berdasarkan bentuk','3-<4','kognitif','sensorial'),
  ('Menuang air tanpa tumpah','3-<4','fisik_motorik','practical_life'),
  ('Memegang alat tulis dengan tiga jari','3-<4','fisik_motorik','sensorial'),
  ('Meronce manik besar dengan tali','2-<3','fisik_motorik','practical_life'),
  ('Berjalan di garis dengan seimbang','3-<4','fisik_motorik','practical_life'),
  ('Meminta giliran dengan kalimat lengkap','3-<4','bahasa','language'),
  ('Menyebut nama aparatus yang dipakai','3-<4','bahasa','language'),
  ('Mengenal lambang bilangan 1-10','4-<5','kognitif','mathematics'),
  ('Mengurutkan benda dari kecil ke besar','4-<5','kognitif','sensorial'),
  ('Menghitung benda sampai 10','4-<5','kognitif','mathematics'),
  ('Membantu teman tanpa diminta','4-<5','sosial_emosional','practical_life'),
  ('Menyelesaikan pekerjaan sampai tuntas','4-<5','sosial_emosional','practical_life'),
  ('Menceritakan pengalaman hari ini','4-<5','bahasa','language'),
  ('Mengenal peta Indonesia (pulau utama)','5-6','kognitif','cultural'),
  ('Membaca kata sederhana','5-6','bahasa','language'),
  ('Menulis namanya sendiri','5-6','fisik_motorik','language'),
  ('Mengucapkan salam dan berterima kasih','2-<3','nilai_agama_moral',NULL),
  ('Berdoa sebelum kegiatan','3-<4','nilai_agama_moral',NULL),
  ('Menjaga kebersihan alat setelah dipakai','4-<5','nilai_agama_moral','practical_life'),
  ('Membuat karya seni sederhana','3-<4','seni',NULL)
ON CONFLICT DO NOTHING;

-- Pemetaan awal material -> milestone (contoh yang diminta pemilik, dapat diubah sekolah)
INSERT INTO material_milestones (material_id, milestone_id)
SELECT m.id, s.id FROM materials m JOIN milestones s ON
  (m.name = 'Pink Tower' AND s.indikator = 'Mengurutkan benda dari kecil ke besar') OR
  (m.name = 'Knobbed Cylinders' AND s.indikator = 'Memegang alat tulis dengan tiga jari') OR
  (m.name = 'Meronce manik' AND s.indikator = 'Meronce manik besar dengan tali') OR
  (m.name = 'Menuang air' AND s.indikator = 'Menuang air tanpa tumpah') OR
  (m.name = 'Kartu Gambar dan Kata' AND s.indikator = 'Membaca kata sederhana') OR
  (m.name = 'Number Rods' AND s.indikator = 'Menghitung benda sampai 10') OR
  (m.name = 'Puzzle Peta Indonesia' AND s.indikator = 'Mengenal peta Indonesia (pulau utama)') OR
  (m.name = 'Menyapu' AND s.indikator = 'Menyelesaikan pekerjaan sampai tuntas')
ON CONFLICT DO NOTHING;

SELECT (SELECT count(*) FROM materials) AS material, (SELECT count(*) FROM milestones) AS milestone,
       (SELECT count(*) FROM material_milestones) AS pemetaan;

-- ===== database/migrasi-rapor.sql =====
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

-- ===== database/migrasi-media.sql =====
-- Media laporan: video di galeri laporan harian + foto langsung di rapor.
-- daily_report_photos sudah punya media_type/mime_type sejak awal; yang kurang
-- hanya poster_url (gambar sampul video untuk PDF dan daftar). Rapor mendapat
-- tabel foto sendiri supaya guru bisa melengkapi Dokumentasi Kegiatan di luar
-- tarikan otomatis dari laporan harian. Aman dijalankan berulang.

ALTER TABLE daily_report_photos
  ADD COLUMN IF NOT EXISTS poster_url TEXT;

CREATE TABLE IF NOT EXISTS cycle_report_photos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID NOT NULL REFERENCES cycle_reports(id) ON DELETE CASCADE,
  photo_url  TEXT NOT NULL,
  caption    TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cycle_report_photos_report
  ON cycle_report_photos (report_id, sort_order, created_at);
-- Kunci LLM Ailsa yang diisi admin dari halaman Ailsa (pengganti wajib-env).
-- Kunci tersimpan di bot_settings baris tunggal; tidak pernah ditampilkan
-- kembali ke peramban selain 4 karakter terakhir.
ALTER TABLE bot_settings
  ADD COLUMN IF NOT EXISTS llm_api_key text,
  ADD COLUMN IF NOT EXISTS llm_model varchar(64),
  ADD COLUMN IF NOT EXISTS llm_base_url text;
-- Kolom kanal percakapan bot: kode Simulator Ailsa menulis channel='simulator'
-- tetapi kolomnya belum pernah ada, sehingga log percakapan simulator selalu
-- gagal tersimpan (kesalahannya tertelan catch). Nilai lama dianggap WhatsApp.
ALTER TABLE bot_conversations
  ADD COLUMN IF NOT EXISTS channel varchar(16) NOT NULL DEFAULT 'whatsapp';
-- Migrasi: setelan payment gateway (Midtrans) yang diisi admin dari aplikasi.
-- Baris tunggal id=1, pola sama dengan bot_settings Ailsa: kunci hanya
-- tersimpan di database sekolah, tampil tersamar, tidak lewat env/chat.
CREATE TABLE IF NOT EXISTS payment_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider varchar(24) NOT NULL DEFAULT 'midtrans',
  server_key text,
  client_key text,
  sandbox boolean NOT NULL DEFAULT true,
  aktif boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO payment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
