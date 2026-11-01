import { NextResponse } from "next/server";
import { dbErrorMessage, query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Daftar tabel yang boleh dihitung jumlah barisnya lewat API ini.
// Nama tabel tidak pernah diambil mentah dari query string ke SQL.
const ALLOWED = new Set([
  "programs", "classes", "learning_cycles", "stppa_assessments",
  "leads", "bot_conversations", "registrations", "lead_followups",
  "cash_book_entries", "invoices", "payments", "payroll_runs",
  "staff", "leave_requests", "staff_attendance", "candidates",
  "branches", "branch_capital", "children",
  "daily_reports", "cycle_reports", "child_attendance", "audit_logs",
  "parent_messages", "announcements", "parent_reviews", "notifications",
  "users", "roles", "permissions",
]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requested = (searchParams.get("tables") || "")
      .split(",")
      .map((t) => t.trim())
      .filter((t) => ALLOWED.has(t));
    if (requested.length === 0) {
      return NextResponse.json({ ok: false, error: "Tidak ada tabel valid yang diminta." }, { status: 400 });
    }
    const counts: Record<string, number> = {};
    for (const table of requested) {
      const rows = await query<{ n: string }>(`SELECT COUNT(*) AS n FROM ${table}`);
      counts[table] = Number(rows[0].n);
    }
    return NextResponse.json({ ok: true, counts });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbErrorMessage(error) }, { status: 503 });
  }
}
