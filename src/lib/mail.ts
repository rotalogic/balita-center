import nodemailer from "nodemailer";

// Pengiriman email lewat SMTP. Bila env belum diisi, semua fungsi mengembalikan
// { ok:false, alasan:"belum_dikonfigurasi" } dan pemanggil tetap mencatat tautan
// di log — tidak ada kegagalan senyap, tidak ada kredensial di kode.
const HOST = process.env.SMTP_HOST || "";
const PORT = Number(process.env.SMTP_PORT || 587);
const USER = process.env.SMTP_USER || "";
const PASS = process.env.SMTP_PASS || "";
const FROM = process.env.SMTP_FROM || USER || "no-reply@rotalogic.id";
const SECURE = process.env.SMTP_SECURE === "true" || PORT === 465;

export function smtpConfigured(): boolean {
  return Boolean(HOST && USER && PASS);
}

export function smtpStatus() {
  return [
    { name: "SMTP_HOST", filled: Boolean(HOST) },
    { name: "SMTP_PORT", filled: Boolean(process.env.SMTP_PORT) },
    { name: "SMTP_USER", filled: Boolean(USER) },
    { name: "SMTP_PASS", filled: Boolean(PASS) },
    { name: "SMTP_FROM", filled: Boolean(process.env.SMTP_FROM) },
  ];
}

let transporter: nodemailer.Transporter | null = null;
function siap() {
  if (!smtpConfigured()) return null;
  transporter ||= nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: SECURE,
    auth: { user: USER, pass: PASS },
  });
  return transporter;
}

export async function kirimEmail(opts: { to: string; subject: string; text: string; html?: string }) {
  const t = siap();
  if (!t) {
    console.log(`[EMAIL:DRY] ke ${opts.to} | ${opts.subject} | ${opts.text.slice(0, 200)}`);
    return { ok: false, alasan: "belum_dikonfigurasi" as const };
  }
  try {
    const info = await t.sendMail({ from: FROM, to: opts.to, subject: opts.subject, text: opts.text, html: opts.html });
    return { ok: true, id: info.messageId };
  } catch (error) {
    const pesan = (error as Error)?.message || "gagal_kirim";
    console.error("[EMAIL:ERROR]", pesan);
    return { ok: false, alasan: pesan };
  }
}

export function emailResetSandi(to: string, nama: string, url: string) {
  return kirimEmail({
    to,
    subject: "Atur ulang kata sandi Balita Center",
    text: `Halo ${nama},\n\nBuka tautan ini untuk membuat kata sandi baru (berlaku 60 menit, sekali pakai):\n${url}\n\nBila Anda tidak meminta ini, abaikan email ini.`,
    html: `<p>Halo ${nama},</p><p>Buka tautan ini untuk membuat kata sandi baru. Berlaku <strong>60 menit</strong> dan hanya bisa dipakai sekali:</p><p><a href="${url}">${url}</a></p><p>Bila Anda tidak meminta ini, abaikan email ini.</p>`,
  });
}

export function emailUndangan(to: string, nama: string, url: string, peran: string) {
  return kirimEmail({
    to,
    subject: "Undangan akun Balita Center",
    text: `Halo ${nama},\n\nAnda diundang ke Balita Center sebagai ${peran}. Buka tautan ini untuk membuat kata sandi (berlaku 3 hari):\n${url}`,
    html: `<p>Halo ${nama},</p><p>Anda diundang ke <strong>Balita Center</strong> sebagai <strong>${peran}</strong>.</p><p>Buka tautan ini untuk membuat kata sandi (berlaku 3 hari):</p><p><a href="${url}">${url}</a></p>`,
  });
}
