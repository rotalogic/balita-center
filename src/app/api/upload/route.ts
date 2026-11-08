import { NextResponse } from "next/server";
import { guard } from "@/lib/current-user";
import { dbErrorMessage } from "@/lib/db";
import { EXT, MAX_BYTES, simpan, storageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Unggah satu berkas gambar. Driver storage dipilih dari env (S3/R2 atau lokal).
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
        { ok: false, error: "Format harus JPG, PNG, atau WEBP." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Ukuran maksimal 5 MB." }, { status: 400 });
    }

    const url = await simpan(file.type, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ ok: true, url, driver: storageMode() });
  } catch (error) {
    const message = dbErrorMessage(error, "Gagal mengunggah. Coba lagi.");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
