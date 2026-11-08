import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { hashToken } from "@/lib/reset-token";

export const dynamic = "force-dynamic";

const TTL_MENIT = 60; // tautan reset berlaku 1 jam

// Buat tautan reset kata sandi untuk seorang user. Dipakai admin karena server
// belum punya SMTP — tautan diberikan langsung ke pengguna yang bersangkutan.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("users.manage");
  if (denied.error) return denied.error;
  try {
    const rows = await query<{ id: string; email: string }>(
      "SELECT id, email FROM users WHERE id = $1 AND deleted_at IS NULL",
      [params.id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "User tidak ditemukan." }, { status: 404 });
    }

    // Token lama yang belum dipakai dimatikan supaya hanya satu tautan aktif.
    await query("UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", [params.id]);

    const token = randomBytes(32).toString("hex");
    await query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1,$2, now() + ($3 || ' minutes')::interval)`,
      [params.id, hashToken(token), String(TTL_MENIT)]
    );

    const base = process.env.APP_BASE_URL || "http://localhost:3000";
    return NextResponse.json({
      ok: true,
      email: rows[0].email,
      reset_url: `${base}/reset?token=${token}`,
      expires_minutes: TTL_MENIT,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal membuat tautan.") }, { status: 500 });
  }
}
