import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Dipakai healthcheck container. Tanpa detail sensitif: hanya status hidup.
export async function GET() {
  try {
    await query("SELECT 1");
    return NextResponse.json({ ok: true, db: "ok", waktu: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, db: "gagal" }, { status: 503 });
  }
}
