import { NextResponse } from "next/server";
import { query, dbErrorMessage } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { hashToken } from "@/lib/reset-token";

export const dynamic = "force-dynamic";

const MIN_PASSWORD = 8;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { token?: string; password?: string };
    const token = (body.token || "").trim();
    const password = body.password || "";

    if (!token) {
      return NextResponse.json({ ok: false, error: "Token reset tidak ada." }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD) {
      return NextResponse.json(
        { ok: false, error: `Kata sandi minimal ${MIN_PASSWORD} karakter.` },
        { status: 400 }
      );
    }

    const rows = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_resets
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
        LIMIT 1`,
      [hashToken(token)]
    );
    const reset = rows[0];
    if (!reset) {
      return NextResponse.json(
        { ok: false, error: "Tautan reset tidak valid atau sudah kedaluwarsa." },
        { status: 400 }
      );
    }

    // Menyetel kata sandi lewat tautan sekali pakai juga mengaktifkan akun yang
    // masih menunggu persetujuan (dipakai untuk undangan pengguna baru).
    await query(
      `UPDATE users
          SET password_hash = $1, updated_at = now(),
              status = CASE WHEN status = 'menunggu_persetujuan' THEN 'aktif' ELSE status END
        WHERE id = $2`,
      [hashPassword(password), reset.user_id]
    );
    await query("UPDATE password_resets SET used_at = now() WHERE id = $1", [reset.id]);

    return NextResponse.json({ ok: true, message: "Kata sandi sudah diganti. Silakan masuk." });
  } catch (error) {
    const message = dbErrorMessage(error, "Gagal mengganti kata sandi.");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
