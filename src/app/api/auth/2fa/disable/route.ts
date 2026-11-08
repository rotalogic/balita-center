import { NextResponse } from "next/server";
import { currentUser } from "@/lib/current-user";
import { query } from "@/lib/db";
import { verifyCode } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Belum masuk." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { code?: string };

  const rows = await query<{ totp_secret: string | null; totp_enabled: boolean }>(
    "SELECT totp_secret, totp_enabled FROM users WHERE id = $1",
    [user.id]
  );
  const row = rows[0];
  if (!row?.totp_enabled || !row.totp_secret) {
    return NextResponse.json({ ok: false, error: "2FA belum aktif." }, { status: 400 });
  }
  if (!verifyCode(row.totp_secret, body.code || "")) {
    return NextResponse.json({ ok: false, error: "Kode salah atau kedaluwarsa." }, { status: 400 });
  }

  await query(
    "UPDATE users SET totp_enabled = false, totp_secret = NULL, updated_at = now() WHERE id = $1",
    [user.id]
  );
  return NextResponse.json({ ok: true, message: "2FA dimatikan." });
}
