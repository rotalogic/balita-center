import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Penampung laporan pelanggaran CSP (mode Report-Only, 9 Nov 2026).
// Sengaja tanpa login dan tanpa database: laporan datang dari browser
// pengunjung, dan kegagalan di sini tidak boleh mengganggu halaman apa pun.
// Isinya hanya dicatat ke log server untuk ditinjau sebelum CSP ditegakkan.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const report = body?.["csp-report"] ?? body ?? {};
    console.warn("[csp-report]", JSON.stringify({
      document: report["document-uri"] ?? report["documentURL"] ?? null,
      directive: report["violated-directive"] ?? null,
      blocked: report["blocked-uri"] ?? null,
      source: report["source-file"] ?? null,
    }));
  } catch {
    // Laporan CSP yang rusak diabaikan diam-diam.
  }
  return new NextResponse(null, { status: 204 });
}
