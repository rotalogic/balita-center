-- =====================================================================
-- BALITA CENTER: DATABASE POSTGRESQL, SATU FILE (1 November 2026)
-- =====================================================================
-- File ini adalah SATU-SATUNYA file yang dibutuhkan. Isinya:
--   Bagian 1: Skema lengkap, 66 tabel, 158 foreign key, indeks, trigger
--             validasi terbit laporan harian (gabungan skema bersih PRD
--             44 tabel + Addendum V2 5 tabel + ekstensi aplikasi 17 tabel).
--   Bagian 2: Seed referensi RBAC (10 peran, 23 izin, 105 pemetaan).
--   Bagian 3: Kueri verifikasi di akhir file (hanya membaca, aman).
-- Dokumentasi, ERD, dan catatan yang sebelumnya terpisah kini menjadi
-- komentar di file ini juga, supaya tidak ada file kedua yang dibutuhkan.
--
-- CARA PASANG (PostgreSQL 13+, teruji di PostgreSQL 16):
--   createdb balita_center
--   psql -v ON_ERROR_STOP=1 -d balita_center -f balita-center-database.sql
-- Dengan Docker (tanpa file compose terpisah, cukup satu perintah):
--   docker run -d --name balita-db -e POSTGRES_PASSWORD=ganti-ini \
--     -e POSTGRES_DB=balita_center -p 54329:5432 postgres:16
--   lalu jalankan perintah psql di atas dengan -h localhost -p 54329 -U postgres
--
-- ATURAN YANG DITEGAKKAN DATABASE:
--   * branch_id NOT NULL di tabel operasional: data selalu terikat cabang.
--   * Trigger trg_daily_report_publish: laporan harian tidak bisa terbit
--     sebelum fasilitator utama dipilih, ada aktivitas berbintang dengan
--     aparatus terisi, dan ada minimal 1 foto. published_at otomatis.
--   * Buku Kas tidak dihapus untuk koreksi: koreksi lewat entri reversal.
--   * Investor hanya izin agregat; orang tua hanya izin data anaknya
--     sendiri (pembatasan per anak ditegakkan aplikasi/RLS di atasnya).
--
-- YANG BELUM TERMASUK:
--   * Data operasional: sengaja kosong, dibuat lewat formulir aplikasi.
--   * Polis RLS per cabang/anak: kolom pendukungnya sudah ada.
--   * Akun super admin awal: dibuat internal sekolah, tanpa kata sandi
--     bawaan yang tersebar di file ini.
--
-- DAFTAR 66 TABEL:
--   organizations, branches, users, user_branches, staff, leave_requests,
--   staff_attendance, programs, classes, guardians, children,
--   child_guardians, enrollments, child_attendance, leads,
--   bot_conversations, registrations, learning_cycles, daily_reports,
--   daily_report_activities, daily_report_photos, playdate_reports,
--   playdate_participants, stppa_items, stppa_assessments, cycle_reports,
--   parent_reviews, incident_reports, baby_daily_logs, medication_logs,
--   letter_requests, cash_book_entries, invoices, payments,
--   expense_receipts, payroll_runs, payslips, investor_profiles,
--   branch_capital, candidates, onboarding_programs, onboarding_tasks,
--   staff_kpi_scores, notifications, audit_logs, ai_report_drafts,
--   bot_knowledge_entries, lead_followups, home_activity_catalog,
--   home_activity_suggestions, roles, permissions, role_permissions,
--   user_roles, daily_report_reviews, child_development_records,
--   student_milestones, health_checks, immunizations,
--   medical_examinations, child_allergies, school_events, event_rsvps,
--   parent_messages, announcements, child_documents.
--
-- ERD (Mermaid, dihasilkan dari relasi FK nyata di file ini):
-- # ERD Balita Center (PostgreSQL, 66 tabel)
-- 
-- Dihasilkan dari relasi foreign key nyata di 01_schema.sql: 66 tabel, 158 referensi FK.
-- 
-- ```mermaid
-- erDiagram
--     branches ||--o{ ai_report_drafts : ""
--     branches ||--o{ announcements : ""
--     branches ||--o{ audit_logs : ""
--     branches ||--o{ baby_daily_logs : ""
--     branches ||--o{ bot_knowledge_entries : ""
--     branches ||--o{ branch_capital : ""
--     branches ||--o{ candidates : ""
--     branches ||--o{ cash_book_entries : ""
--     branches ||--o{ child_allergies : ""
--     branches ||--o{ child_attendance : ""
--     branches ||--o{ child_development_records : ""
--     branches ||--o{ child_documents : ""
--     branches ||--o{ children : ""
--     branches ||--o{ classes : ""
--     branches ||--o{ cycle_reports : ""
--     branches ||--o{ daily_report_reviews : ""
--     branches ||--o{ daily_reports : ""
--     branches ||--o{ enrollments : ""
--     branches ||--o{ event_rsvps : ""
--     branches ||--o{ expense_receipts : ""
--     branches ||--o{ health_checks : ""
--     branches ||--o{ immunizations : ""
--     branches ||--o{ incident_reports : ""
--     branches ||--o{ invoices : ""
--     branches ||--o{ leads : ""
--     branches ||--o{ learning_cycles : ""
--     branches ||--o{ leave_requests : ""
--     branches ||--o{ letter_requests : ""
--     branches ||--o{ medical_examinations : ""
--     branches ||--o{ medication_logs : ""
--     branches ||--o{ notifications : ""
--     branches ||--o{ onboarding_programs : ""
--     branches ||--o{ parent_messages : ""
--     branches ||--o{ parent_reviews : ""
--     branches ||--o{ payments : ""
--     branches ||--o{ payroll_runs : ""
--     branches ||--o{ playdate_reports : ""
--     branches ||--o{ registrations : ""
--     branches ||--o{ school_events : ""
--     branches ||--o{ staff : ""
--     branches ||--o{ staff_attendance : ""
--     branches ||--o{ staff_kpi_scores : ""
--     branches ||--o{ stppa_assessments : ""
--     branches ||--o{ student_milestones : ""
--     branches ||--o{ user_branches : ""
--     branches ||--o{ user_roles : ""
--     cash_book_entries ||--o{ expense_receipts : ""
--     cash_book_entries ||--o{ payments : ""
--     cash_book_entries ||--o{ payroll_runs : ""
--     children ||--o{ baby_daily_logs : ""
--     children ||--o{ child_allergies : ""
--     children ||--o{ child_attendance : ""
--     children ||--o{ child_development_records : ""
--     children ||--o{ child_documents : ""
--     children ||--o{ child_guardians : ""
--     children ||--o{ cycle_reports : ""
--     children ||--o{ daily_reports : ""
--     children ||--o{ enrollments : ""
--     children ||--o{ event_rsvps : ""
--     children ||--o{ health_checks : ""
--     children ||--o{ home_activity_suggestions : ""
--     children ||--o{ immunizations : ""
--     children ||--o{ incident_reports : ""
--     children ||--o{ invoices : ""
--     children ||--o{ medical_examinations : ""
--     children ||--o{ medication_logs : ""
--     children ||--o{ parent_messages : ""
--     children ||--o{ playdate_participants : ""
--     children ||--o{ registrations : ""
--     children ||--o{ stppa_assessments : ""
--     children ||--o{ student_milestones : ""
--     classes ||--o{ announcements : ""
--     classes ||--o{ child_attendance : ""
--     classes ||--o{ daily_reports : ""
--     classes ||--o{ enrollments : ""
--     classes ||--o{ learning_cycles : ""
--     classes ||--o{ school_events : ""
--     cycle_reports ||--o{ ai_report_drafts : ""
--     daily_reports ||--o{ ai_report_drafts : ""
--     daily_reports ||--o{ daily_report_activities : ""
--     daily_reports ||--o{ daily_report_photos : ""
--     daily_reports ||--o{ daily_report_reviews : ""
--     daily_reports ||--o{ home_activity_suggestions : ""
--     guardians ||--o{ child_guardians : ""
--     guardians ||--o{ event_rsvps : ""
--     guardians ||--o{ invoices : ""
--     guardians ||--o{ parent_reviews : ""
--     home_activity_catalog ||--o{ home_activity_suggestions : ""
--     investor_profiles ||--o{ branch_capital : ""
--     invoices ||--o{ payments : ""
--     leads ||--o{ bot_conversations : ""
--     leads ||--o{ lead_followups : ""
--     leads ||--o{ registrations : ""
--     learning_cycles ||--o{ child_development_records : ""
--     learning_cycles ||--o{ cycle_reports : ""
--     learning_cycles ||--o{ daily_reports : ""
--     learning_cycles ||--o{ stppa_assessments : ""
--     onboarding_programs ||--o{ onboarding_tasks : ""
--     organizations ||--o{ branches : ""
--     payroll_runs ||--o{ payslips : ""
--     permissions ||--o{ role_permissions : ""
--     playdate_reports ||--o{ playdate_participants : ""
--     programs ||--o{ classes : ""
--     programs ||--o{ enrollments : ""
--     programs ||--o{ leads : ""
--     programs ||--o{ registrations : ""
--     roles ||--o{ role_permissions : ""
--     roles ||--o{ user_roles : ""
--     school_events ||--o{ event_rsvps : ""
--     staff ||--o{ ai_report_drafts : ""
--     staff ||--o{ announcements : ""
--     staff ||--o{ baby_daily_logs : ""
--     staff ||--o{ bot_knowledge_entries : ""
--     staff ||--o{ cash_book_entries : ""
--     staff ||--o{ child_development_records : ""
--     staff ||--o{ classes : ""
--     staff ||--o{ cycle_reports : ""
--     staff ||--o{ daily_report_photos : ""
--     staff ||--o{ daily_report_reviews : ""
--     staff ||--o{ daily_reports : ""
--     staff ||--o{ expense_receipts : ""
--     staff ||--o{ health_checks : ""
--     staff ||--o{ incident_reports : ""
--     staff ||--o{ lead_followups : ""
--     staff ||--o{ leave_requests : ""
--     staff ||--o{ letter_requests : ""
--     staff ||--o{ medication_logs : ""
--     staff ||--o{ onboarding_programs : ""
--     staff ||--o{ parent_reviews : ""
--     staff ||--o{ payments : ""
--     staff ||--o{ payroll_runs : ""
--     staff ||--o{ payslips : ""
--     staff ||--o{ playdate_reports : ""
--     staff ||--o{ school_events : ""
--     staff ||--o{ staff_attendance : ""
--     staff ||--o{ staff_kpi_scores : ""
--     staff ||--o{ stppa_assessments : ""
--     staff ||--o{ student_milestones : ""
--     stppa_items ||--o{ stppa_assessments : ""
--     users ||--o{ audit_logs : ""
--     users ||--o{ candidates : ""
--     users ||--o{ child_documents : ""
--     users ||--o{ guardians : ""
--     users ||--o{ investor_profiles : ""
--     users ||--o{ notifications : ""
--     users ||--o{ parent_messages : ""
--     users ||--o{ staff : ""
--     users ||--o{ user_branches : ""
--     users ||--o{ user_roles : ""
-- ```
-- =====================================================================

-- =====================================================================
-- BAGIAN 1: SKEMA LENGKAP
-- =====================================================================

-- =====================================================================
-- Balita Center: Database PostgreSQL (skema gabungan final, 1 Nov 2026)
-- Satu berkas pasang-dari-nol: 44 tabel bersih PRD + 5 tabel Addendum V2
-- + ekstensi build aplikasi terakhir (RBAC, Review & Approval, Balita
-- Connect, kesehatan, perkembangan, kegiatan, dokumen anak, organisasi).
-- Target: PostgreSQL 13+ (teruji di PostgreSQL 16). UUID memakai
-- gen_random_uuid() bawaan, tanpa ekstensi tambahan.
-- Cara pasang: psql -v ON_ERROR_STOP=1 -f 01_schema.sql
-- =====================================================================

-- Balita Center: skema PostgreSQL hasil pembersihan dari ekspor prd-generator.rotalogic.id (31 Okt 2026).
-- 15 tabel template proyek lama dibuang; tabel Balita Center dilengkapi kolom, branch_id, dan foreign key.
-- Aturan dari PRD Bab 20.7/22.10 yang ditegakkan di sini:
--   branch_id NOT NULL di semua tabel operasional; Buku Kas tanpa DELETE (koreksi = entri reversal);
--   laporan harian hanya terbit bila validasinya terpenuhi (dijaga trigger di akhir berkas).

-- UUID memakai gen_random_uuid() bawaan PostgreSQL 13+, jadi tidak butuh ekstensi apa pun.

-- Fondasi: cabang dan akun


CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    legal_name  VARCHAR(255),
    email       VARCHAR(255),
    phone       VARCHAR(32),
    address     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE branches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    code        VARCHAR(32)  NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    city        VARCHAR(255),
    address     TEXT,
    timezone    VARCHAR(64)  NOT NULL DEFAULT 'Asia/Jakarta',
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name     VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    phone         VARCHAR(32),
    role          VARCHAR(32)  NOT NULL CHECK (role IN (
                      'super_admin','owner','branch_manager','kepala_sekolah',
                      'koordinator_akademik','guru','staf_keuangan','staf_hr',
                      'admin_cabang','staf','orang_tua','investor','kandidat')),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at    TIMESTAMPTZ
);

-- Akses cabang per pengguna: matriks izin peran x cabang dibaca dari tabel ini.
CREATE TABLE user_branches (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, branch_id)
);

-- SDM

CREATE TABLE staff (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL REFERENCES branches(id),
    user_id     UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    full_name   VARCHAR(255) NOT NULL,
    position    VARCHAR(128) NOT NULL,
    phone       VARCHAR(32),
    email       VARCHAR(255),
    joined_on   DATE,
    status      VARCHAR(16) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','cuti_panjang','nonaktif')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE leave_requests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL REFERENCES branches(id),
    staff_id    UUID NOT NULL REFERENCES staff(id),
    kind        VARCHAR(16) NOT NULL CHECK (kind IN ('cuti','izin','lembur')),
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL CHECK (end_date >= start_date),
    reason      TEXT,
    status      VARCHAR(16) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','disetujui','ditolak','dibatalkan')),
    decided_by  UUID REFERENCES staff(id),
    decided_at  TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff_attendance (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id  UUID NOT NULL REFERENCES branches(id),
    staff_id   UUID NOT NULL REFERENCES staff(id),
    work_date  DATE NOT NULL,
    check_in   TIMESTAMPTZ,
    check_out  TIMESTAMPTZ,
    status     VARCHAR(16) NOT NULL DEFAULT 'hadir' CHECK (status IN ('hadir','izin','cuti','sakit','alpa')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (staff_id, work_date)
);

-- Akademik: program, kelas, anak, wali

CREATE TABLE programs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(32)  NOT NULL UNIQUE,
    name              VARCHAR(255) NOT NULL,
    monthly_fee       NUMERIC(14,2),
    screening_fee     NUMERIC(14,2),
    age_min_months    SMALLINT,
    age_max_months    SMALLINT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMPTZ
);

CREATE TABLE classes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id      UUID NOT NULL REFERENCES branches(id),
    program_id     UUID NOT NULL REFERENCES programs(id),
    name           VARCHAR(255) NOT NULL,
    lead_staff_id  UUID REFERENCES staff(id),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at     TIMESTAMPTZ,
    UNIQUE (branch_id, name)
);

CREATE TABLE guardians (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    full_name   VARCHAR(255) NOT NULL,
    phone       VARCHAR(32),
    email       VARCHAR(255),
    relation    VARCHAR(64),
    nik         VARCHAR(32),
    occupation  VARCHAR(128),
    employer    VARCHAR(255),
    address     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE children (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    full_name       VARCHAR(255) NOT NULL,
    nickname        VARCHAR(128),
    birth_date      DATE,
    gender          VARCHAR(16),
    photo_url       TEXT,
    photo_consent   BOOLEAN NOT NULL DEFAULT FALSE,
    health_notes    TEXT,
    birth_place     VARCHAR(255),
    religion        VARCHAR(64),
    address         TEXT,
    blood_type      VARCHAR(8),
    special_needs   TEXT,
    languages       VARCHAR(255),
    hobbies         VARCHAR(255),
    transport_mode  VARCHAR(128),
    enrolled_on     DATE,
    status          VARCHAR(16) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','lulus','keluar','cuti')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE child_guardians (
    child_id    UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
    is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (child_id, guardian_id)
);

CREATE TABLE enrollments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL REFERENCES branches(id),
    child_id    UUID NOT NULL REFERENCES children(id),
    class_id    UUID NOT NULL REFERENCES classes(id),
    program_id  UUID NOT NULL REFERENCES programs(id),
    start_date  DATE NOT NULL,
    end_date    DATE,
    status      VARCHAR(16) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','selesai','berhenti')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE child_attendance (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id  UUID NOT NULL REFERENCES branches(id),
    child_id   UUID NOT NULL REFERENCES children(id),
    class_id   UUID NOT NULL REFERENCES classes(id),
    att_date   DATE NOT NULL,
    status     VARCHAR(16) NOT NULL DEFAULT 'hadir' CHECK (status IN ('hadir','izin','sakit','alpa')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (child_id, att_date)
);

-- Penerimaan murid: bot WhatsApp dan pendaftaran

CREATE TABLE leads (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id         UUID REFERENCES branches(id),
    wa_number         VARCHAR(32) NOT NULL,
    parent_name       VARCHAR(255),
    child_name        VARCHAR(255),
    child_age_months  SMALLINT,
    interested_program_id UUID REFERENCES programs(id),
    source            VARCHAR(32) NOT NULL DEFAULT 'whatsapp_bot',
    bot_status        VARCHAR(24) NOT NULL DEFAULT 'baru' CHECK (bot_status IN ('baru','sudah_kirim_data','diteruskan_ke_admin','terdaftar','tidak_lanjut')),
    last_message_at   TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bot_conversations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    direction    VARCHAR(8) NOT NULL CHECK (direction IN ('masuk','keluar')),
    sender       VARCHAR(16) NOT NULL CHECK (sender IN ('calon_ortu','bot','admin')),
    message_text TEXT NOT NULL,
    answered_by_bot BOOLEAN NOT NULL DEFAULT FALSE,
    escalated    BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE registrations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id          UUID NOT NULL REFERENCES branches(id),
    lead_id            UUID REFERENCES leads(id) ON DELETE SET NULL,
    child_id           UUID REFERENCES children(id) ON DELETE SET NULL,
    program_id         UUID NOT NULL REFERENCES programs(id),
    parent_name        VARCHAR(255) NOT NULL,
    parent_phone       VARCHAR(32),
    child_name         VARCHAR(255) NOT NULL,
    child_birth_date   DATE,
    requested_schedule TEXT,
    screening_fee      NUMERIC(14,2),
    screening_status   VARCHAR(16) NOT NULL DEFAULT 'menunggu' CHECK (screening_status IN ('menunggu','dihubungi','selesai','tidak_lolos')),
    status             VARCHAR(16) NOT NULL DEFAULT 'diterima' CHECK (status IN ('diterima','menunggu','ditolak','terdaftar')),
    registered_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Laporan harian dan perkembangan anak

CREATE TABLE learning_cycles (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id  UUID NOT NULL REFERENCES branches(id),
    class_id   UUID REFERENCES classes(id),
    theme      VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date   DATE NOT NULL CHECK (end_date >= start_date),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_reports (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id         UUID NOT NULL REFERENCES branches(id),
    child_id          UUID NOT NULL REFERENCES children(id),
    class_id          UUID NOT NULL REFERENCES classes(id),
    cycle_id          UUID REFERENCES learning_cycles(id),
    report_date       DATE NOT NULL,
    lead_facilitator_id UUID REFERENCES staff(id),
    observer_id       UUID REFERENCES staff(id),
    meals_text        TEXT,
    snack_text        TEXT,
    nap_start         TIME,
    nap_end           TIME,
    toilet_count      SMALLINT NOT NULL DEFAULT 0,
    circle_theme      VARCHAR(255),
    circle_notes      TEXT,
    special_moment    TEXT,
    notes             TEXT,
    mood              VARCHAR(24) CHECK (mood IN ('sedih','cemas','biasa','ceria','sangat_ceria')),
    mood_notes        TEXT,
    meal_level        VARCHAR(16) CHECK (meal_level IN ('tidak','sedikit','cukup','banyak')),
    snack_level       VARCHAR(16) CHECK (snack_level IN ('tidak','sedikit','cukup','banyak')),
    nap_quality       VARCHAR(16) CHECK (nap_quality IN ('buruk','cukup','baik','sangat_baik')),
    toilet_pee_count  SMALLINT NOT NULL DEFAULT 0,
    toilet_poop_count SMALLINT NOT NULL DEFAULT 0,
    reviewer_notes    TEXT,
    status            VARCHAR(24) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','menunggu_review','revisi','disetujui','published')),
    published_at      TIMESTAMPTZ,
    created_by        UUID NOT NULL REFERENCES staff(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (child_id, report_date)
);

CREATE TABLE daily_report_activities (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id     UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    activity_time TIME,
    area          VARCHAR(128),
    apparatus     VARCHAR(255),
    title         VARCHAR(255) NOT NULL,
    location      VARCHAR(128),
    companion     VARCHAR(128),
    rating        SMALLINT CHECK (rating BETWEEN 1 AND 5),
    notes         TEXT,
    photo_url     TEXT,
    sort_order    SMALLINT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_report_photos (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id  UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    photo_url  TEXT NOT NULL,
    caption    VARCHAR(255),
    media_type VARCHAR(16) NOT NULL DEFAULT 'foto' CHECK (media_type IN ('foto','video')),
    mime_type  VARCHAR(128),
    file_size_bytes BIGINT,
    uploaded_by UUID REFERENCES staff(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE playdate_reports (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    session_date DATE NOT NULL,
    session_label VARCHAR(255),
    created_by   UUID REFERENCES staff(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE playdate_participants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playdate_id UUID NOT NULL REFERENCES playdate_reports(id) ON DELETE CASCADE,
    child_id    UUID REFERENCES children(id),
    guest_name  VARCHAR(255),
    attended    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stppa_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    age_group    VARCHAR(32) NOT NULL,
    aspect       VARCHAR(64) NOT NULL CHECK (aspect IN ('nilai_agama_moral','fisik_motorik','kognitif','bahasa','sosial_emosional','kemandirian')),
    item_text    TEXT NOT NULL,
    sort_order   SMALLINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stppa_assessments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL REFERENCES branches(id),
    child_id    UUID NOT NULL REFERENCES children(id),
    cycle_id    UUID NOT NULL REFERENCES learning_cycles(id),
    item_id     UUID NOT NULL REFERENCES stppa_items(id),
    achieved    BOOLEAN NOT NULL DEFAULT FALSE,
    assessed_by UUID REFERENCES staff(id),
    assessed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (child_id, cycle_id, item_id)
);

CREATE TABLE cycle_reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL REFERENCES branches(id),
    child_id    UUID NOT NULL REFERENCES children(id),
    cycle_id    UUID NOT NULL REFERENCES learning_cycles(id),
    narrative_agama_moral   TEXT,
    narrative_fisik_motorik TEXT,
    narrative_kognitif      TEXT,
    narrative_bahasa        TEXT,
    narrative_sosial_emosional TEXT,
    status      VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
    published_at TIMESTAMPTZ,
    created_by  UUID REFERENCES staff(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (child_id, cycle_id)
);

CREATE TABLE parent_reviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL REFERENCES branches(id),
    guardian_id UUID REFERENCES guardians(id),
    staff_id    UUID REFERENCES staff(id),
    category    VARCHAR(32) NOT NULL CHECK (category IN ('guru','fasilitas','kurikulum','komunikasi','lainnya')),
    rating      SMALLINT CHECK (rating BETWEEN 1 AND 5),
    body        TEXT,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Formulir operasional (akses peran-gated: log kesehatan dan obat sensitif)

CREATE TABLE incident_reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL REFERENCES branches(id),
    child_id    UUID REFERENCES children(id),
    staff_id    UUID REFERENCES staff(id),
    occurred_at TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    action_taken TEXT,
    created_by  UUID REFERENCES staff(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE baby_daily_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    child_id     UUID NOT NULL REFERENCES children(id),
    log_date     DATE NOT NULL,
    feeding_notes TEXT,
    sleep_notes  TEXT,
    diaper_notes TEXT,
    created_by   UUID REFERENCES staff(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (child_id, log_date)
);

CREATE TABLE medication_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     UUID NOT NULL REFERENCES branches(id),
    child_id      UUID NOT NULL REFERENCES children(id),
    medicine_name VARCHAR(255) NOT NULL,
    dose          VARCHAR(128),
    given_at      TIMESTAMPTZ NOT NULL,
    given_by      UUID REFERENCES staff(id),
    guardian_consent BOOLEAN NOT NULL DEFAULT FALSE,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE letter_requests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL REFERENCES branches(id),
    subject     VARCHAR(255) NOT NULL,
    purpose     TEXT,
    activity_name VARCHAR(255),
    event_date  DATE,
    event_time  VARCHAR(128),
    venue       TEXT,
    participants TEXT,
    status      VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','diajukan','selesai')),
    created_by  UUID REFERENCES staff(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Keuangan: Buku Kas, tagihan, investor

CREATE TABLE cash_book_entries (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     UUID NOT NULL REFERENCES branches(id),
    entry_date    DATE NOT NULL,
    direction     VARCHAR(8) NOT NULL CHECK (direction IN ('masuk','keluar')),
    category      VARCHAR(64) NOT NULL,
    description   TEXT,
    amount        NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    source_type   VARCHAR(32) NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','tagihan','spp_massal','nota','payroll','konfirmasi_online')),
    source_id     UUID,
    reversal_of_id UUID REFERENCES cash_book_entries(id),
    is_reversal   BOOLEAN NOT NULL DEFAULT FALSE,
    created_by    UUID REFERENCES staff(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    -- Sengaja tanpa updated_at dan tanpa jalur DELETE: koreksi hanya lewat entri reversal baru.
);

CREATE TABLE invoices (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL REFERENCES branches(id),
    child_id    UUID REFERENCES children(id),
    guardian_id UUID REFERENCES guardians(id),
    period_month DATE NOT NULL,
    description VARCHAR(255),
    amount      NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    status      VARCHAR(16) NOT NULL DEFAULT 'belum_bayar' CHECK (status IN ('belum_bayar','menunggu_konfirmasi','lunas','batal')),
    due_date    DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    invoice_id   UUID NOT NULL REFERENCES invoices(id),
    method       VARCHAR(32),
    amount       NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    status       VARCHAR(16) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','terkonfirmasi','gagal')),
    paid_at      TIMESTAMPTZ,
    confirmed_by UUID REFERENCES staff(id),
    cash_entry_id UUID REFERENCES cash_book_entries(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expense_receipts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     UUID NOT NULL REFERENCES branches(id),
    receipt_url   TEXT,
    vendor        VARCHAR(255),
    receipt_date  DATE,
    total_amount  NUMERIC(14,2),
    ai_extracted  JSONB,
    status        VARCHAR(16) NOT NULL DEFAULT 'menunggu_validasi' CHECK (status IN ('menunggu_validasi','tervalidasi','ditolak')),
    validated_by  UUID REFERENCES staff(id),
    cash_entry_id UUID REFERENCES cash_book_entries(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payroll_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL REFERENCES branches(id),
    period_month DATE NOT NULL,
    status      VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','dibayar','batal')),
    total_amount NUMERIC(14,2),
    paid_at     TIMESTAMPTZ,
    cash_entry_id UUID REFERENCES cash_book_entries(id),
    created_by  UUID REFERENCES staff(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (branch_id, period_month)
);

CREATE TABLE payslips (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id  UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    staff_id    UUID NOT NULL REFERENCES staff(id),
    base_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
    allowances  NUMERIC(14,2) NOT NULL DEFAULT 0,
    deductions  NUMERIC(14,2) NOT NULL DEFAULT 0,
    net_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
    issued_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (payroll_id, staff_id)
);

CREATE TABLE investor_profiles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    full_name   VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE branch_capital (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    investor_id  UUID NOT NULL REFERENCES investor_profiles(id),
    capital_amount NUMERIC(16,2) NOT NULL CHECK (capital_amount >= 0),
    profit_share_phase VARCHAR(64),
    investor_share_pct SMALLINT CHECK (investor_share_pct BETWEEN 0 AND 100),
    manager_share_pct  SMALLINT CHECK (manager_share_pct BETWEEN 0 AND 100),
    recorded_on  DATE NOT NULL DEFAULT CURRENT_DATE,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Rekrutmen dan onboarding

CREATE TABLE candidates (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID REFERENCES branches(id),
    user_id      UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    full_name    VARCHAR(255) NOT NULL,
    phone        VARCHAR(32),
    email        VARCHAR(255),
    position     VARCHAR(128),
    stage        VARCHAR(32) NOT NULL DEFAULT 'screening' CHECK (stage IN ('screening','quick_interview','tes_akademik','keputusan')),
    rating       SMALLINT CHECK (rating BETWEEN 1 AND 5),
    status       VARCHAR(16) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','diterima','ditolak')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE onboarding_programs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id    UUID NOT NULL REFERENCES staff(id),
    mentor_id   UUID REFERENCES staff(id),
    branch_id   UUID NOT NULL REFERENCES branches(id),
    started_on  DATE,
    target_on   DATE,
    status      VARCHAR(16) NOT NULL DEFAULT 'berjalan' CHECK (status IN ('berjalan','selesai','berhenti')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE onboarding_tasks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id  UUID NOT NULL REFERENCES onboarding_programs(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    is_done     BOOLEAN NOT NULL DEFAULT FALSE,
    done_at     TIMESTAMPTZ,
    sort_order  SMALLINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff_kpi_scores (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL REFERENCES branches(id),
    staff_id    UUID NOT NULL REFERENCES staff(id),
    period_month DATE NOT NULL,
    attendance_score NUMERIC(5,2),
    reports_count    INTEGER NOT NULL DEFAULT 0,
    rating_avg       NUMERIC(3,2),
    star_score       NUMERIC(3,2),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (staff_id, period_month)
);

-- Notifikasi dan audit

CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id  UUID REFERENCES branches(id),
    title      VARCHAR(255) NOT NULL,
    body       TEXT,
    link       TEXT,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
    id         BIGSERIAL PRIMARY KEY,
    branch_id  UUID REFERENCES branches(id),
    user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    action     VARCHAR(64) NOT NULL,
    entity_table VARCHAR(64) NOT NULL,
    entity_id  UUID,
    detail     JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indeks untuk filter cabang dan relasi yang paling sering dipakai
CREATE INDEX idx_staff_branch          ON staff(branch_id);
CREATE INDEX idx_classes_branch        ON classes(branch_id);
CREATE INDEX idx_children_branch       ON children(branch_id);
CREATE INDEX idx_enrollments_child     ON enrollments(child_id);
CREATE INDEX idx_child_attendance_date ON child_attendance(branch_id, att_date);
CREATE INDEX idx_daily_reports_child_date ON daily_reports(child_id, report_date);
CREATE INDEX idx_activities_report     ON daily_report_activities(report_id);
CREATE INDEX idx_cash_branch_date      ON cash_book_entries(branch_id, entry_date);
CREATE INDEX idx_invoices_branch_status ON invoices(branch_id, status);
CREATE INDEX idx_payments_invoice      ON payments(invoice_id);
CREATE INDEX idx_leads_wa              ON leads(wa_number);
CREATE INDEX idx_conversations_lead    ON bot_conversations(lead_id, sent_at);
CREATE INDEX idx_reviews_branch_read   ON parent_reviews(branch_id, is_read);
CREATE INDEX idx_leave_branch_status   ON leave_requests(branch_id, status);
CREATE INDEX idx_audit_entity          ON audit_logs(entity_table, entity_id);
CREATE INDEX idx_notifications_user    ON notifications(user_id, is_read);

-- Validasi terbit laporan harian (PRD 20.7): fasilitator utama ada, minimal 1 aktivitas
-- berbintang dengan aparatus terisi, dan minimal 1 foto (di aktivitas atau galeri laporan).
CREATE OR REPLACE FUNCTION check_daily_report_publish() RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
        IF NEW.lead_facilitator_id IS NULL THEN
            RAISE EXCEPTION 'Laporan belum bisa terbit: fasilitator utama belum dipilih';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM daily_report_activities
            WHERE report_id = NEW.id AND rating IS NOT NULL
              AND apparatus IS NOT NULL AND apparatus <> ''
        ) THEN
            RAISE EXCEPTION 'Laporan belum bisa terbit: belum ada aktivitas berbintang dengan aparatus terisi';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM daily_report_activities WHERE report_id = NEW.id AND photo_url IS NOT NULL)
           AND NOT EXISTS (SELECT 1 FROM daily_report_photos WHERE report_id = NEW.id) THEN
            RAISE EXCEPTION 'Laporan belum bisa terbit: minimal 1 foto diperlukan';
        END IF;
        NEW.published_at := CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_report_publish
    BEFORE UPDATE ON daily_reports
    FOR EACH ROW EXECUTE FUNCTION check_daily_report_publish();

-- ===== Addendum V2 (draf AI, Ailsa Belajar, Lanjutan di Rumah) =====

-- Addendum V2 untuk skema Balita Center: dijalankan SETELAH schema-balita-center.sql.
-- Menambah tabel untuk 3 inovasi: draf laporan AI dari suara, bank pengetahuan Bot Ailsa,
-- dan Lanjutan di Rumah. Semua draf AI berstatus menunggu persetujuan manusia.

-- Inovasi 1: guru mendikte atau memotret, AI menyusun draf laporan, guru menyetujui.
CREATE TABLE ai_report_drafts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    report_id    UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
    cycle_report_id UUID REFERENCES cycle_reports(id) ON DELETE CASCADE,
    created_by   UUID NOT NULL REFERENCES staff(id),
    input_type   VARCHAR(16) NOT NULL CHECK (input_type IN ('suara','foto','teks')),
    audio_url    TEXT,
    photo_url    TEXT,
    transcript   TEXT,
    draft_payload JSONB NOT NULL DEFAULT '{}',
    status       VARCHAR(16) NOT NULL DEFAULT 'menunggu_review' CHECK (status IN ('menunggu_review','diterima','diedit','ditolak')),
    reviewed_by  UUID REFERENCES staff(id),
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (report_id IS NOT NULL OR cycle_report_id IS NOT NULL)
);

-- Inovasi 2: bank pengetahuan Ailsa. Jawaban hanya aktif setelah disetujui admin.
CREATE TABLE bot_knowledge_entries (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     UUID REFERENCES branches(id),
    question_sample TEXT NOT NULL,
    answer_text   TEXT NOT NULL,
    source_ref    VARCHAR(255),
    status        VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','aktif','nonaktif')),
    approved_by   UUID REFERENCES staff(id),
    approved_at   TIMESTAMPTZ,
    use_count     INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Inovasi 2: tindak lanjut terjadwal untuk lead yang berhenti merespons.
CREATE TABLE lead_followups (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    channel      VARCHAR(16) NOT NULL DEFAULT 'whatsapp',
    template_text TEXT,
    status       VARCHAR(16) NOT NULL DEFAULT 'terjadwal' CHECK (status IN ('terjadwal','terkirim','dibatalkan','dibalas')),
    sent_at      TIMESTAMPTZ,
    created_by   UUID REFERENCES staff(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Inovasi 3: katalog aktivitas rumah yang dipasangkan ke aparatus atau area Montessori.
CREATE TABLE home_activity_catalog (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area         VARCHAR(128),
    apparatus    VARCHAR(255),
    age_group    VARCHAR(32),
    title        VARCHAR(255) NOT NULL,
    instructions TEXT NOT NULL,
    materials    TEXT,
    duration_minutes SMALLINT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Inovasi 3: saran yang benar-benar terkirim ke orang tua, menempel pada laporan harian terbit.
CREATE TABLE home_activity_suggestions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id    UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    child_id     UUID NOT NULL REFERENCES children(id),
    catalog_id   UUID REFERENCES home_activity_catalog(id),
    custom_text  TEXT,
    sent_at      TIMESTAMPTZ,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_drafts_report  ON ai_report_drafts(report_id, status);
CREATE INDEX idx_ai_drafts_branch  ON ai_report_drafts(branch_id, created_at);
CREATE INDEX idx_bot_kb_status     ON bot_knowledge_entries(branch_id, status);
CREATE INDEX idx_followups_due     ON lead_followups(status, scheduled_at);
CREATE INDEX idx_home_sugg_report  ON home_activity_suggestions(report_id);

-- ===== Ekstensi build aplikasi terakhir =====

-- Balita Center: ekstensi skema untuk build aplikasi terakhir (31 Okt - 1 Nov 2026).
-- Menambah RBAC penuh, alur Review & Approval, Balita Connect (pesan, kegiatan, kesehatan,
-- perkembangan), dokumen anak, dan organisasi induk. Dijalankan sebagai bagian dari
-- 01_schema.sql gabungan; berkas ini disimpan terpisah hanya sebagai sumber audit perubahannya.

-- Organisasi induk (satu organisasi membawahi banyak cabang)

-- RBAC: peran, izin, dan pemetaannya (melengkapi kolom users.role yang sudah ada)
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(48) NOT NULL UNIQUE,
    name        VARCHAR(128) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(96) NOT NULL UNIQUE,
    module      VARCHAR(64) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    branch_id  UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id, branch_id)
);

-- Review & Approval laporan harian (kepala sekolah / reviewer)
CREATE TABLE daily_report_reviews (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    report_id    UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    reviewer_id  UUID NOT NULL REFERENCES staff(id),
    action       VARCHAR(24) NOT NULL CHECK (action IN ('setujui','kembalikan_revisi','terbitkan','komentar')),
    notes        TEXT,
    reviewed_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Perkembangan anak: catatan berkala per aspek + milestone
CREATE TABLE child_development_records (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    child_id     UUID NOT NULL REFERENCES children(id),
    cycle_id     UUID REFERENCES learning_cycles(id),
    recorded_on  DATE NOT NULL DEFAULT CURRENT_DATE,
    physical_pct    SMALLINT CHECK (physical_pct BETWEEN 0 AND 100),
    gross_motor_pct SMALLINT CHECK (gross_motor_pct BETWEEN 0 AND 100),
    fine_motor_pct  SMALLINT CHECK (fine_motor_pct BETWEEN 0 AND 100),
    cognitive_pct   SMALLINT CHECK (cognitive_pct BETWEEN 0 AND 100),
    language_pct    SMALLINT CHECK (language_pct BETWEEN 0 AND 100),
    social_emotional_pct SMALLINT CHECK (social_emotional_pct BETWEEN 0 AND 100),
    independence_pct     SMALLINT CHECK (independence_pct BETWEEN 0 AND 100),
    teacher_notes TEXT,
    parent_recommendations TEXT,
    recorded_by  UUID REFERENCES staff(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_milestones (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    child_id     UUID NOT NULL REFERENCES children(id),
    category     VARCHAR(32) NOT NULL CHECK (category IN ('fisik','motorik_kasar','motorik_halus','kognitif','bahasa','sosial_emosional','kemandirian')),
    title        VARCHAR(255) NOT NULL,
    achieved_on  DATE,
    notes        TEXT,
    recorded_by  UUID REFERENCES staff(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Kesehatan anak: pemeriksaan, imunisasi, riwayat medis, alergi
CREATE TABLE health_checks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    child_id     UUID NOT NULL REFERENCES children(id),
    checked_on   DATE NOT NULL DEFAULT CURRENT_DATE,
    temperature_c NUMERIC(4,1),
    heart_rate_bpm SMALLINT,
    respiratory_rate SMALLINT,
    weight_kg    NUMERIC(5,2),
    height_cm    NUMERIC(5,1),
    head_circumference_cm NUMERIC(5,1),
    condition    VARCHAR(255),
    notes        TEXT,
    checked_by   UUID REFERENCES staff(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE immunizations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    child_id     UUID NOT NULL REFERENCES children(id),
    vaccine_name VARCHAR(128) NOT NULL,
    dose_label   VARCHAR(64),
    given_on     DATE,
    provider     VARCHAR(255),
    status       VARCHAR(16) NOT NULL DEFAULT 'selesai' CHECK (status IN ('selesai','terjadwal','terlewat')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE medical_examinations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    child_id     UUID NOT NULL REFERENCES children(id),
    exam_type    VARCHAR(128) NOT NULL,
    examined_on  DATE NOT NULL,
    provider     VARCHAR(255),
    result       VARCHAR(32) NOT NULL DEFAULT 'normal',
    notes        TEXT,
    document_url TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE child_allergies (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    child_id     UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    allergen     VARCHAR(255) NOT NULL,
    severity     VARCHAR(16) NOT NULL DEFAULT 'ringan' CHECK (severity IN ('ringan','sedang','berat')),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Kegiatan sekolah dan RSVP orang tua
CREATE TABLE school_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    class_id     UUID REFERENCES classes(id),
    title        VARCHAR(255) NOT NULL,
    category     VARCHAR(32) NOT NULL DEFAULT 'pembelajaran' CHECK (category IN ('pembelajaran','kesehatan','motorik','kreativitas','sosial','event_khusus','kunjungan','libur')),
    description  TEXT,
    event_date   DATE NOT NULL,
    start_time   TIME,
    end_time     TIME,
    location     VARCHAR(255),
    teacher_id   UUID REFERENCES staff(id),
    rsvp_deadline TIMESTAMPTZ,
    is_holiday   BOOLEAN NOT NULL DEFAULT FALSE,
    created_by   UUID REFERENCES staff(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMPTZ
);

CREATE TABLE event_rsvps (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    event_id     UUID NOT NULL REFERENCES school_events(id) ON DELETE CASCADE,
    child_id     UUID NOT NULL REFERENCES children(id),
    guardian_id  UUID REFERENCES guardians(id),
    response     VARCHAR(16) NOT NULL CHECK (response IN ('hadir','tidak_hadir')),
    responded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (event_id, child_id)
);

-- Balita Connect: pesan orang tua dan pengumuman
CREATE TABLE parent_messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    child_id     UUID REFERENCES children(id),
    sender_user_id UUID NOT NULL REFERENCES users(id),
    recipient_user_id UUID REFERENCES users(id),
    subject      VARCHAR(255),
    body         TEXT NOT NULL,
    attachment_url TEXT,
    attachment_type VARCHAR(32),
    is_pinned    BOOLEAN NOT NULL DEFAULT FALSE,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    read_at      TIMESTAMPTZ,
    sent_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE announcements (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID REFERENCES branches(id),
    title        VARCHAR(255) NOT NULL,
    body         TEXT NOT NULL,
    audience     VARCHAR(32) NOT NULL DEFAULT 'semua_orang_tua' CHECK (audience IN ('semua_orang_tua','kelas','staf','semua')),
    class_id     UUID REFERENCES classes(id),
    attachment_url TEXT,
    is_pinned    BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    created_by   UUID REFERENCES staff(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Dokumen anak (akta kelahiran, kartu keluarga, kartu imunisasi, foto, dokumen kesehatan)
CREATE TABLE child_documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id),
    child_id     UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    doc_type     VARCHAR(48) NOT NULL CHECK (doc_type IN ('akta_kelahiran','kartu_keluarga','kartu_imunisasi','foto_anak','dokumen_kesehatan','lainnya')),
    file_name    VARCHAR(255),
   file_url     TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type    VARCHAR(128),
    uploaded_by  UUID REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_report        ON daily_report_reviews(report_id, reviewed_at);
CREATE INDEX idx_dev_records_child     ON child_development_records(child_id, recorded_on);
CREATE INDEX idx_milestones_child      ON student_milestones(child_id, category);
CREATE INDEX idx_health_child_date     ON health_checks(child_id, checked_on);
CREATE INDEX idx_immunizations_child   ON immunizations(child_id, given_on);
CREATE INDEX idx_events_branch_date    ON school_events(branch_id, event_date);
CREATE INDEX idx_rsvps_event           ON event_rsvps(event_id);
CREATE INDEX idx_messages_recipient    ON parent_messages(recipient_user_id, is_read, sent_at);
CREATE INDEX idx_messages_child        ON parent_messages(child_id, sent_at);
CREATE INDEX idx_announcements_branch  ON announcements(branch_id, published_at);
CREATE INDEX idx_documents_child       ON child_documents(child_id, doc_type);
CREATE INDEX idx_user_roles_user       ON user_roles(user_id);

-- =====================================================================
-- BAGIAN 2: SEED REFERENSI RBAC
-- =====================================================================

-- Balita Center: data referensi awal (BUKAN data operasional).
-- Hanya peran dan izin RBAC. Tidak ada cabang, anak, staf, atau angka contoh:
-- data operasional dibuat lewat formulir aplikasi / impor resmi sekolah.
-- Jalankan SETELAH 01_schema.sql. Aman dijalankan ulang (ON CONFLICT DO NOTHING).

INSERT INTO roles (code, name, description) VALUES
  ('super_admin',          'Super Admin',           'Akses penuh semua cabang dan pengaturan sistem'),
  ('owner',                'Owner / Director',      'Pemilik: semua laporan dan agregat lintas cabang'),
  ('investor',             'Investor',              'Hanya laporan agregat, tanpa data anak teridentifikasi'),
  ('branch_manager',       'Branch Manager',        'Pengelola satu cabang: operasional, keuangan, SDM cabang'),
  ('kepala_sekolah',       'Principal / Kepala Sekolah', 'Persetujuan laporan harian, penerimaan, dan laporan cabang'),
  ('koordinator_akademik', 'Academic Coordinator',  'Kurikulum, STPPA, review laporan dan perkembangan'),
  ('guru',                 'Teacher / Guru',        'Kelasnya sendiri: laporan harian, kesehatan, pesan orang tua'),
  ('staf_keuangan',        'Finance Staff',         'Tagihan, pembayaran, buku kas, payroll'),
  ('staf_hr',              'HR Staff',              'Data staf, cuti, kehadiran staf, rekrutmen'),
  ('orang_tua',            'Parent / Orang Tua',    'Hanya data anaknya sendiri lewat Balita Connect')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, module, description) VALUES
  ('dashboard.view',        'dashboard',    'Melihat dashboard sesuai peran'),
  ('students.view',         'anak_didik',   'Melihat data anak didik'),
  ('students.create',       'anak_didik',   'Menambah data anak didik'),
  ('students.update',       'anak_didik',   'Mengubah data anak didik'),
  ('daily_reports.create',  'daily_report', 'Membuat dan mengedit draf laporan harian'),
  ('daily_reports.review',  'daily_report', 'Meninjau, menyetujui, atau mengembalikan laporan harian'),
  ('daily_reports.publish', 'daily_report', 'Menerbitkan laporan harian ke orang tua'),
  ('child.view_own',        'balita_connect','Orang tua melihat data anaknya sendiri'),
  ('health.view',           'kesehatan',    'Melihat data kesehatan anak'),
  ('health.update',         'kesehatan',    'Mengisi pemeriksaan dan catatan kesehatan anak'),
  ('messages.send',         'komunikasi',   'Mengirim pesan di Balita Connect'),
  ('events.manage',         'kegiatan',     'Mengelola kegiatan sekolah'),
  ('events.rsvp',           'kegiatan',     'Orang tua konfirmasi kehadiran kegiatan'),
  ('admission.manage',      'admission',    'Mengelola penerimaan murid dan Bot Ailsa'),
  ('finance.view',          'keuangan',     'Melihat keuangan cabang'),
  ('finance.manage',        'keuangan',     'Mengelola tagihan, pembayaran, buku kas, payroll'),
  ('hr.view',               'sdm',          'Melihat data SDM'),
  ('hr.manage',             'sdm',          'Mengelola staf, cuti, dan rekrutmen'),
  ('branches.manage',       'cabang',       'Mengelola cabang'),
  ('reports.view',          'laporan',      'Melihat laporan operasional'),
  ('investor.view_aggregate','investor',    'Melihat laporan investor teragregasi'),
  ('users.manage',          'pengaturan',   'Mengelola pengguna, peran, dan izin'),
  ('settings.manage',       'pengaturan',   'Mengelola pengaturan sistem dan cabang')
ON CONFLICT (code) DO NOTHING;

-- Super Admin dan Owner: semua izin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('super_admin','owner')
ON CONFLICT DO NOTHING;

-- Investor: hanya agregat
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
  ('dashboard.view','reports.view','investor.view_aggregate')
WHERE r.code = 'investor'
ON CONFLICT DO NOTHING;

-- Branch Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
  ('dashboard.view','students.view','students.create','students.update',
   'daily_reports.create','daily_reports.review','daily_reports.publish',
   'health.view','health.update','messages.send','events.manage',
   'admission.manage','finance.view','finance.manage','hr.view','hr.manage',
   'reports.view')
WHERE r.code = 'branch_manager'
ON CONFLICT DO NOTHING;

-- Kepala Sekolah
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
  ('dashboard.view','students.view','students.create','students.update',
   'daily_reports.review','daily_reports.publish','health.view',
   'messages.send','events.manage','admission.manage','finance.view',
   'hr.view','reports.view')
WHERE r.code = 'kepala_sekolah'
ON CONFLICT DO NOTHING;

-- Koordinator Akademik
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
  ('dashboard.view','students.view','daily_reports.create','daily_reports.review',
   'health.view','messages.send','events.manage','reports.view')
WHERE r.code = 'koordinator_akademik'
ON CONFLICT DO NOTHING;

-- Guru: kelasnya sendiri (pembatasan kelas ditegakkan di lapisan aplikasi/RLS)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
  ('dashboard.view','students.view','daily_reports.create','health.view',
   'health.update','messages.send')
WHERE r.code = 'guru'
ON CONFLICT DO NOTHING;

-- Staf Keuangan
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
  ('dashboard.view','finance.view','finance.manage','reports.view')
WHERE r.code = 'staf_keuangan'
ON CONFLICT DO NOTHING;

-- Staf HR
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
  ('dashboard.view','hr.view','hr.manage','reports.view')
WHERE r.code = 'staf_hr'
ON CONFLICT DO NOTHING;

-- Orang Tua: hanya anaknya sendiri
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
  ('child.view_own','messages.send','events.rsvp','health.view')
WHERE r.code = 'orang_tua'
ON CONFLICT DO NOTHING;

-- =====================================================================
-- BAGIAN 3: VERIFIKASI (hanya SELECT, tidak mengubah data)
-- Hasil yang diharapkan: 66 tabel, 158 foreign key, 10 peran, 23 izin,
-- 105 pemetaan peran-izin.
-- =====================================================================
SELECT 'tabel' AS pemeriksaan, COUNT(*) AS jumlah
  FROM information_schema.tables WHERE table_schema = 'public'
UNION ALL
SELECT 'foreign_key', COUNT(*)
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY' AND constraint_schema = 'public'
UNION ALL
SELECT 'peran', COUNT(*) FROM roles
UNION ALL
SELECT 'izin', COUNT(*) FROM permissions
UNION ALL
SELECT 'pemetaan_peran_izin', COUNT(*) FROM role_permissions;

