import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifySession } from "@/lib/session";

export type SessionUser = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  organization_name: string | null;
  roles: string[];
  permissions: string[];
  branch_ids: string[];
};

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  organization_name: string | null;
};

// Peran & izin diambil dari user_roles (RBAC) DAN kolom users.role (lama),
// supaya user yang dibuat sebelum RBAC tetap berfungsi.
const ROLES_SQL = `
  SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1
  UNION
  SELECT u.role FROM users u WHERE u.id = $1 AND u.role IS NOT NULL`;

const PERMISSIONS_SQL = `
  SELECT DISTINCT p.code
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
   WHERE ur.user_id = $1
  UNION
  SELECT DISTINCT p.code
    FROM users u
    JOIN roles r ON r.code = u.role
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
   WHERE u.id = $1 AND u.role IS NOT NULL`;

export async function currentUser(): Promise<SessionUser | null> {
  const userId = await verifySession(cookies().get("sess")?.value);
  if (!userId) return null;

  const rows = await query<UserRow>(
    `SELECT id, full_name, email, role, organization_name FROM users
      WHERE id = $1 AND is_active AND deleted_at IS NULL AND status = 'aktif'`,
    [userId]
  );
  const user = rows[0];
  if (!user) return null;

  const [roles, permissions, branches] = await Promise.all([
    query<{ code: string }>(ROLES_SQL, [userId]),
    query<{ code: string }>(PERMISSIONS_SQL, [userId]),
    query<{ branch_id: string }>("SELECT branch_id FROM user_branches WHERE user_id = $1", [userId]),
  ]);

  return {
    ...user,
    roles: roles.map((row) => row.code),
    permissions: permissions.map((row) => row.code),
    branch_ids: branches.map((row) => row.branch_id),
  };
}

export function hasPermission(user: SessionUser | null, code: string): boolean {
  return Boolean(user && user.permissions.includes(code));
}

// Super Admin & Owner melihat semua cabang. Peran lain dibatasi ke cabangnya
// (user_branches). Mengembalikan null = tanpa batas cabang.
export function branchScope(user: SessionUser): string[] | null {
  const global = [...user.roles, user.role].some((role) => role === "super_admin" || role === "owner");
  if (global) return null;
  return user.branch_ids.length > 0 ? user.branch_ids : [];
}

// Dipakai di route handler API: kembalikan { user } atau { error } siap kirim.
export async function guard(
  code: string
): Promise<{ user: SessionUser; error: null } | { user: null; error: NextResponse }> {
  const user = await currentUser();
  if (!user) {
    return { user: null, error: NextResponse.json({ ok: false, error: "Belum masuk." }, { status: 401 }) };
  }
  if (!hasPermission(user, code)) {
    return {
      user: null,
      error: NextResponse.json(
        { ok: false, error: `Akses ditolak: peran ${user.roles.join(", ") || user.role} tidak punya izin ${code}.` },
        { status: 403 }
      ),
    };
  }
  return { user, error: null };
}
