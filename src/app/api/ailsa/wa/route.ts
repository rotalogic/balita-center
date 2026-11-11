import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { segarkanWa, statusOpenwa, ringkasanWa, antrekanWa, prosesSatuPesanWa, waMasker, qrOpenwa } from "@/lib/wa-gateway";
import { contohVariasi } from "@/lib/wa-variasi";

export const dynamic = "force-dynamic";

// Pengaturan gateway WhatsApp OpenWA untuk Ailsa. Kunci API tersimpan di
// bot_settings dan hanya tampil tersamar — pola yang sama dengan kunci LLM.

export async function GET() {
  const denied = await guard("messages.send");
  if (denied.error) return denied.error;
  try {
    const k = await segarkanWa(true);
    const [status, ringkasan] = await Promise.all([
      k.provider === "openwa" ? statusOpenwa() : Promise.resolve(null),
      ringkasanWa(),
    ]);
    return NextResponse.json({
      ok: true,
      provider: k.provider,
      aktif: k.aktif,
      baseUrl: k.baseUrl || "",
      sessionId: k.sessionId || "",
      apiKeyMasker: waMasker(k.apiKey),
      apiKeyTerisi: Boolean(k.apiKey),
      statusGateway: status,
      antrean: ringkasan,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

type Body = {
  aksi?: string;
  provider?: string; baseUrl?: string; apiKey?: string; sessionId?: string; aktif?: boolean;
  nomor?: string; teks?: string; nama?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const aksi = body.aksi || "simpan";

  if (aksi === "simpan") {
    const denied = await guard("settings.manage");
    if (denied.error) return denied.error;
    try {
      const provider = body.provider === "openwa" ? "openwa" : "meta";
      const baseUrl = (body.baseUrl || "").trim().replace(/\/$/, "") || null;
      if (provider === "openwa" && baseUrl && !/^https?:\/\//i.test(baseUrl)) {
        return NextResponse.json({ ok: false, error: "Base URL OpenWA harus diawali http:// atau https://." }, { status: 400 });
      }
      // Kunci kosong berarti "jangan ubah kunci tersimpan".
      if ((body.apiKey || "").trim()) {
        await query(
          `UPDATE bot_settings SET wa_provider = $1, openwa_base_url = $2, openwa_api_key = $3,
             openwa_session_id = $4, wa_openwa_aktif = $5, updated_at = now() WHERE id = 1`,
          [provider, baseUrl, body.apiKey!.trim(), (body.sessionId || "").trim() || null, Boolean(body.aktif)]
        );
      } else {
        await query(
          `UPDATE bot_settings SET wa_provider = $1, openwa_base_url = $2,
             openwa_session_id = $3, wa_openwa_aktif = $4, updated_at = now() WHERE id = 1`,
          [provider, baseUrl, (body.sessionId || "").trim() || null, Boolean(body.aktif)]
        );
      }
      await segarkanWa(true);
      await catatAudit(denied.user, {
        action: "ailsa.wa.simpan",
        entityTable: "bot_settings",
        detail: { provider, aktif: Boolean(body.aktif), sesi: (body.sessionId || "").trim() || null },
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
    }
  }

  const denied = await guard("messages.send");
  if (denied.error) return denied.error;
  try {
    if (aksi === "pratinjau") {
      const teks = (body.teks || "").trim();
      if (!teks) return NextResponse.json({ ok: false, error: "Teks pesan masih kosong." }, { status: 400 });
      return NextResponse.json({ ok: true, contoh: contohVariasi(teks, { nama: (body.nama || "Ibu Sari").trim() }) });
    }
    if (aksi === "uji") {
      const nomor = (body.nomor || "").trim();
      const teks = (body.teks || "").trim();
      if (!nomor || !teks) return NextResponse.json({ ok: false, error: "Nomor dan teks uji wajib diisi." }, { status: 400 });
      const hasil = await antrekanWa(nomor, teks, { nama: (body.nama || "").trim() }, denied.user.id);
      if (!hasil.ok) return NextResponse.json({ ok: false, error: hasil.reason }, { status: 400 });
      await catatAudit(denied.user, { action: "ailsa.wa.uji", entityTable: "wa_outbox", entityId: hasil.id, detail: { nomor } });
      return NextResponse.json({ ok: true, id: hasil.id });
    }
    if (aksi === "qr") {
      const hasil = await qrOpenwa();
      return NextResponse.json({ ok: true, ...hasil });
    }
    if (aksi === "proses") {
      const hasil = await prosesSatuPesanWa();
      return NextResponse.json({ ok: true, ...hasil });
    }
    return NextResponse.json({ ok: false, error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
