// Klien LLM (kompatibel OpenAI chat/completions) — otaknya DeepSeek.
// Urutan pemakaian:
// 1) Kunci yang diisi admin dari halaman Ailsa (bot_settings.llm_api_key) —
//    keputusan pemilik 8 Nov 2026: tanpa Meta, token DeepSeek diisi sendiri.
// 2) Kunci bansos-deepseek env (keputusan 7 Nov 2026).
// 3) Kunci env AILSA_LLM_API_KEY @ AILSA_LLM_BASE_URL.
// Kunci tidak pernah hardcode dan tidak pernah dikembalikan ke peramban
// selain 4 karakter terakhir.
import { query } from "@/lib/db";

const ENV_BASE = (process.env.AILSA_LLM_BASE_URL || process.env.LLM_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
const ENV_KEY = process.env.AILSA_LLM_API_KEY || process.env.LLM_API_KEY || "";
const ENV_MODEL = process.env.LLM_MODEL || "deepseek-chat";

const FBASE = (process.env.AILSA_LLM_FALLBACK_BASE_URL || "").replace(/\/$/, "");
const FKEY = process.env.AILSA_LLM_FALLBACK_API_KEY || "";
const FMODEL = process.env.AILSA_LLM_FALLBACK_MODEL || "bansos-deepseek";

type Konfig = { key: string; model: string; base: string; dariDb: boolean };
let cfg: Konfig = { key: ENV_KEY, model: ENV_MODEL, base: ENV_BASE, dariDb: false };
let muatTerakhir = 0;

// Muat ulang kunci dari bot_settings (di-cache 15 detik). Dipanggil di awal
// panggilLLM dan oleh route status/kunci supaya perubahan admin segera aktif
// tanpa restart server.
export async function segarkanKonfigurasi(paksa = false): Promise<void> {
  const kini = Date.now();
  if (!paksa && kini - muatTerakhir < 15000) return;
  muatTerakhir = kini;
  try {
    const rows = await query<{ llm_api_key: string | null; llm_model: string | null; llm_base_url: string | null }>(
      "SELECT llm_api_key, llm_model, llm_base_url FROM bot_settings WHERE id = 1"
    );
    const r = rows[0];
    if (r?.llm_api_key) {
      cfg = {
        key: r.llm_api_key,
        model: r.llm_model || ENV_MODEL,
        base: (r.llm_base_url || ENV_BASE).replace(/\/$/, ""),
        dariDb: true,
      };
    } else {
      cfg = { key: ENV_KEY, model: ENV_MODEL, base: ENV_BASE, dariDb: false };
    }
  } catch {
    /* database tak terjangkau: pertahankan konfigurasi terakhir */
  }
}

export function llmConfigured(): boolean {
  return Boolean(cfg.key || FKEY);
}

export function llmModel(): string {
  if (cfg.dariDb) return cfg.model;
  return FKEY && FBASE ? `${FMODEL} (utama)` : cfg.model;
}

export function llmSumber(): { utama: boolean; cadangan: boolean; aplikasi: boolean } {
  return { utama: Boolean(FKEY && FBASE), cadangan: Boolean(ENV_KEY), aplikasi: cfg.dariDb };
}

export function llmDariDb(): boolean {
  return cfg.dariDb;
}

export function llmMasker(): string | null {
  return cfg.key ? `••••${cfg.key.slice(-4)}` : null;
}

export function llmBaseAktif(): string {
  return cfg.base;
}

export type Pesan = { role: "system" | "user" | "assistant"; content: string };

type Jawaban = { ok: boolean; teks?: string; error?: string; sumber?: "utama" | "cadangan" | "aplikasi" };

// Sebagian gateway (mis. acsa.my.id) selalu membalas SSE walau diminta JSON.
function bacaSse(teks: string): string {
  const potong: string[] = [];
  for (const baris of teks.split(/\r?\n/)) {
    const bersih = baris.trim();
    if (!bersih.startsWith("data:")) continue;
    const isi = bersih.slice(5).trim();
    if (!isi || isi === "[DONE]") continue;
    try {
      const j = JSON.parse(isi) as { choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }> };
      const c = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content;
      if (c) potong.push(c);
    } catch {
      /* baris rusak diabaikan */
    }
  }
  return potong.join("");
}

async function panggilSatu(opts: {
  base: string; key: string; model: string; pesan: Pesan[]; suhu: number; jsonMode: boolean; batasMs: number; maxTokens?: number;
}): Promise<Jawaban> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.batasMs);
  try {
    const res = await fetch(`${opts.base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        temperature: opts.suhu,
        max_tokens: opts.maxTokens || 1200,
        ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: opts.pesan,
      }),
      signal: ctrl.signal,
    });
    const mentah = await res.text();
    if (!res.ok) {
      let pesan = `http_${res.status}`;
      try {
        pesan = (JSON.parse(mentah) as { error?: { message?: string } })?.error?.message || pesan;
      } catch {
        /* biarkan */
      }
      return { ok: false, error: pesan };
    }
    const sse = mentah.trimStart().startsWith("data:") || (res.headers.get("content-type") || "").includes("event-stream");
    if (sse) {
      const teks = bacaSse(mentah);
      return teks ? { ok: true, teks } : { ok: false, error: "jawaban_kosong" };
    }
    const data = JSON.parse(mentah) as { choices?: Array<{ message?: { content?: string } }> };
    const teks = data.choices?.[0]?.message?.content;
    return teks ? { ok: true, teks } : { ok: false, error: "jawaban_kosong" };
  } catch (error) {
    const putus = (error as Error)?.name === "AbortError";
    return { ok: false, error: putus ? "llm_timeout" : "llm_gagal" };
  } finally {
    clearTimeout(timer);
  }
}

export async function panggilLLM(pesan: Pesan[], suhu = 0.3, modeJson = true, maxTokens = 1200): Promise<Jawaban> {
  await segarkanKonfigurasi();
  const gagal: string[] = [];

  // 1) Kunci dari aplikasi (input admin di halaman Ailsa) paling dulu.
  if (cfg.dariDb && cfg.key) {
    const r = await panggilSatu({ base: cfg.base, key: cfg.key, model: cfg.model, pesan, suhu, jsonMode: modeJson, batasMs: 30000, maxTokens });
    if (r.ok) return { ...r, sumber: "aplikasi" };
    gagal.push(`kunci aplikasi: ${r.error}`);
  }
  // 2) bansos-deepseek (kuota khusus bot). Batas 9 detik: kalau lambat, pindah.
  if (FKEY && FBASE) {
    const pertama = await panggilSatu({ base: FBASE, key: FKEY, model: FMODEL, pesan, suhu, jsonMode: false, batasMs: 9000, maxTokens });
    if (pertama.ok) return { ...pertama, sumber: "utama" };
    gagal.push(`bansos: ${pertama.error}`);
  }
  // 3) Kunci env utama.
  if (ENV_KEY) {
    const cadangan = await panggilSatu({ base: ENV_BASE, key: ENV_KEY, model: ENV_MODEL, pesan, suhu, jsonMode: modeJson, batasMs: 25000, maxTokens });
    if (cadangan.ok) return { ...cadangan, sumber: "cadangan" };
    gagal.push(`kunci env: ${cadangan.error}`);
  }
  if (gagal.length > 0) return { ok: false, error: gagal.join(" | ") };
  return { ok: false, error: "llm_belum_dikonfigurasi" };
}

// Model kadang membungkus JSON dengan ```json ... ``` walau sudah diminta JSON.
export function parseJsonLonggar(teks: string): Record<string, unknown> | null {
  const bersih = teks.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const coba = (s: string) => {
    try {
      return JSON.parse(s) as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  const langsung = coba(bersih);
  if (langsung) return langsung;
  const awal = bersih.indexOf("{");
  const akhir = bersih.lastIndexOf("}");
  if (awal >= 0 && akhir > awal) return coba(bersih.slice(awal, akhir + 1));
  return null;
}

// Varian teks polos (bukan JSON) — dipakai penyusun surat dari poin-poin.
// Sumber kunci dan urutan cadangannya sama persis dengan panggilLLM.
export async function panggilLLMTeks(pesan: Pesan[], suhu = 0.3): Promise<Jawaban> {
  return panggilLLM(pesan, suhu, false, 2500);
}
