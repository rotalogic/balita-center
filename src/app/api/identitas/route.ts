import { NextResponse } from "next/server";
import { getIdentitas } from "@/lib/sekolah";

export const dynamic = "force-dynamic";

// Identitas lembaga untuk tampilan (logo & kop pada laporan web, merek
// aplikasi di sidebar dan layar login, kepala website publik). Bersifat
// publik — nama, kop tiga baris, dan logo memang tampil di dokumen yang
// diterima orang tua — jadi rute ini dikecualikan dari sesi di middleware
// dan tidak memuat data lain.

export async function GET() {
  const identitas = await getIdentitas();
  return NextResponse.json({
    ok: true,
    identitas: {
      nama: identitas.nama,
      tagline: identitas.tagline,
      logo_url: identitas.logo_url,
      nama_yayasan: identitas.nama_yayasan,
      nama_gabungan: identitas.nama_gabungan,
      tagline_gabungan: identitas.tagline_gabungan,
      warna_zkc: identitas.warna_zkc,
      warna_sam: identitas.warna_sam,
    },
  });
}
