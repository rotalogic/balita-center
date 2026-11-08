import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query, dbErrorMessage } from "@/lib/db";
import { signSession, verifySession } from "@/lib/session";
import { verifyCode } from "@/lib/totp";

export const dynamic = "force-dynamic";

// Tahap 2 login: tukar cookie `pend` + kode TOTP menjadi sesi penuh.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { code?: string };
    const userId = await verifySession(cookies().get("pend")?.value);
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Sesi 2FA kedaluwarsa. Masuk ulang." },
        { status: 401 }
      );
    }

    const rows = await query<{ totp_secret: string | null; totp_enabled: boolean; is_active: boolean }>(
      "SELECT totp_secret, totp_enabled, is_active FROM users WHERE id = $1 AND deleted_at IS NULL",
      [userId]
    );
    const user = rows[0];
    if (!user?.is_active || !user.totp_enabled || !user.totp_secret) {
      return NextResponse.json({ ok: false, error: "2FA tidak aktif untuk akun ini." }, { status: 400 });
    }
    if (!verifyCode(user.totp_secret, body.code || "")) {
      return NextResponse.json({ ok: false, error: "Kode 2FA salah atau kedaluwarsa." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set("sess", await signSession(userId), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
      secure: false,
    });
    response.cookies.set("pend", "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    const message = dbErrorMessage(error, "Gagal verifikasi 2FA.");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
