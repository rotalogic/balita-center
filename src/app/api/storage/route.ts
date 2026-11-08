import { NextResponse } from "next/server";
import { guard } from "@/lib/current-user";
import { storageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Status storage untuk halaman Pengaturan: pemilik bisa memverifikasi driver
// mana yang aktif tanpa membaca log container.
export async function GET() {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;

  const mode = storageMode();
  return NextResponse.json({
    ok: true,
    driver: mode,
    label: mode === "s3" ? "S3 / Cloudflare R2" : "Penyimpanan lokal (volume container)",
    peringatan:
      mode === "lokal"
        ? "Mode lokal aktif: foto disimpan di volume container. Untuk produksi isi STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY."
        : null,
    bucket: mode === "s3" ? process.env.STORAGE_BUCKET || null : null,
    public_url: mode === "s3" ? process.env.STORAGE_PUBLIC_URL || null : null,
  });
}
