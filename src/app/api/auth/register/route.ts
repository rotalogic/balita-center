import { NextResponse } from "next/server";
import { query, dbErrorMessage } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

const DEFAULT_ROLE = "orang_tua";
const MIN_PASSWORD = 8;
// Peran yang tidak boleh dipilih saat mendaftar sendiri.
const FORBIDDEN_ROLES = ["super_admin"];

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      full_name?: string;
      email?: string;
      password?: string;
      phone?: string;
      role?: string;
      organization_name?: string;
    };

    const fullName = (body.full_name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const requestedRole = (body.role || DEFAULT_ROLE).trim();
    const organization = (body.organization_name || "").trim();

    if (fullName.length < 3) {
      return NextResponse.json({ ok: false, error: "Nama minimal 3 karakter." }, { status: 400 });
    }
    if (organization.length < 3) {
      return NextResponse.json(
        { ok: false, error: "Nama sekolah/organisasi minimal 3 karakter." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Format email tidak valid." }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD) {
      return NextResponse.json(
        { ok: false, error: `Kata sandi minimal ${MIN_PASSWORD} karakter.` },
        { status: 400 }
      );
    }
    if (FORBIDDEN_ROLES.includes(requestedRole)) {
      return NextResponse.json(
        { ok: false, error: "Peran Super Admin tidak bisa dipilih saat mendaftar." },
        { status: 403 }
      );
    }
    const roleRows = await query<{ code: string }>("SELECT code FROM roles WHERE code = $1", [requestedRole]);
    if (!roleRows.length) {
      return NextResponse.json({ ok: false, error: "Peran tidak dikenal." }, { status: 400 });
    }

    const existing = await query<{ id: string }>("SELECT id FROM users WHERE lower(email) = $1", [email]);
    if (existing.length) {
      return NextResponse.json({ ok: false, error: "Email sudah terdaftar." }, { status: 409 });
    }

    // Pendaftar mandiri TIDAK langsung aktif: akun masuk antrean persetujuan
    // Super Admin. Dipilih (bukan verifikasi email) karena server ini belum punya
    // SMTP — tanpa email, verifikasi email hanya akan mengunci semua pendaftar.
    const inserted = await query<{ id: string }>(
      `INSERT INTO users (full_name, email, password_hash, phone, role, organization_name,
                          status, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'menunggu_persetujuan',true,now(),now()) RETURNING id`,
      [fullName, email, hashPassword(password), (body.phone || "").trim() || null, requestedRole, organization]
    );
    const userId = inserted[0].id;

    // Peran dengan dashboard.view masuk aplikasi admin, sisanya ke portal orang tua/murid.
    const dashboard = await query<{ ok: number }>(
      `SELECT 1 AS ok FROM roles r
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
        WHERE r.code = $1 AND p.code = 'dashboard.view'`,
      [requestedRole]
    );
    const redirect = dashboard.length ? "/" : "/connect";

    return NextResponse.json({
      ok: true,
      pending: true,
      redirect,
      user_id: userId,
      message:
        "Pendaftaran berhasil. Akun menunggu persetujuan Super Admin — Anda akan bisa masuk setelah disetujui.",
    });
  } catch (error) {
    const message = dbErrorMessage(error, "Gagal mendaftar.");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
