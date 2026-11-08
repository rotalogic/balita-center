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
