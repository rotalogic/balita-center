import { NextResponse } from "next/server";
import path from "path";
import { getIdentitas } from "@/lib/sekolah";
import { MIME, baca, namaSah } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Menyajikan logo sekolah secara publik. Logo memang tampil di layar login
// (sebelum pengguna masuk) dan di dokumen orang tua, jadi rute ini
// dikecualikan dari sesi di middleware. Hanya logo dari identitas sekolah
// yang disajikan — berkas lain tetap wajib login lewat /api/files.

export async function GET() {
  const identitas = await getIdentitas();
  const logo = identitas.logo_url;
  if (!logo) return new NextResponse("Logo belum diatur.", { status: 404 });

  // Mode S3 dengan URL publik: arahkan ke alamat aslinya.
  if (/^https?:\/\//i.test(logo)) {
    return NextResponse.redirect(logo);
  }

  const name = path.basename(logo);
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (!namaSah(name) || !MIME[ext] || MIME[ext].startsWith("video/")) {
    return new NextResponse("Logo tidak ditemukan.", { status: 404 });
  }

  try {
    const buffer = await baca(name);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": MIME[ext],
        "Cache-Control": "public, max-age=300",
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return new NextResponse("Logo tidak ditemukan.", { status: 404 });
  }
}
