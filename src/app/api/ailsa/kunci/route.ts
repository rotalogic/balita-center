import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { llmBaseAktif, llmConfigured, llmDariDb, llmMasker, llmModel, segarkanKonfigurasi } from "@/lib/ailsa/llm";

export const dynamic = "force-dynamic";

// Kunci DeepSeek diisi admin dari aplikasi (keputusan pemilik 8 Nov 2026:
// tanpa Meta, token DeepSeek, bisa input sendiri). Kunci tersimpan di
// bot_settings, tidak pernah dikembalikan selain samaran 4 karakter akhir.

export async function GET() {
  const denied = await guard("settings.manage");
  if (denied.error) return denied.error;
  try {
    await segarkanKonfigurasi(true);
    const rows = await query<{ llm_model: string | null; llm_base_url: string | null }>(
      "SELECT llm_model, llm_base_url FROM bot_settings WHERE id = 1"
    );
    return NextResponse.json({
      ok: true,
      tersimpan: llmDariDb(),
      masker: llmMasker(),
      configured: llmConfigured(),
      model: rows[0]?.llm_model || llmModel(),
      base_url: rows[0]?.llm_base_url || llmBaseAktif(),
      env_cadangan: Boolean(process.env.AILSA_LLM_API_KEY || process.env.AILSA_LLM_FALLBACK_API_KEY),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

type Body = {
  aksi?: "simpan" | "hapus" | "uji";
  api_key?: string;
  model?: string;
  base_url?: string;
};

const MODEL_VALID = ["deepseek-chat", "deepseek-reasoner"];

async function ujiKoneksi(base: string, key: string): Promise<{ ok: boolean; pesan: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    });
    if (res.ok) return { ok: true, pesan: "Koneksi DeepSeek berhasil — kunci diterima." };
    let detail = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j?.error?.message) detail = j.error.message;
    } catch {
      /* biarkan status saja */
    }
    return { ok: false, pesan: `DeepSeek menolak: ${detail}` };
  } catch (error) {
    const putus = (error as Error)?.name === "AbortError";
    return { ok: false, pesan: putus ? "Koneksi ke DeepSeek kehabisan waktu (15 detik)." : "Tidak dapat menghubungi DeepSeek dari server ini." };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const denied = await guard("settings.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Body;
    const aksi = body.aksi || "simpan";

    if (aksi === "hapus") {
      await query("UPDATE bot_settings SET llm_api_key = NULL, llm_model = NULL, llm_base_url = NULL, updated_at = now() WHERE id = 1");
      await catatAudit(denied.user, { action: "ailsa.kunci_dihapus", entityTable: "bot_settings", entityId: "1" });
      await segarkanKonfigurasi(true);
      return NextResponse.json({ ok: true, pesan: "Kunci dari aplikasi dihapus. Ailsa kembali memakai kunci env bila ada." });
    }

    const kunciBaru = (body.api_key || "").trim();
    const rows = await query<{ llm_api_key: string | null; llm_base_url: string | null }>(
      "SELECT llm_api_key, llm_base_url FROM bot_settings WHERE id = 1"
    );
    const kunciAktif = kunciBaru || rows[0]?.llm_api_key || "";
    const baseAktif = (body.base_url || rows[0]?.llm_base_url || "https://api.deepseek.com/v1").trim();

    if (aksi === "uji") {
      if (!kunciAktif) return NextResponse.json({ ok: false, error: "Belum ada kunci untuk diuji. Isi kunci dulu." }, { status: 400 });
      const hasil = await ujiKoneksi(baseAktif, kunciAktif);
      return NextResponse.json({ ok: hasil.ok, pesan: hasil.pesan }, { status: hasil.ok ? 200 : 400 });
    }

    // aksi === "simpan"
    if (!kunciBaru && !rows[0]?.llm_api_key) {
      return NextResponse.json({ ok: false, error: "Kunci API DeepSeek wajib diisi." }, { status: 400 });
    }
    if (kunciBaru && kunciBaru.length < 10) {
      return NextResponse.json({ ok: false, error: "Kunci terlalu pendek — periksa kembali salinannya." }, { status: 400 });
    }
    if (body.model && !MODEL_VALID.includes(body.model)) {
      return NextResponse.json({ ok: false, error: `Model harus salah satu: ${MODEL_VALID.join(", ")}.` }, { status: 400 });
    }
    if (body.base_url && !/^https:\/\//i.test(body.base_url.trim())) {
      return NextResponse.json({ ok: false, error: "Base URL harus diawali https://" }, { status: 400 });
    }
    await query(
      `UPDATE bot_settings
          SET llm_api_key = COALESCE($1, llm_api_key),
              llm_model = $2,
              llm_base_url = $3,
              updated_at = now()
        WHERE id = 1`,
      [kunciBaru || null, body.model || "deepseek-chat", baseAktif]
    );
    await catatAudit(denied.user, {
      action: "ailsa.kunci_diperbarui",
      entityTable: "bot_settings",
      entityId: "1",
      detail: { model: body.model || "deepseek-chat", base_url: baseAktif },
    });
    await segarkanKonfigurasi(true);
    return NextResponse.json({ ok: true, pesan: "Kunci DeepSeek tersimpan dan langsung aktif.", masker: llmMasker(), configured: llmConfigured() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
