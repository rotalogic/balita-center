import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Satu endpoint baca untuk halaman modul: admission, cabang, investor,
// komunikasi, pengaturan, akademik, dan laporan. Semua dibaca dari tabel asli.
export async function GET() {
  try {
    const [leads, registrations, branchesAgg, cashAgg, messages, announcements, users, rolesAgg, audit, cycles, attendanceAgg] = await Promise.all([
      query("SELECT * FROM leads ORDER BY created_at DESC LIMIT 50"),
      query("SELECT * FROM registrations ORDER BY created_at DESC LIMIT 50"),
      query(
        `SELECT b.id, b.code, b.name, b.city,
                (SELECT COUNT(*) FROM children c WHERE c.branch_id = b.id AND c.deleted_at IS NULL) AS children,
                (SELECT COUNT(*) FROM staff s WHERE s.branch_id = b.id AND s.deleted_at IS NULL) AS staff,
                (SELECT COUNT(*) FROM classes cl WHERE cl.branch_id = b.id AND cl.deleted_at IS NULL) AS classes
           FROM branches b WHERE b.deleted_at IS NULL ORDER BY b.name`
      ),
      query<{ masuk: string; keluar: string }>(
        `SELECT COALESCE(SUM(amount) FILTER (WHERE direction='masuk'),0) AS masuk,
                COALESCE(SUM(amount) FILTER (WHERE direction='keluar'),0) AS keluar
           FROM cash_book_entries`
      ),
      query(
        `SELECT m.id, m.subject, m.body, m.sent_at, m.is_read, c.full_name AS child_name, u.full_name AS sender_name
           FROM parent_messages m JOIN children c ON c.id = m.child_id JOIN users u ON u.id = m.sender_user_id
          ORDER BY m.sent_at DESC LIMIT 50`
      ),
      query("SELECT * FROM announcements ORDER BY is_pinned DESC, created_at DESC LIMIT 20"),
      query("SELECT id, full_name, email, phone, role, is_active, created_at FROM users WHERE deleted_at IS NULL ORDER BY full_name LIMIT 100"),
      query(
        `SELECT r.id, r.code, r.name, (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count,
                (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
           FROM roles r ORDER BY r.name`
      ),
      query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20"),
      query("SELECT id, theme, start_date, end_date FROM learning_cycles ORDER BY created_at DESC LIMIT 20"),
      query<{ hadir: string; total: string }>(
        `SELECT COUNT(*) FILTER (WHERE status = 'hadir') AS hadir, COUNT(*) AS total
           FROM child_attendance WHERE att_date = CURRENT_DATE`
      ),
    ]);
    return NextResponse.json({
      ok: true,
      leads, registrations, branchesAgg, messages, announcements, users, rolesAgg, audit, cycles,
      cashIn: Number(cashAgg[0].masuk),
      cashOut: Number(cashAgg[0].keluar),
      attendanceToday: { hadir: Number(attendanceAgg[0].hadir), total: Number(attendanceAgg[0].total) },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
