import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { hashToken } from "@/lib/reset-token";
import { emailUndangan, smtpConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

const TTL_MENIT = 60 * 24 * 3; // tautan undangan berlaku 3 hari

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone: string | null;
  status: string;
  organization_name: string | null;
  is_active: boolean;
  totp_enabled: boolean;
  created_at: string;
  branch_names: string | null;
};

type RoleRow = { code: string; name: string; permission_count: number };

export async function GET() {
  const denied = await guard("users.manage");
  if (denied.error) return denied.error;
  try {
    const users = await query<UserRow>(
      `SELECT u.id, u.full_name, u.email, u.role, u.phone, u.status, u.organization_name,
              u.is_active, u.totp_enabled, u.created_at,
              (SELECT string_agg(b.name, ', ') FROM user_branches ub JOIN branches b ON b.id = ub.branch_id
                WHERE ub.user_id = u.id) AS branch_names,
              (SELECT s.id FROM staff s WHERE s.user_id = u.id LIMIT 1) AS staff_id,
              (SELECT s.full_name FROM staff s WHERE s.user_id = u.id LIMIT 1) AS staff_name
         FROM users u
        WHERE u.deleted_at IS NULL
        ORDER BY
          CASE u.status WHEN 'menunggu_persetujuan' THEN 0 ELSE 1 END,
          u.created_at DESC`
    );
    const roles = await query<RoleRow>(
      `SELECT r.code, r.name, COUNT(rp.permission_id)::int AS permission_count
         FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id
        GROUP BY r.code, r.name ORDER BY permission_count DESC, r.name`
    );
    const branches = await query<{ id: string; name: string }>("SELECT id, name FROM branches ORDER BY name");
    const staff = await query<{ id: string; full_name: string; position: string | null; user_id: string | null }>(
      "SELECT id, full_name, position, user_id FROM staff WHERE status IS DISTINCT FROM 'nonaktif' ORDER BY full_name LIMIT 500"
    );
    return NextResponse.json({ ok: true, users, roles, branches, staff });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}

// Undang pengguna: akun dibuat belum aktif + tautan aktivasi sekali pakai.
// Kata sandi tidak pernah dikirim sebagai teks biasa.
export async function POST(request: Request) {
  const denied = await guard("users.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as {
      full_name?: string;
      email?: string;
      role?: string;
      branch_id?: string;
      organization_name?: string;
    };

    const fullName = (body.full_name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const role = (body.role || "orang_tua").trim();

    if (fullName.length < 3) {
      return NextResponse.json({ ok: false, error: "Nama minimal 3 karakter." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Format email tidak valid." }, { status: 400 });
    }
    const roleRows = await query<{ code: string }>("SELECT code FROM roles WHERE code = $1", [role]);
    if (!roleRows.length) {
      return NextResponse.json({ ok: false, error: "Peran tidak dikenal." }, { status: 400 });
    }
    const existing = await query<{ id: string }>("SELECT id FROM users WHERE lower(email) = $1", [email]);
    if (existing.length) {
      return NextResponse.json({ ok: false, error: "Email sudah terdaftar." }, { status: 409 });
    }

    // Kata sandi acak yang tidak diketahui siapa pun — user wajib memakai tautan aktivasi.
    const acak = randomBytes(24).toString("hex");
    const inserted = await query<{ id: string }>(
      `INSERT INTO users (full_name, email, password_hash, role, organization_name, status, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'menunggu_persetujuan',true,now(),now()) RETURNING id`,
      [fullName, email, hashPassword(acak), role, (body.organization_name || "").trim() || null]
    );
    const userId = inserted[0].id;

    if (body.branch_id) {
      await query(
        `INSERT INTO user_branches (user_id, branch_id, is_primary) VALUES ($1,$2,true)
         ON CONFLICT DO NOTHING`,
        [userId, body.branch_id]
      );
    }

    const token = randomBytes(32).toString("hex");
    await query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1,$2, now() + ($3 || ' minutes')::interval)`,
      [userId, hashToken(token), String(TTL_MENIT)]
    );

    await catatAudit(denied.user, {
      action: "user.invite",
      entityTable: "users",
      entityId: userId,
      detail: { email, peran: role, cabang: body.branch_id || null },
    });

    const base = process.env.APP_BASE_URL || "http://localhost:3000";
    const activationUrl = `${base}/reset?token=${token}`;
    let emailTerkirim = false;
    if (smtpConfigured()) {
      const kirim = await emailUndangan(email, fullName, activationUrl, role);
      emailTerkirim = kirim.ok;
      if (!kirim.ok) console.error(`[INVITE] email gagal (${kirim.alasan}) untuk ${email}`);
    }

    return NextResponse.json({
      ok: true,
      user_id: userId,
      activation_url: activationUrl,
      email_terkirim: emailTerkirim,
      smtp: smtpConfigured(),
      expires_hours: TTL_MENIT / 60,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error, "Gagal mengundang pengguna.") }, { status: 500 });
  }
}
