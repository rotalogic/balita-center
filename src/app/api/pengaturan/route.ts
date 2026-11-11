import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { getIdentitas } from "@/lib/sekolah";
import { smtpConfigured } from "@/lib/mail";
import { storageMode } from "@/lib/storage";
import { segarkanGateway } from "@/lib/gateway";
import { llmSumber } from "@/lib/ailsa/llm";

export const dynamic = "force-dynamic";

// Identitas sekolah + status konfigurasi server untuk halaman Pengaturan.
// Status hanya berisi boolean dan label tersamar — tidak pernah nilai kunci.

export async function GET() {
  const denied = await guard("settings.manage");
  if (denied.error) return denied.error;
  const identitas = await getIdentitas(true);
  const gw = await segarkanGateway(true);
  const llm = llmSumber();
  const llmConfigured = llm.utama || llm.cadangan || llm.aplikasi;
  let dbOk = false;
  try {
    await query("SELECT 1");
    dbOk = true;
  } catch { /* tampil apa adanya */ }
  return NextResponse.json({
    ok: true,
    identitas,
    status: [
      { kunci: "database", label: "Database PostgreSQL", ok: dbOk, keterangan: dbOk ? "Terhubung" : "Tidak terhubung" },
      { kunci: "smtp", label: "Email (SMTP)", ok: smtpConfigured(), keterangan: smtpConfigured() ? "Terisi — tagihan, pengingat, dan pemberitahuan terbit terkirim" : "Belum diisi di env server — email tercatat menunggu kanal" },
      { kunci: "job_token", label: "Token Job Terjadwal", ok: Boolean(process.env.JOB_TOKEN), keterangan: process.env.JOB_TOKEN ? "Terisi — cron tagihan dapat berjalan" : "Belum diisi — job tagihan terjadwal ditolak" },
      { kunci: "app_url", label: "Alamat Aplikasi (APP_BASE_URL)", ok: Boolean(process.env.APP_BASE_URL), keterangan: process.env.APP_BASE_URL || "Belum diisi — tautan di email memakai nilai bawaan" },
      { kunci: "deepseek", label: "Kunci AI Ailsa (DeepSeek)", ok: llmConfigured, keterangan: llm.aplikasi ? "Terisi dari halaman Ailsa" : llmConfigured ? "Terisi dari env server" : "Belum diisi — isi dari kartu Kunci LLM di halaman Ailsa" },
      { kunci: "gateway", label: "Payment Gateway (Midtrans)", ok: Boolean(gw.aktif && gw.server_key && gw.client_key), keterangan: gw.aktif ? (gw.sandbox ? "Aktif — mode Sandbox" : "Aktif — mode Produksi") : gw.server_key ? "Kunci tersimpan, belum diaktifkan (halaman Keuangan)" : "Belum diatur — atur di halaman Keuangan" },
      { kunci: "storage", label: "Penyimpanan Foto/Video", ok: true, keterangan: storageMode() === "s3" ? "Object storage (S3/R2)" : "Disk lokal server" },
      { kunci: "whatsapp", label: "Kanal WhatsApp Ailsa", ok: false, keterangan: "Nonaktif atas keputusan pemilik — pemberitahuan berjalan lewat email" },
    ],
  });
}

type Body = {
  nama?: string;
  tagline?: string;
  alamat?: string;
  telepon?: string;
  email?: string;
  nama_yayasan?: string;
  nama_gabungan?: string;
  tagline_gabungan?: string;
  visi?: string;
  misi?: string;
  motto?: string;
  warna_zkc?: string;
  warna_sam?: string;
};

const warnaSah = (v: string | undefined, bawaan: string) =>
  v && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : bawaan;

export async function POST(request: Request) {
  const denied = await guard("settings.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Body;
    const nama = (body.nama || "").trim();
    if (nama.length < 3) {
      return NextResponse.json({ ok: false, error: "Nama sekolah minimal 3 karakter." }, { status: 400 });
    }
    const email = (body.email || "").trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Format email sekolah tidak benar." }, { status: 400 });
    }
    await query(
      `INSERT INTO school_settings (id, nama, tagline, alamat, telepon, email,
          nama_yayasan, nama_gabungan, tagline_gabungan, visi, misi, motto, warna_zkc, warna_sam, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
       ON CONFLICT (id) DO UPDATE SET nama = EXCLUDED.nama, tagline = EXCLUDED.tagline,
         alamat = EXCLUDED.alamat, telepon = EXCLUDED.telepon, email = EXCLUDED.email,
         nama_yayasan = EXCLUDED.nama_yayasan, nama_gabungan = EXCLUDED.nama_gabungan,
         tagline_gabungan = EXCLUDED.tagline_gabungan, visi = EXCLUDED.visi, misi = EXCLUDED.misi,
         motto = EXCLUDED.motto, warna_zkc = EXCLUDED.warna_zkc, warna_sam = EXCLUDED.warna_sam,
         updated_at = now()`,
      [nama, (body.tagline || "").trim() || "Montessori & Childcare", (body.alamat || "").trim() || null,
       (body.telepon || "").trim() || null, email || null,
       (body.nama_yayasan || "").trim() || "Yayasan Tunas Pelita Cakrawala Insani",
       (body.nama_gabungan || "").trim() || "Ziel Kids Club & Sekolah Alam Montessori",
       (body.tagline_gabungan || "").trim() || "Understanding Children. Strengthening Families. Learning Naturally. Growing Meaningfully.",
       (body.visi || "").trim() || null, (body.misi || "").trim() || null, (body.motto || "").trim() || null,
       warnaSah(body.warna_zkc, "#8A6844"), warnaSah(body.warna_sam, "#4F7A54")]
    );
    await getIdentitas(true);
    await catatAudit(denied.user, {
      action: "pengaturan.identitas", entityTable: "school_settings", entityId: null, detail: { nama },
    });
    return NextResponse.json({ ok: true, pesan: "Identitas sekolah tersimpan." });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message }, { status: 500 });
  }
}
