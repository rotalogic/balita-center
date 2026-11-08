-- Migrasi: perlebar kolom status tagihan.
-- Nilai sah 'menunggu_konfirmasi' panjangnya 19 karakter, sedangkan kolom
-- invoices.status hanya varchar(16) — akibatnya setiap pembayaran sebagian
-- (manual maupun gateway) gagal saat status diperbarui, padahal pembayaran
-- sudah tercatat. varchar(24) memberi ruang aman.
ALTER TABLE invoices ALTER COLUMN status TYPE varchar(24);
