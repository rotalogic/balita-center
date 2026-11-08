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
