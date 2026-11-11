import { NextResponse } from "next/server";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { susunIsiSurat } from "@/lib/surat-ai";

export const dynamic = "force-dynamic";

// Generate isi surat dari poin-poin memakai AI (DeepSeek yang sama dengan
// Ailsa). Hasilnya draf mentah untuk diperiksa pengguna — endpoint ini
// tidak membuat dan tidak menerbitkan surat apa pun.

export async function POST(request: Request) {
  const denied = await guard("daily_reports.create");
  if (denied.error) return denied.error;
  const body = (await request.json().catch(() => ({}))) as {
    poin?: string; perihal?: string; tujuan?: string; jenis?: string;
  };
  const poin = String(body.poin || "").trim();
  if (poin.length < 10) {
    return NextResponse.json({ ok: false, error: "Tulis dulu poin-poin suratnya (minimal beberapa kata)." }, { status: 400 });
  }
  if (poin.length > 6000) {
    return NextResponse.json({ ok: false, error: "Poin-poin terlalu panjang (maksimal 6.000 karakter)." }, { status: 400 });
  }
  const hasil = await susunIsiSurat({
    poin,
    perihal: body.perihal ? String(body.perihal) : undefined,
    tujuan: body.tujuan ? String(body.tujuan) : undefined,
    jenis: body.jenis ? String(body.jenis) : undefined,
  });
  if (!hasil.ok) return NextResponse.json({ ok: false, error: hasil.error }, { status: 503 });
  await catatAudit(denied.user, {
    action: "surat.generate",
    entityTable: "surat",
    detail: { panjang_poin: poin.length, perihal: body.perihal || null },
  });
  return NextResponse.json({ ok: true, isi: hasil.isi });
}
