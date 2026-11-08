import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { EXT, MAX_BYTES, simpan } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Profil guru yang terhubung ke akun yang sedang masuk: foto profil dan
// tanda tangan digital diunggah guru sendiri dari halaman Akun.
// Tanda tangan tampil di kaki laporan harian & rapor yang ia buat.

async function stafSaya(userId: string) {
  const rows = await query<{ id: string; full_name: string; position: string | null; photo_url: string | null; signature_url: string | null }>(
    "SELECT id, full_name, position, photo_url, signature_url FROM staff WHERE user_id = $1::uuid AND deleted_at IS NULL LIMIT 1",
    [userId]
  );
  return rows[0] || null;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Belum masuk." }, { status: 401 });
  const staf = await stafSaya(user.id);
  return NextResponse.json({ ok: true, staf });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Belum masuk." }, { status: 401 });
  try {
    const staf = await stafSaya(user.id);
    if (!staf) {
      return NextResponse.json(
        { ok: false, error: "Akun Anda belum terhubung ke data staf. Minta admin menghubungkan akun ini ke profil guru Anda di menu SDM." },
        { status: 409 }
      );
    }
    const form = await request.formData();
    const jenis = String(form.get("jenis") || "");
    if (jenis !== "foto" && jenis !== "ttd") {
      return NextResponse.json({ ok: false, error: "Jenis unggahan harus foto atau ttd." }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Berkas tidak ditemukan." }, { status: 400 });
    }
    if (!EXT[file.type] || file.type.startsWith("video/")) {
      return NextResponse.json({ ok: false, error: "Berkas harus gambar JPG, PNG, atau WEBP." }, { status: 400 });
    }
    const batas = jenis === "ttd" ? 2 * 1024 * 1024 : MAX_BYTES;
    if (file.size > batas) {
      return NextResponse.json({ ok: false, error: `Ukuran maksimal ${jenis === "ttd" ? "2 MB" : "5 MB"}.` }, { status: 400 });
    }
    const url = await simpan(file.type, Buffer.from(await file.arrayBuffer()));
    const kolom = jenis === "foto" ? "photo_url" : "signature_url";
    await query(`UPDATE staff SET ${kolom} = $1, updated_at = now() WHERE id = $2::uuid`, [url, staf.id]);
    await catatAudit(user, {
      action: jenis === "foto" ? "staf.foto_profil" : "staf.tanda_tangan",
      entityTable: "staff",
      entityId: staf.id,
      detail: { url },
    });
    return NextResponse.json({ ok: true, url, jenis });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message }, { status: 500 });
  }
}
