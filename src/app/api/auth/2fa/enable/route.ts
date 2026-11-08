import { NextResponse } from "next/server";
import { currentUser } from "@/lib/current-user";
import { query } from "@/lib/db";
import { verifyCode } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Belum masuk." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { code?: string };

  const rows = await query<{ totp_secret: string | null }>(
    "SELECT totp_secret FROM users WHERE id = $1",
    [user.id]
  );
  const secret = rows[0]?.totp_secret;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Mulai setup 2FA dulu." }, { status: 400 });
  }
  if (!verifyCode(secret, body.code || "")) {
    return NextResponse.json({ ok: false, error: "Kode salah atau kedaluwarsa." }, { status: 400 });
  }

  await query("UPDATE users SET totp_enabled = true, updated_at = now() WHERE id = $1", [user.id]);
  return NextResponse.json({ ok: true, message: "2FA aktif. Kode diminta setiap kali masuk." });
}
