-- Seed katalog material Montessori AMI (0–3 & 3–6) + milestone awal per kelompok usia.
-- Status milestone: 'draf' — sekolah meninjau lalu mengaktifkan.

INSERT INTO materials (name, name_en, area, age_group) VALUES
  ('Menuang air','Pouring water','practical_life','3-6'),
  ('Meronce manik','Threading beads','practical_life','0-3'),
  ('Membuka-menutup wadah','Opening and closing containers','practical_life','0-3'),
  ('Menyapu','Sweeping','practical_life','3-6'),
  ('Merawat tanaman','Care of plants','practical_life','3-6'),
  ('Pink Tower','Pink Tower','sensorial','3-6'),
  ('Knobbed Cylinders','Knobbed Cylinders','sensorial','3-6'),
  ('Brown Stair','Brown Stair','sensorial','3-6'),
  ('Touch Board','Touch Board','sensorial','3-6'),
  ('Bells','Bells','sensorial','3-6'),
  ('Binomial Cube','Binomial Cube','sensorial','3-6'),
  ('Metal Insets','Metal Insets','language','3-6'),
  ('Kartu Gambar dan Kata','Picture and Word Cards','language','3-6'),
  ('Buku cerita','Story books','language','0-3'),
  ('Mendengarkan cerita','Listening to stories','language','0-3'),
  ('Number Rods','Number Rods','mathematics','3-6'),
  ('Papan Mencocokkan Angka','Number Matching Board','mathematics','3-6'),
  ('Golden Beads','Golden Beads','mathematics','3-6'),
  ('Puzzle Peta Dunia','World Map Puzzle','cultural','3-6'),
  ('Puzzle Peta Indonesia','Indonesia Map Puzzle','cultural','3-6')
ON CONFLICT DO NOTHING;

INSERT INTO milestones (indikator, age_group, aspect, montessori_area) VALUES
  ('Mampu berpisah dari orang tua/pendamping tanpa tangis panjang','1-<2','sosial_emosional','practical_life'),
  ('Mampu bekerja mandiri memilih aktivitas','2-<3','sosial_emosional','practical_life'),
  ('Bersabar menunggu giliran','2-<3','sosial_emosional',NULL),
  ('Menyebut nama sendiri','1-<2','bahasa',NULL),
  ('Menyebut 6 warna dengan benar','3-<4','kognitif','sensorial'),
  ('Mengelompokkan benda berdasarkan bentuk','3-<4','kognitif','sensorial'),
  ('Menuang air tanpa tumpah','3-<4','fisik_motorik','practical_life'),
  ('Memegang alat tulis dengan tiga jari','3-<4','fisik_motorik','sensorial'),
  ('Meronce manik besar dengan tali','2-<3','fisik_motorik','practical_life'),
  ('Berjalan di garis dengan seimbang','3-<4','fisik_motorik','practical_life'),
  ('Meminta giliran dengan kalimat lengkap','3-<4','bahasa','language'),
  ('Menyebut nama aparatus yang dipakai','3-<4','bahasa','language'),
  ('Mengenal lambang bilangan 1-10','4-<5','kognitif','mathematics'),
  ('Mengurutkan benda dari kecil ke besar','4-<5','kognitif','sensorial'),
  ('Menghitung benda sampai 10','4-<5','kognitif','mathematics'),
  ('Membantu teman tanpa diminta','4-<5','sosial_emosional','practical_life'),
  ('Menyelesaikan pekerjaan sampai tuntas','4-<5','sosial_emosional','practical_life'),
  ('Menceritakan pengalaman hari ini','4-<5','bahasa','language'),
  ('Mengenal peta Indonesia (pulau utama)','5-6','kognitif','cultural'),
  ('Membaca kata sederhana','5-6','bahasa','language'),
  ('Menulis namanya sendiri','5-6','fisik_motorik','language'),
  ('Mengucapkan salam dan berterima kasih','2-<3','nilai_agama_moral',NULL),
  ('Berdoa sebelum kegiatan','3-<4','nilai_agama_moral',NULL),
  ('Menjaga kebersihan alat setelah dipakai','4-<5','nilai_agama_moral','practical_life'),
  ('Membuat karya seni sederhana','3-<4','seni',NULL)
ON CONFLICT DO NOTHING;

-- Pemetaan awal material -> milestone (contoh yang diminta pemilik, dapat diubah sekolah)
INSERT INTO material_milestones (material_id, milestone_id)
SELECT m.id, s.id FROM materials m JOIN milestones s ON
  (m.name = 'Pink Tower' AND s.indikator = 'Mengurutkan benda dari kecil ke besar') OR
  (m.name = 'Knobbed Cylinders' AND s.indikator = 'Memegang alat tulis dengan tiga jari') OR
  (m.name = 'Meronce manik' AND s.indikator = 'Meronce manik besar dengan tali') OR
  (m.name = 'Menuang air' AND s.indikator = 'Menuang air tanpa tumpah') OR
  (m.name = 'Kartu Gambar dan Kata' AND s.indikator = 'Membaca kata sederhana') OR
  (m.name = 'Number Rods' AND s.indikator = 'Menghitung benda sampai 10') OR
  (m.name = 'Puzzle Peta Indonesia' AND s.indikator = 'Mengenal peta Indonesia (pulau utama)') OR
  (m.name = 'Menyapu' AND s.indikator = 'Menyelesaikan pekerjaan sampai tuntas')
ON CONFLICT DO NOTHING;

SELECT (SELECT count(*) FROM materials) AS material, (SELECT count(*) FROM milestones) AS milestone,
       (SELECT count(*) FROM material_milestones) AS pemetaan;
