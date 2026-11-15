import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { query, dbErrorMessage } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { signSession, SESI_IDLE_DETIK } from "@/lib/session";
import { catatAudit } from "@/lib/audit";
import { googleConfigured, googleRedirectUri } from "@/lib/google";

export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  totp_enabled: boolean;
  status: string;
  google_sub: string | null;
};

// Alihan balik dari Google: tukar kode dengan profil, lalu buat atau tautkan
// akun. Gerbangnya sama seperti pendaftaran biasa: akun baru menunggu
// persetujuan Super Admin, akun nonaktif ditolak, 2FA tetap berlaku.
export async function GET(request: Request) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const gagal = (pesan: string) => NextResponse.redirect(`${base}/login?pesan=${pesan}`);

  if (!googleConfigured()) return gagal("google-belum");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("cookie") || "";
  const ambilCookie = (nama: string) =>
    cookie.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${nama}=`))?.slice(nama.length + 1);
  const stateCookie = ambilCookie("gstate");
  const nextCookie = ambilCookie("gnext");

  if (url.searchParams.get("error") || !code || !state || !stateCookie || state !== stateCookie) {
    return gagal("google-gagal");
  }

  try {
    const tukar = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = (await tukar.json().catch(() => ({}))) as { access_token?: string };
    if (!tukar.ok || !tokenJson.access_token) return gagal("google-gagal");

    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const info = (await infoRes.json().catch(() => ({}))) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    if (!infoRes.ok || !info.sub || !info.email) return gagal("google-gagal");
    if (!info.email_verified) return gagal("google-email");

    const email = info.email.trim().toLowerCase();
    const kolom = "id, full_name, email, is_active, totp_enabled, status, google_sub";
    let rows = await query<UserRow>(`SELECT ${kolom} FROM users WHERE google_sub = $1 AND deleted_at IS NULL LIMIT 1`, [info.sub]);
    let user = rows[0];
    if (!user) {
      rows = await query<UserRow>(`SELECT ${kolom} FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL LIMIT 1`, [email]);
      user = rows[0];
      if (user && user.google_sub && user.google_sub !== info.sub) return gagal("google-gagal");
      if (user && !user.google_sub) {
        await query("UPDATE users SET google_sub = $1, updated_at = now() WHERE id = $2", [info.sub, user.id]);
      }
    }

    if (!user) {
      // Pendaftar Google baru: tanpa kata sandi (acak, tidak diketahui siapa
      // pun, sama seperti akun undangan) dan masuk antrean persetujuan.
      const nama = (info.name || "").trim() || email.split("@")[0];
      const inserted = await query<{ id: string }>(
        `INSERT INTO users (full_name, email, password_hash, role, status, is_active, google_sub, created_at, updated_at)
         VALUES ($1,$2,$3,'orang_tua','menunggu_persetujuan',true,$4,now(),now()) RETURNING id`,
        [nama, email, hashPassword(randomBytes(24).toString("hex")), info.sub]
      );
      user = {
        id: inserted[0].id,
        full_name: nama,
        email,
        is_active: true,
        totp_enabled: false,
        status: "menunggu_persetujuan",
        google_sub: info.sub,
      };
      await catatAudit(null, {
        action: "auth.daftar_google",
        entityTable: "users",
        entityId: user.id,
        detail: { email },
      });
    }

    if (!user.is_active || user.status === "nonaktif") return gagal("akun-nonaktif");
    if (user.status === "menunggu_persetujuan") return gagal("menunggu");

    if (user.totp_enabled) {
      const response = NextResponse.redirect(`${base}/login?dua=1`);
      response.cookies.set("pend", await signSession(user.id, 300), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 300,
        secure: false,
      });
      return response;
    }

    await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]).catch(() => null);
    await catatAudit({ id: user.id }, { action: "auth.login_google", entityTable: "users", entityId: user.id });

    const tujuan = nextCookie && nextCookie.startsWith("/") && !nextCookie.startsWith("//") ? nextCookie : "/";
    const response = NextResponse.redirect(`${base}${tujuan}`);
    response.cookies.set("sess", await signSession(user.id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESI_IDLE_DETIK,
      secure: false,
    });
    response.cookies.set("gstate", "", { path: "/", maxAge: 0 });
    response.cookies.set("gnext", "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("[GOOGLE] callback gagal:", dbErrorMessage(error, "gagal"));
    return gagal("google-gagal");
  }
}
