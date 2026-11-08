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
