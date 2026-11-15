import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { googleConfigured, googleRedirectUri } from "@/lib/google";

export const dynamic = "force-dynamic";

// Mulai alur Masuk/Daftar dengan Google: buat state anti-CSRF, simpan di
// cookie singkat, lalu alihkan ke halaman persetujuan Google.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  if (!googleConfigured()) {
    return NextResponse.redirect(`${base}/login?pesan=google-belum`);
  }

  const state = randomBytes(24).toString("hex");
  const nextMentah = url.searchParams.get("next") || "";
  const next = nextMentah.startsWith("/") && !nextMentah.startsWith("//") ? nextMentah : "";

  const tujuan = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  tujuan.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID || "");
  tujuan.searchParams.set("redirect_uri", googleRedirectUri());
  tujuan.searchParams.set("response_type", "code");
  tujuan.searchParams.set("scope", "openid email profile");
  tujuan.searchParams.set("state", state);
  tujuan.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(tujuan.toString());
  const opsi = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600, secure: false };
  response.cookies.set("gstate", state, opsi);
  if (next) response.cookies.set("gnext", next, opsi);
  return response;
}
