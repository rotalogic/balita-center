import { query } from "./db";
import { benihDari, variasikan, type KonteksVariasi } from "./wa-variasi";

// Gateway WhatsApp OpenWA (github.com/rmyndharis/OpenWA) — gateway mandiri
// berbasis whatsapp-web.js/baileys, BUKAN kanal resmi Meta. Pengaturan
// tersimpan di bot_settings dan diisi admin dari halaman Ailsa (pola yang
// sama dengan kunci LLM & Midtrans): tampil hanya tersamar, tidak lewat env.
//
// Pesan keluar lewat gateway ini TIDAK dikirim serentak. Semuanya masuk
// antrean wa_outbox dan diproses satu per satu oleh prosesor beritme:
//   - teks setiap pesan divariasikan (spintax + placeholder per penerima),
//   - jeda minimal 10 detik antara dua pengiriman,
//   - sesudah 10 pesan terkirim, jeda 10 menit sebelum pesan berikutnya.
// Ritme ini aturan tetap pemilik platform, bukan angka yang bisa diubah
// dari layar.

export const WA_JEDA_MS = 10_000;
export const WA_BATCH_MAKS = 10;
export const WA_COOLDOWN_MS = 10 * 60_000;
export const WA_PERCOBAAN_MAKS = 3;

export type KonfigWa = {
  provider: "meta" | "openwa";
  baseUrl: string | null;
  apiKey: string | null;
  sessionId: string | null;
  aktif: boolean;
};

let cache: { data: KonfigWa; at: number } | null = null;

export async function segarkanWa(paksa = false): Promise<KonfigWa> {
  if (!paksa && cache && Date.now() - cache.at < 15000) return cache.data;
  let data: KonfigWa = { provider: "meta", baseUrl: null, apiKey: null, sessionId: null, aktif: false };
  try {
    const rows = await query<{
      wa_provider: string; openwa_base_url: string | null; openwa_api_key: string | null;
      openwa_session_id: string | null; wa_openwa_aktif: boolean;
    }>(
      "SELECT wa_provider, openwa_base_url, openwa_api_key, openwa_session_id, wa_openwa_aktif FROM bot_settings WHERE id = 1"
    );
    if (rows[0]) {
      data = {
        provider: rows[0].wa_provider === "openwa" ? "openwa" : "meta",
        baseUrl: rows[0].openwa_base_url,
        apiKey: rows[0].openwa_api_key,
        sessionId: rows[0].openwa_session_id,
        aktif: Boolean(rows[0].wa_openwa_aktif),
      };
    }
  } catch {
    /* database belum bermigrasi — gateway dianggap belum diatur */
  }
  cache = { data, at: Date.now() };
  return data;
}

export function waMasker(kunci: string | null): string | null {
  if (!kunci) return null;
  return `••••${kunci.slice(-4)}`;
}

export async function openwaSiap(): Promise<boolean> {
  const k = await segarkanWa();
  return Boolean(k.provider === "openwa" && k.aktif && k.baseUrl && k.apiKey && k.sessionId);
}

function urlDasar(k: KonfigWa): string {
  return (k.baseUrl || "").replace(/\/$/, "");
}

async function panggilOpenwa(k: KonfigWa, path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const kontrol = new AbortController();
  const batas = setTimeout(() => kontrol.abort(), 20000);
  try {
    const res = await fetch(`${urlDasar(k)}${path}`, {
      ...init,
      signal: kontrol.signal,
      headers: { "X-API-Key": k.apiKey || "", "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(batas);
  }
}

// Status sesi langsung dari gateway (untuk kartu pengaturan).
export async function statusOpenwa(): Promise<{ terhubung: boolean; status: string; nama?: string }> {
  const k = await segarkanWa();
  if (!k.baseUrl || !k.apiKey || !k.sessionId) return { terhubung: false, status: "belum_diatur" };
  try {
    const { ok, data } = await panggilOpenwa(k, `/api/sessions/${encodeURIComponent(k.sessionId)}`);
    if (!ok) return { terhubung: false, status: "gateway_tidak_menjawab" };
    const mentah = String(data.status || data.state || "");
    // Status OpenWA: sesi yang benar-benar terhubung berstatus persis
    // "ready" — "qr_ready" berarti justru MENUNGGU dipindai, bukan terhubung.
    const kecil = mentah.toLowerCase();
    const terhubung = kecil === "ready" || kecil === "connected";
    return { terhubung, status: mentah || "tidak_diketahui", nama: typeof data.name === "string" ? data.name : undefined };
  } catch {
    return { terhubung: false, status: "gateway_tidak_terjangkau" };
  }
}

// Mulai sesi di gateway (idempoten secara praktik: gateway menolak start
// ganda dengan galat yang aman diabaikan di sini).
export async function mulaiSesiOpenwa(): Promise<void> {
  const k = await segarkanWa();
  if (!k.baseUrl || !k.apiKey || !k.sessionId) return;
  try {
    await panggilOpenwa(k, `/api/sessions/${encodeURIComponent(k.sessionId)}/start`, { method: "POST" });
  } catch {
    /* gateway tak terjangkau — status sesungguhnya terbaca dari panggilan lain */
  }
}

export type HasilQr = {
  status: string;           // status sesi menurut gateway (qr_ready, ready, initializing, ...)
  qrCode?: string;          // data URL gambar QR, siap ditampilkan
  terhubung: boolean;
  pesan?: string;           // penjelasan ramah untuk admin
};

// Ambil kode QR pemasangan dari gateway. Bila sesi belum berjalan, sesi
// dimulai dulu. QR OpenWA berbentuk data URL gambar (kontrak QRCodeResponseDto).
export async function qrOpenwa(): Promise<HasilQr> {
  const k = await segarkanWa(true);
  if (!k.baseUrl || !k.apiKey || !k.sessionId) {
    return { status: "belum_diatur", terhubung: false, pesan: "Isi dulu Base URL, ID sesi, dan kunci API OpenWA, lalu simpan." };
  }
  const sesi = `/api/sessions/${encodeURIComponent(k.sessionId)}`;
  try {
    let st = await statusOpenwa();
    if (st.terhubung) return { status: st.status, terhubung: true, pesan: "WhatsApp sudah terhubung — tidak perlu memindai lagi." };
    const kecil = st.status.toLowerCase();
    if (kecil === "created" || kecil === "disconnected" || kecil === "failed" || kecil === "belum_diatur" || kecil === "gateway_tidak_menjawab") {
      await mulaiSesiOpenwa();
      await new Promise((r) => setTimeout(r, 1500));
      st = await statusOpenwa();
      if (st.terhubung) return { status: st.status, terhubung: true, pesan: "WhatsApp sudah terhubung — tidak perlu memindai lagi." };
    }
    const { ok, data } = await panggilOpenwa(k, `${sesi}/qr`);
    if (ok && typeof data.qrCode === "string" && data.qrCode.startsWith("data:image/")) {
      return { status: String(data.status || st.status), qrCode: data.qrCode, terhubung: false };
    }
    // QR tidak tersedia: mungkin sesi baru saja terhubung, atau masih menyiapkan.
    const st2 = await statusOpenwa();
    if (st2.terhubung) return { status: st2.status, terhubung: true, pesan: "WhatsApp sudah terhubung — tidak perlu memindai lagi." };
    return {
      status: st2.status,
      terhubung: false,
      pesan: `Kode QR belum siap (status sesi: ${st2.status}). Tunggu beberapa detik lalu segarkan — halaman ini menyegarkan otomatis.`,
    };
  } catch {
    return { status: "gateway_tidak_terjangkau", terhubung: false, pesan: "Gateway OpenWA tidak terjangkau. Periksa Base URL dan pastikan gateway berjalan." };
  }
}

export async function kirimOpenwa(k: KonfigWa, tujuan: string, teks: string): Promise<{ ok: boolean; id?: string; reason?: string }> {
  const nomor = tujuan.replace(/\D/g, "");
  if (!nomor) return { ok: false, reason: "nomor_kosong" };
  try {
    const { ok, status, data } = await panggilOpenwa(k, `/api/sessions/${encodeURIComponent(k.sessionId || "")}/messages/send-text`, {
      method: "POST",
      body: JSON.stringify({ chatId: `${nomor}@c.us`, text: teks }),
    });
    if (!ok) return { ok: false, reason: String(data.message || `http_${status}`) };
    const id = (data.id as string) || ((data.message as Record<string, unknown> | undefined)?.id as string) || undefined;
    return { ok: true, id };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "gagal_menghubungi_gateway" };
  }
}

// Masukkan satu pesan keluar ke antrean. Dipakai pesan proaktif (uji kirim,
// pengingat, pengumuman) — balasan percakapan bot tidak lewat antrean ini.
export async function antrekanWa(
  tujuan: string,
  teks: string,
  konteks: KonteksVariasi = {},
  dibuatOleh?: string
): Promise<{ ok: boolean; id?: string; reason?: string }> {
  const nomor = tujuan.replace(/\D/g, "");
  if (!nomor) return { ok: false, reason: "Nomor tujuan tidak valid." };
  if (!(await openwaSiap())) return { ok: false, reason: "Gateway OpenWA belum aktif atau belum lengkap diatur." };
  const rows = await query<{ id: string }>(
    "INSERT INTO wa_outbox (tujuan, teks_asli, konteks, dibuat_oleh) VALUES ($1, $2, $3::jsonb, $4) RETURNING id",
    [nomor, teks, JSON.stringify(konteks), dibuatOleh || null]
  );
  return { ok: true, id: rows[0].id };
}

export type HasilProsesWa =
  | { status: "terkirim"; outboxId: string; tujuan: string }
  | { status: "gagal_sementara" | "gagal_permanen"; outboxId: string; reason: string }
  | { status: "gateway_tidak_siap" | "antrean_kosong" | "jeda_batch" | "terlalu_cepat"; sampai?: string };

// Proses SATU pesan antrean dengan ritme penuh. Dipanggil berulang oleh
// cron (atau tombol admin); satu panggilan tidak pernah mengirim lebih
// dari satu pesan, sehingga jeda antar pesan selalu terjaga.
export async function prosesSatuPesanWa(): Promise<HasilProsesWa> {
  const k = await segarkanWa(true);
  if (!(k.provider === "openwa" && k.aktif && k.baseUrl && k.apiKey && k.sessionId)) {
    return { status: "gateway_tidak_siap" };
  }
  const ritmeRows = await query<{ terakhir_kirim_at: string | null; hitungan_batch: number; jeda_sampai: string | null }>(
    "SELECT terakhir_kirim_at, hitungan_batch, jeda_sampai FROM wa_ritme WHERE id = 1"
  );
  const ritme = ritmeRows[0] || { terakhir_kirim_at: null, hitungan_batch: 0, jeda_sampai: null };
  const sekarang = Date.now();
  if (ritme.jeda_sampai && new Date(ritme.jeda_sampai).getTime() > sekarang) {
    return { status: "jeda_batch", sampai: ritme.jeda_sampai };
  }
  if (ritme.terakhir_kirim_at && sekarang - new Date(ritme.terakhir_kirim_at).getTime() < WA_JEDA_MS) {
    return { status: "terlalu_cepat" };
  }
  const klaim = await query<{
    id: string; tujuan: string; teks_asli: string; konteks: KonteksVariasi; percobaan: number;
  }>(
    `UPDATE wa_outbox SET status = 'mengirim'
      WHERE id = (
        SELECT id FROM wa_outbox
         WHERE status = 'antre' AND dijadwalkan_at <= now()
         ORDER BY dibuat_at LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      RETURNING id, tujuan, teks_asli, konteks, percobaan`
  );
  if (klaim.length === 0) return { status: "antrean_kosong" };
  const baris = klaim[0];
  const teks = variasikan(baris.teks_asli, baris.konteks || {}, benihDari(baris.id));
  const hasil = await kirimOpenwa(k, baris.tujuan, teks);
  if (hasil.ok) {
    await query("UPDATE wa_outbox SET status = 'terkirim', teks_terkirim = $2, gateway_id = $3, terkirim_at = now() WHERE id = $1", [
      baris.id, teks, hasil.id || null,
    ]);
    const batchBaru = (ritme.hitungan_batch || 0) + 1;
    if (batchBaru >= WA_BATCH_MAKS) {
      await query("UPDATE wa_ritme SET terakhir_kirim_at = now(), hitungan_batch = 0, jeda_sampai = now() + ($1 || ' milliseconds')::interval WHERE id = 1", [
        String(WA_COOLDOWN_MS),
      ]);
    } else {
      await query("UPDATE wa_ritme SET terakhir_kirim_at = now(), hitungan_batch = $1, jeda_sampai = NULL WHERE id = 1", [batchBaru]);
    }
    return { status: "terkirim", outboxId: baris.id, tujuan: baris.tujuan };
  }
  const percobaan = (baris.percobaan || 0) + 1;
  const permanen = percobaan >= WA_PERCOBAAN_MAKS;
  await query("UPDATE wa_outbox SET status = $2, percobaan = $3, pesan_error = $4 WHERE id = $1", [
    baris.id, permanen ? "gagal" : "antre", percobaan, hasil.reason || "gagal",
  ]);
  return { status: permanen ? "gagal_permanen" : "gagal_sementara", outboxId: baris.id, reason: hasil.reason || "gagal" };
}

// Ringkasan antrean + ritme untuk kartu pengaturan.
export async function ringkasanWa(): Promise<{
  antre: number; terkirim: number; gagal: number; hitungan_batch: number; jeda_sampai: string | null; terakhir_kirim_at: string | null;
}> {
  const hitung = await query<{ status: string; n: number }>(
    "SELECT status, COUNT(*)::int AS n FROM wa_outbox WHERE status IN ('antre', 'terkirim', 'gagal') GROUP BY status"
  );
  const peta = new Map(hitung.map((r) => [r.status, r.n]));
  const ritme = await query<{ hitungan_batch: number; jeda_sampai: string | null; terakhir_kirim_at: string | null }>(
    "SELECT hitungan_batch, jeda_sampai, terakhir_kirim_at FROM wa_ritme WHERE id = 1"
  );
  return {
    antre: peta.get("antre") || 0,
    terkirim: peta.get("terkirim") || 0,
    gagal: peta.get("gagal") || 0,
    hitungan_batch: ritme[0]?.hitungan_batch || 0,
    jeda_sampai: ritme[0]?.jeda_sampai || null,
    terakhir_kirim_at: ritme[0]?.terakhir_kirim_at || null,
  };
}
