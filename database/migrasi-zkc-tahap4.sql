-- Migrasi ZKC Tahap 4: Skema Biaya Final/Rancangan (kunci server) · Surat &
-- Proposal bernomor otomatis · Masukan Orang Tua · Penilaian Guru oleh Wali
-- & Papan Poin · Standar Kompetensi & Probation · Rekrutmen · Kalender
-- tiga lapis.
-- Acuan: Prompt Gabungan Sistem & Website ZKC & SAM (Modul Keuangan; Modul
-- Surat dan Proposal; Modul Masukan Orang Tua; Modul SDM; Modul Kalender).
BEGIN;

-- ---------- Skema Biaya ----------
CREATE TABLE IF NOT EXISTS skema_biaya (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  nama VARCHAR(200) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'rancangan'
    CHECK (status IN ('final','rancangan')),
  komponen JSONB NOT NULL DEFAULT '[]',
  keterangan TEXT,
  difinalkan_oleh UUID REFERENCES users(id),
  difinalkan_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE programs ADD COLUMN IF NOT EXISTS skema_id UUID REFERENCES skema_biaya(id);

-- ---------- Surat & Proposal ----------
CREATE TABLE IF NOT EXISTS surat_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(200) NOT NULL,
  kode_jenis VARCHAR(16) NOT NULL,
  perihal_default VARCHAR(300),
  isi TEXT NOT NULL,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS surat_counter (
  tahun INT NOT NULL,
  kode_jenis VARCHAR(16) NOT NULL,
  terakhir INT NOT NULL DEFAULT 0,
  PRIMARY KEY (tahun, kode_jenis)
);
CREATE TABLE IF NOT EXISTS surat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  template_id UUID REFERENCES surat_template(id),
  kode_jenis VARCHAR(16) NOT NULL,
  nomor VARCHAR(64) UNIQUE,
  urut INT,
  perihal VARCHAR(300) NOT NULL,
  tujuan VARCHAR(300),
  isi TEXT NOT NULL,
  variabel JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(16) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','terbit','arsip')),
  diterbitkan_oleh UUID REFERENCES users(id),
  diterbitkan_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Masukan Orang Tua ----------
CREATE TABLE IF NOT EXISTS masukan_ortu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id),
  child_name VARCHAR(200) NOT NULL,
  guardian_email VARCHAR(200) NOT NULL,
  periode VARCHAR(7) NOT NULL,
  aspek JSONB NOT NULL DEFAULT '{}',
  cerita TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'baru'
    CHECK (status IN ('baru','dibaca','ditindaklanjuti')),
  tindak_lanjut TEXT,
  ditindak_oleh UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (child_id, periode, guardian_email)
);

-- ---------- Penilaian Guru oleh Wali Murid + Papan Poin ----------
CREATE TABLE IF NOT EXISTS penilaian_guru (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  child_id UUID NOT NULL REFERENCES children(id),
  guardian_email VARCHAR(200) NOT NULL,
  periode VARCHAR(7) NOT NULL,
  aspek JSONB NOT NULL DEFAULT '{}',
  -- Poin internal hasil ubahan skala kata (Sangat Baik=4 … Perlu
  -- Perbaikan=1), dihitung server; tidak pernah tampil ke orang tua/guru
  -- sebagai "nilai bintang" — guru hanya membaca rata-rata aspek & cerita.
  poin NUMERIC(4,2) NOT NULL,
  cerita TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (child_id, staff_id, periode, guardian_email)
);

-- ---------- Standar Kompetensi & Probation ----------
CREATE TABLE IF NOT EXISTS kompetensi_penilaian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  semester VARCHAR(16) NOT NULL,
  gugus JSONB NOT NULL DEFAULT '[]',
  penilai_nama VARCHAR(200),
  catatan TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kompetensi_staff ON kompetensi_penilaian (staff_id, created_at DESC);

CREATE TABLE IF NOT EXISTS probation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL UNIQUE REFERENCES staff(id),
  mulai DATE NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'berjalan'
    CHECK (status IN ('berjalan','selesai')),
  hasil VARCHAR(20) CHECK (hasil IN ('diangkat','diperpanjang','tidak_lanjut')),
  pelanggaran_berat BOOLEAN NOT NULL DEFAULT false,
  pelanggaran_keterangan TEXT,
  pelanggaran_at TIMESTAMPTZ,
  persetujuan JSONB NOT NULL DEFAULT '{}',
  rencana_perbaikan TEXT,
  perpanjangan_bulan SMALLINT,
  diputuskan_oleh UUID REFERENCES users(id),
  diputuskan_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Rekrutmen ----------
CREATE TABLE IF NOT EXISTS lowongan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  judul VARCHAR(200) NOT NULL,
  program_label VARCHAR(200),
  deskripsi TEXT,
  syarat_mutlak JSONB NOT NULL DEFAULT '[]',
  pertanyaan JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(16) NOT NULL DEFAULT 'buka' CHECK (status IN ('buka','tutup')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lamaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lowongan_id UUID NOT NULL REFERENCES lowongan(id),
  nama VARCHAR(200) NOT NULL,
  email VARCHAR(200),
  wa_number VARCHAR(32),
  cv_nama VARCHAR(300) NOT NULL,
  cv_url TEXT,
  syarat JSONB NOT NULL DEFAULT '{}',
  jawaban JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'masuk'
    CHECK (status IN ('masuk','tidak_memenuhi','tersaring','wawancara','observasi','diterima','ditolak','onboarding')),
  catatan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Kalender Tiga Lapis ----------
CREATE TABLE IF NOT EXISTS kalender_entri (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  tanggal DATE NOT NULL,
  judul VARCHAR(300) NOT NULL,
  lapis VARCHAR(16) NOT NULL CHECK (lapis IN ('momen','pembelajaran','dapodik')),
  keterangan TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kalender_tanggal ON kalender_entri (tanggal);

-- Template surat resmi lembaga (Paket Surat & Proposal ZKC SAM, 8 template,
-- 6 kode: KSM, PRP, UND, PBR, RJK, MOU). Isi memakai penanda [kurung siku]
-- yang dilengkapi staf saat membuat surat; kop tiga baris ditambahkan saat
-- cetak, bukan di dalam isi. Nomor terbit berformat NNN/KODE/ZKC-SAM/BULAN/
-- TAHUN (lihat formatNomorSurat di src/lib/tahap4.ts).
INSERT INTO surat_template (nama, kode_jenis, perihal_default, isi)
SELECT 'Surat Permohonan Kerja Sama (Umum)', 'KSM', 'Permohonan Kerja Sama [bidang kerja sama]',
  'Yth. [nama pimpinan], [nama lembaga tujuan], di tempat' || chr(10) || chr(10) ||
  'Assalamu''alaikum warahmatullahi wabarakatuh. Semoga Bapak/Ibu senantiasa dalam keadaan sehat.' || chr(10) || chr(10) ||
  'Kami dari Ziel Kids Club dan Sekolah Alam Montessori, pusat perkembangan anak dan prasekolah Montessori di Malang, bermaksud mengajukan kerja sama dengan [nama lembaga tujuan] dalam bidang [bidang kerja sama, misalnya edukasi literasi dan deteksi dini kesulitan belajar bagi guru dan orang tua]. Kerja sama ini berangkat dari kepedulian yang sama terhadap [alasan singkat yang menghubungkan kedua lembaga].' || chr(10) || chr(10) ||
  'Bentuk kerja sama yang kami usulkan adalah [bentuk kegiatan], yang direncanakan pada [waktu rencana] di [tempat rencana], tanpa dipungut biaya bagi peserta, dengan pembagian peran sebagaimana kami uraikan pada proposal terlampir atau yang akan kami sampaikan pada pertemuan penjajakan.' || chr(10) || chr(10) ||
  'Kami berharap Bapak/Ibu berkenan meluangkan waktu untuk berdiskusi lebih lanjut. Kami dapat dihubungi melalui CS kami di +62 851-1762-3313. Atas perhatian dan kesediaannya, kami mengucapkan terima kasih.' || chr(10) || chr(10) ||
  'Wassalamu''alaikum warahmatullahi wabarakatuh.' || chr(10) || chr(10) || 'Hormat kami,' || chr(10) || chr(10) ||
  'Ayu Najiba, Founder Ziel Kids Club & Sekolah Alam Montessori'
WHERE NOT EXISTS (SELECT 1 FROM surat_template WHERE nama = 'Surat Permohonan Kerja Sama (Umum)');
INSERT INTO surat_template (nama, kode_jenis, perihal_default, isi)
SELECT 'Surat Balasan Penawaran Kerja Sama', 'KSM', 'Tanggapan atas Penawaran Kerja Sama',
  'Yth. [nama pengirim penawaran], [nama lembaga], di tempat' || chr(10) || chr(10) ||
  'Terima kasih atas penawaran kerja sama yang disampaikan kepada kami pada [tanggal penawaran]. Setelah kami pelajari, kami [menyambut baik dan bersedia melanjutkan ke tahap pembicaraan rinci / menyampaikan dengan hormat bahwa saat ini kami belum dapat bergabung, karena fokus kami sedang tertuju pada pengembangan program yang sudah berjalan].' || chr(10) || chr(10) ||
  '[Bila bersedia:] Kami mengusulkan pertemuan pada [usulan waktu] untuk membahas rinciannya. [Bila belum dapat:] Kami berharap pintu kerja sama tetap terbuka pada kesempatan yang akan datang dan mendoakan program Bapak/Ibu berjalan dengan baik.' || chr(10) || chr(10) ||
  'Atas perhatian dan kepercayaannya, kami mengucapkan terima kasih.' || chr(10) || chr(10) || 'Hormat kami,' || chr(10) || chr(10) ||
  'Ayu Najiba, Founder Ziel Kids Club & Sekolah Alam Montessori'
WHERE NOT EXISTS (SELECT 1 FROM surat_template WHERE nama = 'Surat Balasan Penawaran Kerja Sama');
INSERT INTO surat_template (nama, kode_jenis, perihal_default, isi)
SELECT 'Proposal Kerja Sama Sekolah (Sosialisasi Literasi & Kesulitan Belajar)', 'PRP', 'Proposal Kerja Sama Sosialisasi Fondasi Literasi & Deteksi Dini Kesulitan Belajar',
  'Yth. Kepala [nama sekolah], di tempat' || chr(10) || chr(10) ||
  'Latar belakang. Banyak kesulitan belajar pada anak sekolah berakar pada fondasi literasi dan perkembangan yang belum terbaca sejak dini. Guru dan orang tua adalah pihak yang paling dekat dengan anak, sehingga pemahaman tentang tanda-tanda awal kesulitan belajar, termasuk risiko disleksia, perlu sampai kepada mereka dalam bahasa yang praktis dan tidak menakutkan.' || chr(10) || chr(10) ||
  'Tujuan kegiatan. Memberikan psikoedukasi tentang fondasi literasi dan kesulitan belajar umum maupun spesifik, tanda-tanda yang dapat diamati guru di kelas, langkah dukungan yang dapat dilakukan sekolah tanpa menunggu diagnosis, dan jalur rujukan yang tepat bila anak memerlukan pemeriksaan lebih lanjut oleh psikolog klinis.' || chr(10) || chr(10) ||
  'Bentuk dan sasaran. Sesi tatap muka berdurasi [durasi] bagi [guru / orang tua / guru dan orang tua] dengan jumlah peserta [jumlah]. Materi disampaikan dengan contoh nyata dari kelas dan ruang tanya jawab. Kegiatan ini adalah psikoedukasi dan tidak memuat pemeriksaan, diagnosis, atau penawaran program berbayar.' || chr(10) || chr(10) ||
  'Peran masing-masing pihak. Pihak sekolah menyediakan tempat, mengoordinasikan peserta, dan menunjuk satu pendamping kegiatan. Pihak kami menyiapkan materi, narasumber Ayu Najiba selaku Montessori & Child Development Practitioner dan kandidat Indonesia Dyslexia Specialist Teacher, serta bahan bacaan ringkas untuk peserta.' || chr(10) || chr(10) ||
  'Waktu dan biaya. Kegiatan direncanakan pada [hari, tanggal, jam] di [tempat]. Kegiatan sosialisasi ini diberikan tanpa biaya sebagai bagian dari program edukasi masyarakat kami.' || chr(10) || chr(10) ||
  'Penutup. Kami berharap proposal ini berkenan dan menjadi awal kerja sama yang bermanfaat bagi anak-anak di [nama sekolah]. Penjajakan lebih lanjut dapat diatur melalui CS kami di +62 851-1762-3313.' || chr(10) || chr(10) || 'Hormat kami,' || chr(10) || chr(10) ||
  'Ayu Najiba, Founder Ziel Kids Club & Sekolah Alam Montessori'
WHERE NOT EXISTS (SELECT 1 FROM surat_template WHERE nama = 'Proposal Kerja Sama Sekolah (Sosialisasi Literasi & Kesulitan Belajar)');
INSERT INTO surat_template (nama, kode_jenis, perihal_default, isi)
SELECT 'Proposal Kerja Sama Venue (Kelas Pop-Up)', 'PRP', 'Proposal Kerja Sama Penyelenggaraan Kelas Pop-Up Anak',
  'Yth. Manajemen [nama hotel/venue], di tempat' || chr(10) || chr(10) ||
  'Latar belakang. Keluarga muda membutuhkan kegiatan anak yang bermakna di ruang publik yang nyaman. Ziel Kids Club menyelenggarakan kelas pop-up berkala yang memadukan gerak, sensori, dan literasi sejak dini, dan [nama venue] adalah ruang yang tepat untuk menghadirkannya.' || chr(10) || chr(10) ||
  'Bentuk kerja sama. Seri kelas pop-up [jumlah] edisi dalam [periode], setiap edisi berdurasi [durasi] dengan peserta anak usia [rentang usia] beserta pendampingnya. Tema setiap edisi selaras dengan kurikulum kami dan memanfaatkan fasilitas venue sebagai bagian dari pengalaman anak.' || chr(10) || chr(10) ||
  'Pembagian peran dan skema. Pihak kami menyiapkan konsep, fasilitator, material, pendaftaran peserta, dan publikasi bersama. Pihak venue menyediakan ruang dan dukungan operasional pada hari kegiatan. Skema biaya peserta dan bagi hasil dibicarakan pada pertemuan penjajakan dan dituangkan tertulis sebelum seri dimulai.' || chr(10) || chr(10) ||
  'Penutup. Kami mengundang manajemen [nama venue] untuk berdiskusi lebih lanjut. Hubungi kami melalui +62 851-1762-3313.' || chr(10) || chr(10) || 'Hormat kami,' || chr(10) || chr(10) ||
  'Ayu Najiba, Founder Ziel Kids Club & Sekolah Alam Montessori'
WHERE NOT EXISTS (SELECT 1 FROM surat_template WHERE nama = 'Proposal Kerja Sama Venue (Kelas Pop-Up)');
INSERT INTO surat_template (nama, kode_jenis, perihal_default, isi)
SELECT 'Surat Undangan', 'UND', 'Undangan [nama kegiatan]',
  'Yth. [nama yang diundang], di tempat' || chr(10) || chr(10) ||
  'Dengan hormat, kami mengundang Bapak/Ibu untuk hadir dan berperan sebagai [peran, misalnya narasumber / tamu kehormatan / peserta] pada kegiatan [nama kegiatan] yang kami selenggarakan pada [hari, tanggal] pukul [jam] di [tempat].' || chr(10) || chr(10) ||
  'Kegiatan ini bertujuan [tujuan singkat]. Kehadiran Bapak/Ibu akan sangat berarti bagi [peserta kegiatan]. Konfirmasi kesediaan dapat disampaikan kepada CS kami di +62 851-1762-3313 paling lambat [tanggal]. Atas perhatian dan kesediaannya, kami mengucapkan terima kasih.' || chr(10) || chr(10) || 'Hormat kami,' || chr(10) || chr(10) ||
  'Ayu Najiba, Founder Ziel Kids Club & Sekolah Alam Montessori'
WHERE NOT EXISTS (SELECT 1 FROM surat_template WHERE nama = 'Surat Undangan');
INSERT INTO surat_template (nama, kode_jenis, perihal_default, isi)
SELECT 'Surat Pemberitahuan Orang Tua', 'PBR', 'Pemberitahuan [perihal]',
  'Yth. Bapak/Ibu Orang Tua/Wali Murid Ziel Kids Club & Sekolah Alam Montessori, di tempat' || chr(10) || chr(10) ||
  'Assalamu''alaikum warahmatullahi wabarakatuh. Semoga Bapak/Ibu dan ananda senantiasa sehat.' || chr(10) || chr(10) ||
  'Melalui surat ini kami menyampaikan bahwa [isi pemberitahuan: kegiatan / perubahan jadwal / kebijakan] yang berlaku mulai [tanggal berlaku]. Hal-hal yang perlu Bapak/Ibu persiapkan adalah [persiapan bila ada].' || chr(10) || chr(10) ||
  'Apabila ada hal yang ingin ditanyakan, Bapak/Ibu dapat menghubungi admin kami melalui nomor CS +62 851-1762-3313 pada jam layanan. Terima kasih atas perhatian dan kerja sama Bapak/Ibu selama ini.' || chr(10) || chr(10) ||
  'Wassalamu''alaikum warahmatullahi wabarakatuh.' || chr(10) || chr(10) || 'Hormat kami,' || chr(10) || chr(10) ||
  'Ayu Najiba, Founder Ziel Kids Club & Sekolah Alam Montessori'
WHERE NOT EXISTS (SELECT 1 FROM surat_template WHERE nama = 'Surat Pemberitahuan Orang Tua');
INSERT INTO surat_template (nama, kode_jenis, perihal_default, isi)
SELECT 'Surat Pengantar', 'RJK', 'Pengantar [nama berkas]',
  'Yth. [nama penerima], [nama lembaga], di tempat' || chr(10) || chr(10) ||
  'Dengan hormat, bersama surat ini kami meneruskan [nama berkas] atas nama [nama anak/pihak terkait] untuk dapat ditindaklanjuti sebagaimana mestinya. Berkas ini kami susun berdasarkan observasi dan skrining program kami, dan bukan merupakan diagnosis. Pemeriksaan dan kesimpulan profesional sepenuhnya berada pada kewenangan Bapak/Ibu selaku [profesi penerima].' || chr(10) || chr(10) ||
  'Kami siap memberikan keterangan tambahan yang diperlukan melalui CS kami di +62 851-1762-3313. Atas perhatian dan kerja samanya, kami mengucapkan terima kasih.' || chr(10) || chr(10) || 'Hormat kami,' || chr(10) || chr(10) ||
  'Ayu Najiba, Founder Ziel Kids Club & Sekolah Alam Montessori'
WHERE NOT EXISTS (SELECT 1 FROM surat_template WHERE nama = 'Surat Pengantar');
INSERT INTO surat_template (nama, kode_jenis, perihal_default, isi)
SELECT 'Nota Kesepahaman (MoU) Ringkas', 'MOU', 'Nota Kesepahaman [bidang kerja sama]',
  'Nota kesepahaman ini dibuat pada [hari, tanggal] antara Ziel Kids Club & Sekolah Alam Montessori yang diwakili Ayu Najiba selaku Founder, selanjutnya disebut Pihak Pertama, dan [nama lembaga] yang diwakili [nama, jabatan], selanjutnya disebut Pihak Kedua.' || chr(10) || chr(10) ||
  'Pasal 1, Maksud dan Ruang Lingkup. Kedua pihak sepakat bekerja sama dalam [bidang kerja sama] yang meliputi [cakupan kegiatan].' || chr(10) || chr(10) ||
  'Pasal 2, Peran Para Pihak. Pihak Pertama berperan [peran]. Pihak Kedua berperan [peran].' || chr(10) || chr(10) ||
  'Pasal 3, Jangka Waktu. Kesepahaman ini berlaku sejak ditandatangani sampai [tanggal], dan dapat diperpanjang atas kesepakatan tertulis kedua pihak.' || chr(10) || chr(10) ||
  'Pasal 4, Kerahasiaan Data Anak. Segala data, foto, dan dokumentasi anak yang timbul dari kerja sama ini bersifat rahasia, hanya digunakan untuk kepentingan kegiatan, dan tidak disebarluaskan tanpa persetujuan tertulis orang tua anak dan Pihak Pertama.' || chr(10) || chr(10) ||
  'Pasal 5, Penutup. Hal-hal yang belum diatur dalam nota ini akan dibicarakan dan dituangkan dalam perjanjian tersendiri bila diperlukan. Nota ini dibuat sebagai kesepahaman awal dan bukan perjanjian yang mengikat secara hukum di luar hal yang disepakati kedua pihak.' || chr(10) || chr(10) ||
  'Ditandatangani oleh Pihak Pertama (Ayu Najiba) dan Pihak Kedua ([nama, jabatan]) dengan materai bila diperlukan.'
WHERE NOT EXISTS (SELECT 1 FROM surat_template WHERE nama = 'Nota Kesepahaman (MoU) Ringkas');

COMMIT;
