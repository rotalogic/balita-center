import { NextResponse } from "next/server";
import { currentUser } from "@/lib/current-user";
import { query } from "@/lib/db";
import { generateSecret, otpauthUrl } from "@/lib/totp";

export const dynamic = "force-dynamic";

// Membuat secret baru (belum aktif sampai diverifikasi lewat /2fa/enable).
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Belum masuk." }, { status: 401 });

  const secret = generateSecret();
  await query("UPDATE users SET totp_secret = $1, totp_enabled = false, updated_at = now() WHERE id = $2", [
    secret,
    user.id,
  ]);

  return NextResponse.json({
    ok: true,
    secret,
    otpauth: otpauthUrl(secret, user.email),
    hint: "Masukkan secret ini ke aplikasi authenticator (Google Authenticator / Aegis / 1Password), lalu kirim kode 6 digit.",
  });
}
