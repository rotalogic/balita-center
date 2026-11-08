-- Kunci LLM Ailsa yang diisi admin dari halaman Ailsa (pengganti wajib-env).
-- Kunci tersimpan di bot_settings baris tunggal; tidak pernah ditampilkan
-- kembali ke peramban selain 4 karakter terakhir.
ALTER TABLE bot_settings
  ADD COLUMN IF NOT EXISTS llm_api_key text,
  ADD COLUMN IF NOT EXISTS llm_model varchar(64),
  ADD COLUMN IF NOT EXISTS llm_base_url text;
