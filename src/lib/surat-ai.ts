import { llmConfigured, panggilLLMTeks, segarkanKonfigurasi } from "./ailsa/llm";

// Penyusun isi surat resmi dari poin-poin, memakai kunci DeepSeek yang sama
// dengan Ailsa (diisi admin di Ailsa → Kanal & Kunci LLM). Hasilnya SELALU
// draf: pengguna memeriksa dan menyunting sebelum surat dibuat/diterbitkan.
// Model dilarang menambah fakta di luar poin — nama, tanggal, nominal, dan
// tempat harus persis seperti yang ditulis pengguna.

const SISTEM = `Anda adalah penyusun surat resmi untuk Yayasan Tunas Pelita Cakrawala Insani (Ziel Kids Club & Sekolah Alam Montessori), Malang.
Tugas Anda: menyusun ISI surat resmi berbahasa Indonesia formal hanya dari poin-poin yang diberikan pengguna.

Aturan wajib:
- Keluaran hanya teks isi surat: diawali "Dengan hormat," dan diakhiri paragraf penutup serta ucapan terima kasih.
- JANGAN menulis kop surat, nomor surat, tanggal surat, baris perihal, alamat tujuan, atau blok tanda tangan — semuanya ditangani sistem.
- Gunakan HANYA fakta dari poin-poin: nama orang/lembaga, tanggal, waktu, tempat, dan nominal persis seperti tertulis. Dilarang menambah nama, angka, tanggal, janji, atau keterangan yang tidak ada di poin.
- Uraikan setiap poin menjadi kalimat yang runtut dan sopan; susun menjadi paragraf pembuka, isi, dan penutup yang wajar untuk jenis suratnya.
- Bahasa Indonesia baku, resmi, dan hangat khas lembaga pendidikan anak. Ringkas dan padat, tidak bertele-tele.
- Tanpa markdown, tanpa pagar kode, tanpa catatan penjelasan — hanya teks surat.`;

export async function susunIsiSurat(input: {
  poin: string; perihal?: string; tujuan?: string; jenis?: string;
}): Promise<{ ok: boolean; isi?: string; error?: string }> {
  await segarkanKonfigurasi();
  if (!llmConfigured()) {
    return {
      ok: false,
      error: "Kunci DeepSeek belum diisi. Isi dulu di Ailsa → Kanal & Kunci LLM (kartu Kunci LLM — DeepSeek), lalu coba lagi.",
    };
  }
  const konteks = [
    input.jenis ? `Jenis surat: ${input.jenis}` : "",
    input.perihal ? `Perihal: ${input.perihal}` : "",
    input.tujuan ? `Tujuan surat: ${input.tujuan}` : "",
  ].filter(Boolean).join("\n");
  const hasil = await panggilLLMTeks(
    [
      { role: "system", content: SISTEM },
      { role: "user", content: `${konteks ? `${konteks}\n\n` : ""}Poin-poin surat:\n${input.poin}` },
    ],
    0.3
  );
  if (!hasil.ok || !hasil.teks) {
    return { ok: false, error: `Penyusunan AI gagal (${hasil.error || "jawaban kosong"}). Coba lagi, atau tulis isi surat secara manual.` };
  }
  const isi = hasil.teks
    .replace(/^\s*```[a-z]*\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .replace(/^["“]|["”]$/g, "")
    .trim();
  if (isi.length < 40) return { ok: false, error: "Hasil susunan AI terlalu pendek. Periksa poin-poin lalu coba lagi." };
  return { ok: true, isi };
}
