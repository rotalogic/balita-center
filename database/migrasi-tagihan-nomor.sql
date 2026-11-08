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
