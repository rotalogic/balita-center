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
