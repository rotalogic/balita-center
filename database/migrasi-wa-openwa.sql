-- Gateway WhatsApp OpenWA (gateway mandiri, github.com/rmyndharis/OpenWA)
-- sebagai alternatif kanal Meta Cloud API untuk Ailsa, beserta antrean
-- pesan keluar beritme aman: setiap pesan divariasikan, jeda 10 detik antar
-- pesan, dan jeda 10 menit sesudah setiap 10 pesan terkirim.
-- Pengaturan tersimpan di bot_settings (pola yang sama dengan kunci LLM &
-- Midtrans): diisi admin dari aplikasi, tampil hanya tersamar.
ALTER TABLE bot_settings
  ADD COLUMN IF NOT EXISTS wa_provider varchar(12) NOT NULL DEFAULT 'meta',
  ADD COLUMN IF NOT EXISTS openwa_base_url text,
  ADD COLUMN IF NOT EXISTS openwa_api_key text,
  ADD COLUMN IF NOT EXISTS openwa_session_id text,
  ADD COLUMN IF NOT EXISTS wa_openwa_aktif boolean NOT NULL DEFAULT false;

-- Antrean pesan keluar WhatsApp (hanya dipakai bila provider OpenWA aktif).
CREATE TABLE IF NOT EXISTS wa_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tujuan varchar(32) NOT NULL,
  teks_asli text NOT NULL,
  teks_terkirim text,
  konteks jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(16) NOT NULL DEFAULT 'antre'
    CHECK (status IN ('antre', 'mengirim', 'terkirim', 'gagal')),
  percobaan smallint NOT NULL DEFAULT 0,
  pesan_error text,
  gateway_id text,
  dijadwalkan_at timestamptz NOT NULL DEFAULT now(),
  dibuat_at timestamptz NOT NULL DEFAULT now(),
  terkirim_at timestamptz,
  dibuat_oleh uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS wa_outbox_antre_idx ON wa_outbox (status, dijadwalkan_at, dibuat_at);

-- Keadaan ritme pengiriman (satu baris): kapan terakhir mengirim, sudah
-- berapa pesan pada kelompok berjalan, dan sampai kapan jeda kelompok.
CREATE TABLE IF NOT EXISTS wa_ritme (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  terakhir_kirim_at timestamptz,
  hitungan_batch smallint NOT NULL DEFAULT 0,
  jeda_sampai timestamptz
);
INSERT INTO wa_ritme (id) VALUES (1) ON CONFLICT DO NOTHING;
