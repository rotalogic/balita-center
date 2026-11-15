import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { guard } from "@/lib/current-user";
import { query } from "@/lib/db";
import { catatAudit } from "@/lib/audit";
import { hashToken } from "@/lib/reset-token";
import { emailPersetujuanAkun, smtpConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

type Body = { role?: string; is_active?: boolean; status?: string; branch_id?: string | null; staff_id?: string | null };

const STATUS_VALID = ["aktif", "menunggu_persetujuan", "nonaktif"];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("users.manage");
  if (denied.error) return denied.error;
  const actor = denied.user;

  const body = (await request.json().catch(() => ({}))) as Body;

  const rows = await query<{ id: string; role: string; is_active: boolean; email: string; full_name: string; phone: string | null; status: string }>(
    "SELECT id, role, is_active, email, full_name, phone, status FROM users WHERE id = $1 AND deleted_at IS NULL",
    [params.id]
  );
  const target = rows[0];
  if (!target) {
    return NextResponse.json({ ok: false, error: "User tidak ditemukan." }, { status: 404 });
  }

  // Cegah mengunci diri sendiri: jangan ubah peran/status akun sendiri.
  if (
    target.id === actor.id &&
    (body.role !== undefined || body.is_active !== undefined || body.status !== undefined)
  ) {
    return NextResponse.json(
      { ok: false, error: "Tidak bisa mengubah peran atau status akun sendiri." },
      { status: 400 }
    );
  }

  if (body.status !== undefined) {
    if (!STATUS_VALID.includes(body.status)) {
      return NextResponse.json(
        { ok: false, error: `Status harus salah satu: ${STATUS_VALID.join(", ")}.` },
        { status: 400 }
      );
    }
    await query(
      "UPDATE users SET status = $1, is_active = ($1 <> 'nonaktif'), updated_at = now() WHERE id = $2",
      [body.status, target.id]
    );
  }

  if (body.role !== undefined) {
    const valid = await query<{ code: string }>("SELECT code FROM roles WHERE code = $1", [body.role]);
    if (!valid.length) {
      return NextResponse.json({ ok: false, error: `Peran "${body.role}" tidak dikenal.` }, { status: 400 });
    }
    await query("UPDATE users SET role = $1, updated_at = now() WHERE id = $2", [body.role, target.id]);
  }

  if (body.branch_id !== undefined) {
    await query("DELETE FROM user_branches WHERE user_id = $1", [target.id]);
    if (body.branch_id) {
      await query(
        "INSERT INTO user_branches (user_id, branch_id, is_primary) VALUES ($1,$2,true) ON CONFLICT DO NOTHING",
        [target.id, body.branch_id]
      );
    }
  }

  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json({ ok: false, error: "is_active harus boolean." }, { status: 400 });
    }
    await query("UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2", [
      body.is_active,
      target.id,
    ]);
  }

  // Penautan akun ↔ staf (Blok 3B): satu staf hanya boleh punya satu akun.
  if (body.staff_id !== undefined) {
    if (body.staff_id) {
      const staf = await query<{ id: string; full_name: string; user_id: string | null }>(
        "SELECT id, full_name, user_id FROM staff WHERE id = $1",
        [body.staff_id]
      );
      if (!staf[0]) {
        return NextResponse.json({ ok: false, error: "Staf tidak ditemukan." }, { status: 404 });
      }
      if (staf[0].user_id && staf[0].user_id !== target.id) {
        return NextResponse.json(
          { ok: false, error: `Staf ${staf[0].full_name} sudah tertaut ke akun lain. Lepas dulu di akun itu.` },
          { status: 409 }
        );
      }
      await query("UPDATE staff SET user_id = NULL WHERE user_id = $1 AND id <> $2", [target.id, body.staff_id]);
      await query("UPDATE staff SET user_id = $1 WHERE id = $2", [target.id, body.staff_id]);
    } else {
      await query("UPDATE staff SET user_id = NULL WHERE user_id = $1", [target.id]);
    }
  }

  await catatAudit(actor, {
    action: body.staff_id !== undefined ? "user.link_staff" : "user.update",
    entityTable: "users",
    entityId: target.id,
    detail: { email: target.email, ...body },
  });

  const updated = await query(
    "SELECT id, role, is_active, status, email FROM users WHERE id = $1",
    [target.id]
  );

  // Otomatis sesudah diterima: persetujuan dari antrean langsung membuatkan
  // tautan aktivasi baru (berlaku 3 hari, sama seperti undangan), mencoba
  // mengirimnya ke email dan antrean WhatsApp, dan mengembalikannya ke admin
  // supaya bisa disalin bila kedua kanal belum terkonfigurasi. Tanpa langkah
  // ini akun undangan tidak pernah bisa masuk: kata sandinya acak dan tidak
  // diketahui siapa pun sampai pemilik akun membuatnya lewat tautan ini.
  // Kegagalan aktivasi tidak membatalkan persetujuan yang sudah tersimpan.
  let aktivasi: { url: string; email_terkirim: boolean; wa: string; berlaku_hari: number } | null = null;
  if (body.status === "aktif" && target.status === "menunggu_persetujuan") {
    try {
      await query("UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", [target.id]);
      const token = randomBytes(32).toString("hex");
      await query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES ($1,$2, now() + ($3 || ' minutes')::interval)`,
        [target.id, hashToken(token), String(60 * 24 * 3)]
      );
      const base = process.env.APP_BASE_URL || "http://localhost:3000";
      const url = `${base}/reset?token=${token}`;

      let emailTerkirim = false;
      if (smtpConfigured()) {
        const kirim = await emailPersetujuanAkun(target.email, target.full_name, url);
        emailTerkirim = kirim.ok;
        if (!kirim.ok) console.error(`[PERSETUJUAN] email gagal (${kirim.alasan}) untuk ${target.email}`);
      }

      let wa = "tanpa_nomor";
      const digit = (target.phone || "").replace(/\D/g, "");
      const nomor = digit.startsWith("0") ? `62${digit.slice(1)}` : digit.startsWith("8") ? `62${digit}` : digit;
      if (nomor.length >= 10) {
        const teks =
          `Halo ${target.full_name}, pendaftaran akun Balita Center Anda sudah disetujui. ` +
          `Buka tautan ini untuk membuat kata sandi lalu masuk (berlaku 3 hari): ${url}`;
        await query(
          "INSERT INTO wa_outbox (tujuan, teks_asli, konteks, dibuat_oleh) VALUES ($1, $2, $3::jsonb, $4)",
          [nomor, teks, JSON.stringify({ jenis: "aktivasi_akun", user_id: target.id }), actor.id]
        );
        wa = "terantre";
      }

      aktivasi = { url, email_terkirim: emailTerkirim, wa, berlaku_hari: 3 };
      await catatAudit(actor, {
        action: "user.disetujui",
        entityTable: "users",
        entityId: target.id,
        detail: { email: target.email, aktivasi: { email_terkirim: emailTerkirim, wa } },
      });
    } catch (error) {
      console.error("[PERSETUJUAN] aktivasi otomatis gagal:", error);
    }
  }

  return NextResponse.json({ ok: true, user: updated[0], ...(aktivasi ? { aktivasi } : {}) });
}
