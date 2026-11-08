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

export type LampiranEmail = { filename: string; content: Buffer; contentType?: string };

export async function kirimEmail(opts: { to: string; subject: string; text: string; html?: string; attachments?: LampiranEmail[] }) {
  const t = siap();
  if (!t) {
    console.log(`[EMAIL:DRY] ke ${opts.to} | ${opts.subject} | ${opts.text.slice(0, 200)}`);
    return { ok: false, alasan: "belum_dikonfigurasi" as const };
  }
  try {
    const info = await t.sendMail({
      from: FROM, to: opts.to, subject: opts.subject, text: opts.text, html: opts.html,
      attachments: opts.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType || "application/pdf" })),
    });
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

export type InfoTagihanEmail = {
  wali: string;
  anak: string;
  nomor: string | null;
  keterangan: string;
  jumlah: string; // sudah terformat, mis. "Rp 850.000"
  jatuhTempo: string; // sudah terformat, mis. "10 Desember 2026"
  cabang: string;
  tautan: string; // halaman pembayaran Balita Connect
};

export function emailTagihan(to: string, d: InfoTagihanEmail, pdf?: Buffer) {
  return kirimEmail({
    to,
    subject: `Tagihan SPP ${d.anak} — ${d.keterangan}`,
    text: `Halo ${d.wali},\n\nTagihan SPP untuk ${d.anak} sudah terbit.\n\nNomor tagihan: ${d.nomor || "-"}\nKeterangan: ${d.keterangan}\nJumlah: ${d.jumlah}\nJatuh tempo: ${d.jatuhTempo}\nCabang: ${d.cabang}\n\nPembayaran dapat dilakukan via transfer ke Virtual Account sekolah atau tunai/QRIS di administrasi cabang. Rincian lengkap dan status pembayaran dapat diperiksa di Balita Connect:\n${d.tautan}\n\nTagihan resmi terlampir sebagai PDF pada email ini.\n\n— Balita Center`,
    html: `<p>Halo ${d.wali},</p><p>Tagihan SPP untuk <strong>${d.anak}</strong> sudah terbit.</p><table cellpadding="4" cellspacing="0"><tr><td>Nomor tagihan</td><td><strong>${d.nomor || "-"}</strong></td></tr><tr><td>Keterangan</td><td>${d.keterangan}</td></tr><tr><td>Jumlah</td><td><strong>${d.jumlah}</strong></td></tr><tr><td>Jatuh tempo</td><td>${d.jatuhTempo}</td></tr><tr><td>Cabang</td><td>${d.cabang}</td></tr></table><p>Pembayaran via transfer ke Virtual Account sekolah atau tunai/QRIS di administrasi cabang. Rincian dan status dapat diperiksa di <a href="${d.tautan}">Balita Connect</a>. Tagihan resmi terlampir sebagai PDF.</p><p>— Balita Center</p>`,
    attachments: pdf ? [{ filename: `Tagihan-${d.nomor ? d.nomor.replace(/\//g, "-") : "SPP"}.pdf`, content: pdf }] : undefined,
  });
}

export function emailPengingatTagihan(to: string, d: InfoTagihanEmail, jenis: "h3" | "h1", pdf?: Buffer) {
  const judul = jenis === "h3" ? "Pengingat: SPP jatuh tempo 3 hari lagi" : "Pengingat: SPP melewati jatuh tempo";
  const kalimat = jenis === "h3"
    ? `Tagihan SPP untuk ${d.anak} akan jatuh tempo pada ${d.jatuhTempo}.`
    : `Tagihan SPP untuk ${d.anak} telah melewati jatuh tempo (${d.jatuhTempo}) dan belum tercatat lunas.`;
  return kirimEmail({
    to,
    subject: `${judul} — ${d.anak}`,
    text: `Halo ${d.wali},\n\n${kalimat}\n\nNomor tagihan: ${d.nomor || "-"}\nKeterangan: ${d.keterangan}\nJumlah: ${d.jumlah}\nCabang: ${d.cabang}\n\nPeriksa rincian dan status pembayaran di Balita Connect:\n${d.tautan}\n\nBila pembayaran sudah dilakukan, abaikan pengingat ini — pengingat berhenti sendiri begitu pembayaran tercatat.\n\n— Balita Center`,
    html: `<p>Halo ${d.wali},</p><p>${kalimat}</p><table cellpadding="4" cellspacing="0"><tr><td>Nomor tagihan</td><td><strong>${d.nomor || "-"}</strong></td></tr><tr><td>Keterangan</td><td>${d.keterangan}</td></tr><tr><td>Jumlah</td><td><strong>${d.jumlah}</strong></td></tr><tr><td>Cabang</td><td>${d.cabang}</td></tr></table><p>Periksa rincian dan status di <a href="${d.tautan}">Balita Connect</a>. Bila sudah membayar, abaikan pengingat ini.</p><p>— Balita Center</p>`,
    attachments: pdf ? [{ filename: `Tagihan-${d.nomor ? d.nomor.replace(/\//g, "-") : "SPP"}.pdf`, content: pdf }] : undefined,
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
