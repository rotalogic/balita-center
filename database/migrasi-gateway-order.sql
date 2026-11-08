-- Migrasi: penanda transaksi gateway pada pembayaran, untuk pembayaran
-- sebagian (cicilan) via Midtrans dan idempotensi webhook.
-- Satu order_id Midtrans hanya boleh tercatat satu kali.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_order_id text;
CREATE UNIQUE INDEX IF NOT EXISTS payments_gateway_order_unik
  ON payments (gateway_order_id) WHERE gateway_order_id IS NOT NULL;
