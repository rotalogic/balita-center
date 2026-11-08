import { NextResponse } from "next/server";
import path from "path";
import { currentUser } from "@/lib/current-user";
import { MIME, baca, namaSah } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Menyajikan berkas dari driver lokal. Wajib login: foto anak bukan aset publik.
export async function GET(_request: Request, { params }: { params: { name: string } }) {
  const user = await currentUser();
  if (!user) return new NextResponse("Belum masuk.", { status: 401 });

  // basename + pola ketat: cegah path traversal (../../etc/passwd)
  const name = path.basename(params.name);
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (!namaSah(name) || !MIME[ext]) {
    return new NextResponse("Berkas tidak ditemukan.", { status: 404 });
  }

  try {
    const buffer = await baca(name);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": MIME[ext],
        "Cache-Control": "private, max-age=86400",
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return new NextResponse("Berkas tidak ditemukan.", { status: 404 });
  }
}
