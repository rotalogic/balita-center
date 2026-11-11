import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const DIR = process.env.UPLOAD_DIR || "/app/uploads";
const JENIS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
const MAKS = 5 * 1024 * 1024;

// Unggahan CV dari halaman Karier publik: hanya PDF/DOC/DOCX maks 5 MB,
// disimpan dengan nama UUID (nama asli tidak pernah dipakai sebagai nama
// berkas). Berkas hanya dapat dibaca kembali oleh staf lewat route
// terotentikasi /api/rekrutmen/cv/[name].
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Berkas CV tidak ditemukan." }, { status: 400 });
    }
    const ext = JENIS[file.type];
    if (!ext) {
      return NextResponse.json({ ok: false, error: "Format CV harus PDF, DOC, atau DOCX." }, { status: 400 });
    }
    if (file.size > MAKS) {
      return NextResponse.json({ ok: false, error: "Ukuran CV maksimal 5 MB." }, { status: 400 });
    }
    const nama = `cv-${randomUUID()}.${ext}`;
    await mkdir(DIR, { recursive: true });
    await writeFile(path.join(DIR, nama), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ ok: true, cv_url: nama, cv_nama: file.name });
  } catch {
    return NextResponse.json({ ok: false, error: "Gagal mengunggah CV. Coba lagi." }, { status: 500 });
  }
}
