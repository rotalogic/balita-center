-- Kolom kanal percakapan bot: kode Simulator Ailsa menulis channel='simulator'
-- tetapi kolomnya belum pernah ada, sehingga log percakapan simulator selalu
-- gagal tersimpan (kesalahannya tertelan catch). Nilai lama dianggap WhatsApp.
ALTER TABLE bot_conversations
  ADD COLUMN IF NOT EXISTS channel varchar(16) NOT NULL DEFAULT 'whatsapp';
