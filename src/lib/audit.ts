import { query } from "@/lib/db";
import { branchScope, type SessionUser } from "@/lib/current-user";

// Jejak audit. Aturan: pencatatan audit TIDAK BOLEH menggagalkan aksi utama.
// Semua galat ditelan di sini dan hanya muncul di log server.
export type AuditInput = {
  action: string; // "daily_report.submit", "leave.approve", ...
  entityTable?: string | null;
  entityId?: string | null;
  branchId?: string | null;
  detail?: Record<string, unknown> | null;
};

export async function catatAudit(user: { id: string } | null, input: AuditInput): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (branch_id, user_id, action, entity_table, entity_id, detail)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        input.branchId || null,
        user?.id || null,
        input.action,
        input.entityTable || "-",
        input.entityId || null,
        input.detail ? JSON.stringify(input.detail) : null,
      ]
    );
  } catch (error) {
    console.error("[audit] gagal mencatat", input.action, (error as Error)?.message);
  }
}

// Ringkasan perubahan "field: dari → ke" untuk kolom yang benar-benar berubah.
export function beda(
  sebelum: Record<string, unknown>,
  sesudah: Record<string, unknown>,
  kolom: string[]
): Record<string, { dari: unknown; ke: unknown }> {
  const hasil: Record<string, { dari: unknown; ke: unknown }> = {};
  for (const k of kolom) {
    const a = sebelum[k] ?? null;
    const b = sesudah[k] ?? null;
    if (String(a ?? "") !== String(b ?? "")) hasil[k] = { dari: a, ke: b };
  }
  return hasil;
}

// Akar masalah jejaak audit "selalu 0": audit_logs.branch_id NOT NULL?
// Tidak — tapi kalau user tidak punya cabang, cabang diambil dari entitasnya.
export function cabangUntuk(user: SessionUser | null, branchId?: string | null): string | null {
  if (branchId) return branchId;
  if (!user) return null;
  const scope = branchScope(user);
  return scope && scope.length === 1 ? scope[0] : null;
}
