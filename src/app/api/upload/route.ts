import { NextResponse } from "next/server";
import { guard } from "@/lib/current-user";
import { dbErrorMessage } from "@/lib/db";
import { EXT, MAX_BYTES, MAX_VIDEO_BYTES, jenisMedia, simpan, storageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Unggah satu berkas media: gambar (JPG/PNG/WEBP, maks 5 MB) atau video
// (MP4/WebM, maks 50 MB). Driver storage dipilih dari env (S3/R2 atau lokal).
export async function POST(request: Request) {
  const denied = await guard("students.create");
  if (denied.error) return denied.error;

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Berkas tidak ditemukan." }, { status: 400 });
    }
    const ext = EXT[file.type];
    if (!ext) {
      return NextResponse.json(
        { ok: false, error: "Format harus JPG, PNG, WEBP, MP4, atau WebM." },
        { status: 400 }
      );
    }
    const media = jenisMedia(file.type);
    const batas = media === "video" ? MAX_VIDEO_BYTES : MAX_BYTES;
    if (file.size > batas) {
      return NextResponse.json(
        { ok: false, error: media === "video" ? "Ukuran video maksimal 50 MB." : "Ukuran maksimal 5 MB." },
        { status: 400 }
      );
    }

    const url = await simpan(file.type, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ ok: true, url, driver: storageMode(), media_type: media, mime_type: file.type });
  } catch (error) {
    const message = dbErrorMessage(error, "Gagal mengunggah. Coba lagi.");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
