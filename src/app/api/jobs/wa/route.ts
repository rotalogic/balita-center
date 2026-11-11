import { NextResponse } from "next/server";
import { dbErrorMessage } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { prosesSatuPesanWa } from "@/lib/wa-gateway";

export const dynamic = "force-dynamic";

// Prosesor antrean WhatsApp OpenWA. Satu panggilan memproses paling banyak
// SATU pesan dengan ritme penuh (variasi teks, jeda 10 detik antar pesan,
// jeda 10 menit sesudah 10 pesan). Panggil berulang dari cron — misalnya
// tiap 15 detik dengan header x-job-token — atau manual oleh admin.
// Balasan percakapan bot tidak lewat antrean ini.

async function bolehJalan(request: Request) {
  const token = request.headers.get("x-job-token");
  if (token && process.env.JOB_TOKEN && token === process.env.JOB_TOKEN) return { ok: true as const };
  const denied = await guard("messages.send");
  if (denied.error) return { ok: false as const, response: denied.error };
  return { ok: true as const };
}

export async function POST(request: Request) {
  const izin = await bolehJalan(request);
  if (!izin.ok) return izin.response;
  try {
    const hasil = await prosesSatuPesanWa();
    return NextResponse.json({ ok: true, ...hasil });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
