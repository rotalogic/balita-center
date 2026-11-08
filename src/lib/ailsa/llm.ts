// Klien LLM (kompatibel OpenAI chat/completions).
// Urutan pemakaian (keputusan pemilik 7 Nov 2026): kunci bansos-deepseek DULU,
// baru pindah ke kunci utama bila kuota/gangguan.
// Utama  : AILSA_LLM_API_KEY @ AILSA_LLM_BASE_URL (dipakai KEDUA)
// Pertama: AILSA_LLM_FALLBACK_* (acsa.my.id, bansos-deepseek)
// Kunci hanya dari env; tidak pernah hardcode.
const BASE = (process.env.AILSA_LLM_BASE_URL || process.env.LLM_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
const KEY = process.env.AILSA_LLM_API_KEY || process.env.LLM_API_KEY || "";
const MODEL = process.env.LLM_MODEL || "deepseek-chat";

const FBASE = (process.env.AILSA_LLM_FALLBACK_BASE_URL || "").replace(/\/$/, "");
const FKEY = process.env.AILSA_LLM_FALLBACK_API_KEY || "";
const FMODEL = process.env.AILSA_LLM_FALLBACK_MODEL || "bansos-deepseek";

export function llmConfigured(): boolean {
  return Boolean(KEY || FKEY);
}

export function llmModel(): string {
  return FKEY && FBASE ? `${FMODEL} (utama)` : MODEL;
}

export function llmSumber(): { utama: boolean; cadangan: boolean } {
  // "utama" = kunci bansos-deepseek yang dipakai lebih dulu.
  return { utama: Boolean(FKEY && FBASE), cadangan: Boolean(KEY) };
}

export type Pesan = { role: "system" | "user" | "assistant"; content: string };

type Jawaban = { ok: boolean; teks?: string; error?: string; sumber?: "utama" | "cadangan" };

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
  base: string; key: string; model: string; pesan: Pesan[]; suhu: number; jsonMode: boolean; batasMs: number;
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
        max_tokens: 1200,
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

export async function panggilLLM(pesan: Pesan[], suhu = 0.3): Promise<Jawaban> {
  // 1) bansos-deepseek lebih dulu (kuota khusus bot).
  if (FKEY && FBASE) {
    // Batas 9 detik pada percobaan pertama: kalau lambat, langsung pindah kunci.
    const pertama = await panggilSatu({ base: FBASE, key: FKEY, model: FMODEL, pesan, suhu, jsonMode: false, batasMs: 9000 });
    if (pertama.ok) return { ...pertama, sumber: "utama" };
    if (KEY) {
      const cadangan = await panggilSatu({ base: BASE, key: KEY, model: MODEL, pesan, suhu, jsonMode: true, batasMs: 25000 });
      if (cadangan.ok) return { ...cadangan, sumber: "cadangan" };
      return { ok: false, error: `${pertama.error} | kunci utama: ${cadangan.error}` };
    }
    return pertama;
  }
  if (KEY) {
    const utama = await panggilSatu({ base: BASE, key: KEY, model: MODEL, pesan, suhu, jsonMode: true, batasMs: 30000 });
    return utama.ok ? { ...utama, sumber: "utama" } : utama;
  }
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
