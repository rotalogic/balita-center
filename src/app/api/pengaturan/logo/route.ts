import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { getIdentitas } from "@/lib/sekolah";
import { EXT, MAX_BYTES, simpan } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Unggah logo sekolah (gambar, maks 5 MB). Logo tampil di halaman
// Pengaturan dan dapat dipakai dokumen; kop teks dokumen memakai
// nama + tagline dari identitas sekolah.

export async function POST(request: Request) {
  const denied = await guard("settings.manage");
  if (denied.error) return denied.error;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Berkas tidak ditemukan." }, { status: 400 });
    }
    if (!EXT[file.type] || file.type.startsWith("video/")) {
      return NextResponse.json({ ok: false, error: "Logo harus gambar JPG, PNG, atau WEBP." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Ukuran logo maksimal 5 MB." }, { status: 400 });
    }
    const url = await simpan(file.type, Buffer.from(await file.arrayBuffer()));
    await query("UPDATE school_settings SET logo_url = $1, updated_at = now() WHERE id = 1", [url]);
    await getIdentitas(true);
    await catatAudit(denied.user, {
      action: "pengaturan.logo", entityTable: "school_settings", entityId: null, detail: { url },
    });
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message }, { status: 500 });
  }
}
