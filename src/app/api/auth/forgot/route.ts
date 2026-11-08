import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { query, dbErrorMessage } from "@/lib/db";
import { hashToken } from "@/lib/reset-token";
import { emailResetSandi, smtpConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

const TTL_MINUTES = 60;

export async function POST(request: Request) {
  const generic = {
    ok: true,
    message:
      "Kalau email terdaftar, tautan reset sudah dibuat. Tautan berlaku 60 menit. " +
      "Hubungi admin bila email tidak masuk (pengiriman email belum aktif).",
  };

  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = (body.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: "Email wajib diisi." }, { status: 400 });
    }

    const rows = await query<{ id: string; full_name: string }>(
      "SELECT id, full_name FROM users WHERE lower(email) = $1 AND is_active AND deleted_at IS NULL",
      [email]
    );
    if (!rows.length) return NextResponse.json(generic); // jangan bocorkan keberadaan akun

    const token = randomBytes(32).toString("hex");

    await query("UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", [
      rows[0].id,
    ]);
    await query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
      [rows[0].id, hashToken(token), String(TTL_MINUTES)]
    );

    const base = process.env.APP_BASE_URL || "https://balita.rotalogic.id";
    const url = `${base}/reset?token=${token}`;

    if (smtpConfigured()) {
      const kirim = await emailResetSandi(email, rows[0].full_name, url);
      if (kirim.ok) {
        return NextResponse.json({ ...generic, message: "Kalau email terdaftar, tautan reset sudah dikirim. Berlaku 60 menit." });
      }
      // Email gagal: jangan bohongi pengguna, dan tetap sediakan jejak untuk admin.
      console.error(`[RESET] email gagal (${kirim.alasan}) untuk ${email} link=${url}`);
      return NextResponse.json({
        ok: true,
        message: "Email reset gagal dikirim. Minta admin membuat tautan dari menu Pengguna.",
      });
    }

    // SMTP belum diisi: tautan tetap dicatat supaya admin bisa meneruskan manual.
    console.log(`[RESET] email=${email} link=${url}`);
    return NextResponse.json(generic);
  } catch (error) {
    const message = dbErrorMessage(error, "Gagal memproses permintaan.");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
