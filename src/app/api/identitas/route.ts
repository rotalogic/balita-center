import { NextResponse } from "next/server";
import { getIdentitas } from "@/lib/sekolah";

export const dynamic = "force-dynamic";

// Identitas sekolah untuk tampilan (logo & kop pada laporan web, merek
// aplikasi di sidebar dan layar login). Bersifat publik — nama, tagline,
// dan logo memang tampil di dokumen yang diterima orang tua — jadi rute
// ini dikecualikan dari sesi di middleware dan tidak memuat data lain.

export async function GET() {
  const identitas = await getIdentitas();
  return NextResponse.json({
    ok: true,
    identitas: { nama: identitas.nama, tagline: identitas.tagline, logo_url: identitas.logo_url },
  });
}
