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
