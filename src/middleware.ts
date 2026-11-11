import { NextResponse, type NextRequest } from "next/server";
import { bacaSession, signSession, SESI_IDLE_DETIK } from "@/lib/session";

// Rute publik: halaman auth + endpoint auth + website publik lembaga.
const PUBLIC_PAGES = ["/login", "/register", "/forgot", "/reset"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api/whatsapp/webhook diautentikasi oleh tanda tangan Meta (X-Hub-Signature-256),
  // bukan sesi pengguna — jadi harus lolos dari middleware.
  // /api/jobs/* diautentikasi oleh header x-job-token yang divalidasi di dalam
  // route-nya sendiri; tanpa pengecualian ini cron tidak akan pernah sampai.
  const jobDenganToken = pathname.startsWith("/api/jobs/") && Boolean(request.headers.get("x-job-token"));
  // Webhook payment gateway diautentikasi oleh signature Midtrans yang
  // diverifikasi di route-nya, bukan sesi pengguna.
  const webhookGateway = pathname.startsWith("/api/payments/");
  // Identitas sekolah (nama + logo) bersifat publik — tampil di layar login
  // sebelum pengguna masuk; tidak memuat data pribadi apa pun.
  const identitasPublik = pathname === "/api/identitas" || pathname === "/api/identitas/logo";
  // Laporan pelanggaran CSP datang dari browser pengunjung tanpa sesi —
  // endpoint-nya hanya mencatat (tanpa database) dan selalu menjawab 204.
  const laporanCsp = pathname === "/api/csp-report";
  // Website publik lembaga: halaman /website/* dan API /api/publik/* terbuka
  // tanpa sesi — isinya hanya bahan publik yang lolos kaidah halaman publik.
  const websitePublik = pathname === "/website" || pathname.startsWith("/website/");
  const apiPublik = pathname === "/api/publik" || pathname.startsWith("/api/publik/");
  const publicApi = pathname.startsWith("/api/auth/") || pathname.startsWith("/api/whatsapp/") || pathname === "/api/health" || jobDenganToken || webhookGateway || identitasPublik || laporanCsp || apiPublik;
  if (PUBLIC_PAGES.includes(pathname) || websitePublik || publicApi) {
    return NextResponse.next();
  }

  const sesi = await bacaSession(request.cookies.get("sess")?.value);
  if (sesi) {
    const resp = NextResponse.next();
    // Perpanjangan meluncur: setiap permintaan sah memperbarui batas idle 8 jam,
    // batas absolut 7 hari tetap dipegang dari token lama.
    const sisa = sesi.exp - Math.floor(Date.now() / 1000);
    if (sisa < SESI_IDLE_DETIK - 60) {
      resp.cookies.set("sess", await signSession(sesi.userId, SESI_IDLE_DETIK, sesi.abs), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: SESI_IDLE_DETIK,
      });
    }
    return resp;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Belum masuk. Silakan login." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  // Bawa URL lengkap (termasuk ?id=…) supaya pengguna kembali ke editor yang sama.
  const tujuan = `${pathname}${request.nextUrl.search || ""}`;
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(tujuan)}`;
  url.search += `${url.search ? "&" : "?"}sesi=berakhir`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
