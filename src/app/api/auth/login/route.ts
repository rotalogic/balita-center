import { NextResponse } from "next/server";
import { query, dbErrorMessage } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { signSession, SESI_IDLE_DETIK } from "@/lib/session";
import { catatAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Pembatas percobaan login. ponytail: hitungan di memori proses — cukup untuk
// satu container; pindah ke Redis/tabel bila nanti jalan >1 replika.
const BATAS = 5;
const JENDELA_MS = 10 * 60 * 1000;
const percobaan = new Map<string, { n: number; mulai: number }>();

function kunciPembatas(request: Request, email: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "lokal";
  return `${ip}|${email.toLowerCase()}`;
}

function terlaluSering(kunci: string): number {
  const sekarang = Date.now();
  const catatan = percobaan.get(kunci);
  if (!catatan || sekarang - catatan.mulai > JENDELA_MS) {
    percobaan.set(kunci, { n: 0, mulai: sekarang });
    return 0;
  }
  return catatan.n >= BATAS ? Math.ceil((JENDELA_MS - (sekarang - catatan.mulai)) / 1000) : 0;
}

type UserRow = { id: string; password_hash: string; is_active: boolean; totp_enabled: boolean; status: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
    const email = (body.email || "").trim();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Email dan kata sandi wajib diisi." }, { status: 400 });
    }

    const kunci = kunciPembatas(request, email);
    const tunggu = terlaluSering(kunci);
    if (tunggu > 0) {
      return NextResponse.json(
        { ok: false, error: `Terlalu banyak percobaan masuk. Coba lagi dalam ${Math.ceil(tunggu / 60)} menit.` },
        { status: 429, headers: { "Retry-After": String(tunggu) } }
      );
    }

    const rows = await query<UserRow>(
      `SELECT id, password_hash, is_active, totp_enabled, status FROM users
        WHERE lower(email) = lower($1) AND deleted_at IS NULL
        LIMIT 1`,
      [email]
    );
    const user = rows[0];

    if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
      // Login gagal juga dicatat (aktor = null, email di detail).
      const catatan = percobaan.get(kunci) || { n: 0, mulai: Date.now() };
      percobaan.set(kunci, { n: catatan.n + 1, mulai: catatan.mulai });
      await catatAudit(null, {
        action: "auth.login_gagal",
        entityTable: "users",
        entityId: user?.id ?? null,
        detail: { email },
      });
      return NextResponse.json({ ok: false, error: "Email atau kata sandi salah." }, { status: 401 });
    }

    // Akun yang belum disetujui / dinonaktifkan tidak boleh masuk.
    if (user.status === "menunggu_persetujuan") {
      return NextResponse.json(
        { ok: false, error: "Akun Anda masih menunggu persetujuan Super Admin. Hubungi admin sekolah." },
        { status: 403 }
      );
    }
    if (user.status !== "aktif") {
      return NextResponse.json(
        { ok: false, error: "Akun Anda dinonaktifkan. Hubungi admin sekolah." },
        { status: 403 }
      );
    }

    // Tahap 2: kalau 2FA aktif, jangan langsung beri sesi penuh.
    if (user.totp_enabled) {
      const response = NextResponse.json({ ok: false, needs2fa: true, message: "Masukkan kode 2FA." });
      response.cookies.set("pend", await signSession(user.id, 300), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 300,
        secure: false,
      });
      return response;
    }

    percobaan.delete(kunci);
    await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]).catch(() => null);
    await catatAudit({ id: user.id }, {
      action: "auth.login",
      entityTable: "users",
      entityId: user.id,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set("sess", await signSession(user.id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESI_IDLE_DETIK,
      // ponytail: secure=false karena situs masih HTTP. Set true begitu HTTPS aktif.
      secure: false,
    });
    return response;
  } catch (error) {
    const message = dbErrorMessage(error, "Gagal masuk.");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
