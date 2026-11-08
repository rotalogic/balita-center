-- Data contoh LOKAL untuk verifikasi rapor periodik (bukan data live).
-- Anak contoh yang sama dengan verifikasi laporan harian: Nara Pramudya.
BEGIN;

INSERT INTO branches (id, code, name, city) VALUES
  ('11111111-1111-1111-1111-111111111111', 'BTU', 'Balita Center Batu', 'Batu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, code, name, monthly_fee) VALUES
  ('22222222-2222-2222-2222-222222222222', 'TOD', 'Toddler Montessori', 850000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff (id, branch_id, full_name, position, status) VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Sari Wulandari', 'Guru Kelas', 'aktif')
ON CONFLICT (id) DO NOTHING;

INSERT INTO classes (id, branch_id, program_id, name, lead_staff_id) VALUES
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Kelas Matahari', '33333333-3333-3333-3333-333333333333')
ON CONFLICT (id) DO NOTHING;

INSERT INTO children (id, branch_id, full_name, nickname, birth_date, gender, enrolled_on, status) VALUES
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Nara Pramudya', 'Nara', '2023-05-14', 'perempuan', '2026-09-01', 'aktif')
ON CONFLICT (id) DO NOTHING;

INSERT INTO guardians (id, full_name, email, relation) VALUES
  ('66666666-6666-6666-6666-666666666666', 'Hilda Pramudya', 'hilda@contoh.local', 'Ibu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO child_guardians (child_id, guardian_id, is_primary) VALUES
  ('55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666', true)
ON CONFLICT DO NOTHING;

INSERT INTO enrollments (id, branch_id, child_id, class_id, program_id, start_date, status) VALUES
  ('10101010-1010-1010-1010-101010101010', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', '2026-09-01', 'aktif')
ON CONFLICT (id) DO NOTHING;

-- Laporan harian terbit (sama seperti verifikasi sebelumnya) — sumber foto dokumentasi rapor.
INSERT INTO daily_reports (id, branch_id, child_id, class_id, created_by, lead_facilitator_id, report_date, status, published_at,
    mood, meals_text, meal_level, snack_text, snack_level, nap_start, nap_end, nap_quality,
    toilet_pee_count, toilet_poop_count, notes, circle_theme, circle_notes, special_moment, home_suggestion) VALUES
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555',
   '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
   '2026-11-02', 'published', '2026-11-02 15:30+07',
   'ceria', 'Puding susu', 'banyak', 'Potato wedges', 'cukup', '11:30', '12:45', 'baik',
   1, 0, 'Nara tampak lebih fokus hari ini dan betah menyelesaikan satu pekerjaan sampai tuntas.',
   'Berbagi Cerita', 'Nara berani bercerita singkat di depan teman-teman saat circle time.', NULL,
   'Beri Ananda tugas kecil merapikan mainan ke tempatnya setelah bermain.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO daily_report_activities (report_id, title, apparatus, area, work_location, work_mode, rating, notes, photo_url, sort_order) VALUES
  ('77777777-7777-7777-7777-777777777777', 'Pink Tower', 'Menara Merah Muda', 'sensorial', 'alas', 'kelompok_besar', 4, 'Nara menyusun sepuluh kubus dari terbesar ke terkecil dengan urutan yang tepat dan penuh konsentrasi.', '/demo/pink-tower.png', 1),
  ('77777777-7777-7777-7777-777777777777', 'Buku Cerita', 'Buku cerita bergambar', 'language', 'lantai', 'sendiri', 2, 'Membuka halaman satu per satu dan menunjuk gambar sambil menyebutkan beberapa kata yang dikenalnya.', NULL, 2),
  ('77777777-7777-7777-7777-777777777777', 'Memberi Salam', NULL, 'observasi', 'lantai', 'sendiri', 1, 'Mulai berani menyapa guru saat tiba, meski masih malu-malu dan perlu didampingi.', NULL, 3)
ON CONFLICT DO NOTHING;

INSERT INTO daily_report_photos (report_id, photo_url, caption) VALUES
  ('77777777-7777-7777-7777-777777777777', '/demo/baca-buku.png', 'Membaca buku cerita di sudut baca'),
  ('77777777-7777-7777-7777-777777777777', '/demo/menuang-air.png', 'Latihan menuang air ke gelas')
ON CONFLICT DO NOTHING;

-- Siklus belajar untuk rapor.
INSERT INTO learning_cycles (id, branch_id, class_id, theme, start_date, end_date) VALUES
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'Siklus 1 — Aku dan Lingkunganku', '2026-09-07', '2026-11-27')
ON CONFLICT (id) DO NOTHING;

-- Presensi contoh di dalam rentang siklus: hari kerja Nov 2026.
INSERT INTO child_attendance (branch_id, child_id, class_id, att_date, status)
SELECT '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', d::date,
  CASE WHEN d::date = DATE '2026-11-10' THEN 'izin'
       WHEN d::date = DATE '2026-11-18' THEN 'sakit'
       ELSE 'hadir' END
FROM generate_series(DATE '2026-11-02', DATE '2026-11-27', INTERVAL '1 day') AS d
WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5
  AND d::date NOT IN (DATE '2026-11-05', DATE '2026-11-23')
ON CONFLICT DO NOTHING;

INSERT INTO child_attendance (branch_id, child_id, class_id, att_date, status)
SELECT '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', d::date, 'hadir'
FROM generate_series(DATE '2026-09-07', DATE '2026-10-30', INTERVAL '1 day') AS d
WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5 AND EXTRACT(DOW FROM d) <> 3
ON CONFLICT DO NOTHING;

-- Pemeriksaan kesehatan terakhir sebelum akhir siklus.
INSERT INTO health_checks (branch_id, child_id, checked_on, weight_kg, height_cm, head_circumference_cm, condition, nutrition_status, checked_by) VALUES
  ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '2026-11-20', 13.8, 101.4, 49.2, 'Sehat', 'gizi_baik', '33333333-3333-3333-3333-333333333333')
ON CONFLICT DO NOTHING;

-- Rapor terbit dengan seluruh narasi terisi.
INSERT INTO cycle_reports (id, branch_id, child_id, cycle_id, status, published_at, created_by,
    narrative_agama_moral, narrative_fisik_motorik, narrative_kognitif, narrative_bahasa,
    narrative_sosial_emosional, narrative_seni,
    narrative_practical_life, narrative_language, narrative_sensorial, narrative_mathematics, narrative_cultural,
    conclusion, parent_suggestion) VALUES
  ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555',
   '88888888-8888-8888-8888-888888888888', 'published', '2026-11-27 16:00+07', '33333333-3333-3333-3333-333333333333',
   'Nara mulai hafal doa sebelum makan dan terbiasa mengucapkan terima kasih serta permisi. Ia meniru gerakan salat saat kegiatan pagi dengan penuh semangat dan mulai memahami aturan sederhana tentang berbagi dengan teman.',
   'Motorik kasar Nara berkembang baik: ia berlari, melompat dengan dua kaki, dan mulai berani menaiki tangga perosotan tanpa bantuan. Motorik halusnya tampak saat ia memegang pensil dengan genggaman yang semakin mantap dan mampu menggunting mengikuti garis lurus dengan rapi.',
   'Nara menunjukkan rasa ingin tahu yang besar. Ia mampu mengelompokkan benda berdasarkan warna dan ukuran, menyebutkan angka 1–10 secara urut, dan menyelesaikan puzzle 12 keping secara mandiri. Konsentrasinya saat bekerja meningkat dari sekitar 8 menit menjadi 15 menit.',
   'Kosakata Nara bertambah pesat pada siklus ini. Ia mampu menyusun kalimat 3–4 kata, menceritakan kembali isi buku cerita dengan bahasanya sendiri, dan mulai menjawab pertanyaan "apa" dan "di mana" dengan tepat.',
   'Nara semakin mandiri: ia memakai sepatu sendiri, merapikan alas kerja, dan mencuci tangan tanpa diingatkan. Ia mulai berani berpisah dari orang tua tanpa menangis dan menunjukkan empati dengan menghibur teman yang sedih.',
   'Nara sangat menikmati kegiatan seni. Ia bereksperimen mencampur warna, membuat kolase dari bahan alam, dan bergerak mengikuti irama lagu dengan percaya diri. Karya-karyanya menunjukkan pilihan warna yang berani dan komposisi yang semakin terarah.',
   'Di area Practical Life, Nara mahir menuang air dari teko ke gelas tanpa tumpah, menyendok manik dari satu mangkuk ke mangkuk lain, dan mengancingkan baju pada Dressing Frame. Pekerjaan-pekerjaan ini melatih konsentrasi dan kemandiriannya setiap hari.',
   'Pada area Language, Nara bekerja dengan Metal Insets untuk melatih kontrol pensil dan mulai mengenal bunyi huruf melalui Sandpaper Letters. Ia senang mendengarkan cerita dan menunjuk kata pada buku yang dibacakan guru.',
   'Di area Sensorial, Nara menyelesaikan Pink Tower dan Tangga Coklat (Brown Stairs) dengan urutan yang benar, serta membedakan tekstur kasar-halus pada Touch Board dengan mata tertutup. Ia juga mulai mengeksplorasi Lonceng (Bells) untuk membedakan tinggi nada.',
   'Pada area Mathematics, Nara menghitung Batang Bilangan (Number Rods) 1–10 dengan benar dan mulai memahami konsep jumlah melalui Manik Emas (Golden Beads) satuan dan puluhan. Ia menikmati permainan mengelompokkan benda sesuai kartu angka.',
   'Di area Cultural, Nara mengenal Puzzle Peta Indonesia dan menyebutkan beberapa pulau besar. Ia antusias pada kegiatan sains sederhana seperti mengamati pertumbuhan kecambah dan merawat tanaman di kebun sekolah.',
   'Secara keseluruhan, Nara menunjukkan perkembangan yang sangat baik dan seimbang pada siklus ini. Kekuatan utamanya adalah konsentrasi yang tumbuh pesat, kemandirian, dan antusiasme belajar. Fokus pendampingan siklus berikutnya adalah keberanian tampil dan berbicara di depan kelompok serta pengenalan bunyi huruf yang lebih sistematis.',
   'Ayah dan Bunda dapat melanjutkan dukungan di rumah dengan: (1) memberi Nara tugas kecil yang tuntas, misalnya merapikan mainannya sendiri; (2) membacakan buku 10 menit sebelum tidur dan mengajaknya menceritakan kembali; (3) menyediakan waktu bermain bebas tanpa gawai agar konsentrasinya terus terlatih. Terima kasih atas kerja sama Ayah dan Bunda selama siklus ini.')
ON CONFLICT (id) DO NOTHING;

COMMIT;
