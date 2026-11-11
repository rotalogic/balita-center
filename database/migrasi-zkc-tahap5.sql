-- Migrasi ZKC Tahap 5: Website publik — artikel Wawasan & dua lowongan
-- karier resmi yang menjadi pintu depan modul Rekrutmen.
-- Acuan: Prompt Gabungan Sistem & Website ZKC & SAM (Website Publik; Bagian
-- Karier; Blog dan Edukasi Orang Tua).
BEGIN;

CREATE TABLE IF NOT EXISTS artikel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(120) NOT NULL UNIQUE,
  judul VARCHAR(300) NOT NULL,
  kategori VARCHAR(120),
  tanggal_terbit DATE,
  isi TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sembilan artikel Wawasan: judul & kategori persis dari prompt; isi utuh
-- adalah bahan lembaga (diisi tanpa mengubah susunan halaman).
INSERT INTO artikel (slug, judul, kategori, tanggal_terbit) VALUES
  ('regulasi-sebelum-akademik', 'Regulasi Sebelum Akademik', 'Perkembangan Anak', '2026-11-02'),
  ('calistung-itu-akibat-bukan-syarat', 'Calistung Itu Akibat, Bukan Syarat', 'Literasi Dini', '2026-11-04'),
  ('mengenali-tanda-awal-kesulitan-membaca', 'Mengenali Tanda Awal Kesulitan Membaca', 'Kesadaran Disleksia', '2026-11-06'),
  ('sensory-play-bukan-sekadar-main-kotor', 'Sensory Play Bukan Sekadar Main Kotor', 'Bermain & Sensori', '2026-11-09'),
  ('anak-bergerak-bukan-anak-tidak-bisa-diam', 'Anak Bergerak Bukan Anak Tidak Bisa Diam', 'Gerak & Regulasi', '2026-11-11'),
  ('apa-itu-montessori', 'Apa Itu Montessori: Pengertian, Tujuan, Manfaat, dan Mengapa Montessori', 'Montessori untuk Orang Tua', '2026-11-13'),
  ('memahami-tahapan-perkembangan-anak-0-6', 'Memahami Tahapan Perkembangan Anak Usia 0 sampai 6 Tahun', 'Perkembangan Anak', '2026-11-16'),
  ('pola-asuh-yang-menumbuhkan-anak-mandiri', 'Pola Asuh yang Menumbuhkan Anak Mandiri', 'Pola Asuh', '2026-11-18'),
  ('stimulasi-sederhana-di-rumah-sesuai-usia', 'Stimulasi Sederhana di Rumah Sesuai Usia Anak', 'Stimulasi di Rumah', '2026-11-20')
ON CONFLICT (slug) DO NOTHING;

-- Dua kartu lowongan resmi website. Syarat pokok pada kartu sama persis
-- dengan syarat mutlak penyaringan di modul Rekrutmen.
INSERT INTO lowongan (judul, program_label, deskripsi, syarat_mutlak, pertanyaan, status)
SELECT 'Guru Pendamping Ziel Kids Club', 'Ziel Kids Club',
  'Mendampingi anak usia 6 bulan sampai 6 tahun pada program fondasi perkembangan Ziel Kids Club: observasi, pendampingan kegiatan, dan penulisan laporan perkembangan bersama tim guru.',
  '["Pendidikan yang relevan dengan anak usia dini","Berdomisili di Malang atau bersedia pindah","Bersedia bekerja termasuk hari Sabtu","Bersedia bekerja dalam batas pendampingan non klinis"]'::jsonb,
  '["Apa alasan kuat dan motivasi Anda ingin bekerja di lembaga ini?","Ceritakan pengalaman Anda membersamai anak usia dini.","Bagaimana cara Anda menghadapi anak yang sedang tantrum atau belum teratur?","Apa yang Anda lakukan bila melihat tanda perkembangan anak yang memerlukan perhatian khusus?"]'::jsonb,
  'buka'
WHERE NOT EXISTS (SELECT 1 FROM lowongan WHERE judul = 'Guru Pendamping Ziel Kids Club');

INSERT INTO lowongan (judul, program_label, deskripsi, syarat_mutlak, pertanyaan, status)
SELECT 'Guide Sekolah Alam Montessori', 'Sekolah Alam Montessori',
  'Menjadi guide pada lingkungan Montessori autentik NIDO dan CASA: menyiapkan lingkungan, mempresentasikan material, mencatat observasi faktual, dan membersamai kehidupan Islam sehari-hari anak.',
  '["Pendidikan yang relevan dengan anak usia dini","Berdomisili di Malang atau bersedia pindah","Bersedia bekerja termasuk hari Sabtu","Bersedia bekerja dalam batas pendampingan non klinis","Memiliki jalur Montessori (pelatihan/sertifikasi atau sedang menempuh)","Bersedia membersamai kehidupan Islam sehari-hari anak"]'::jsonb,
  '["Apa alasan kuat dan motivasi Anda ingin bekerja di lembaga ini?","Ceritakan jalur dan pengalaman Montessori Anda.","Bagaimana Anda menyiapkan lingkungan belajar yang tenang dan tertib?","Bagaimana Anda membersamai kehidupan Islam sehari-hari anak di kelas?"]'::jsonb,
  'buka'
WHERE NOT EXISTS (SELECT 1 FROM lowongan WHERE judul = 'Guide Sekolah Alam Montessori');

COMMIT;
