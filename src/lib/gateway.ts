import crypto from "node:crypto";
import { query } from "./db";

// Payment gateway Midtrans (Snap). Kunci diisi admin dari halaman Keuangan
// dan tersimpan di payment_settings — pola yang sama dengan kunci LLM Ailsa:
// tidak lewat env, tidak lewat chat, tampil hanya tersamar.
// Tanpa kunci atau tanpa diaktifkan, pembayaran tetap manual seperti biasa.

type Konfig = { server_key: string | null; client_key: string | null; sandbox: boolean; aktif: boolean };

let cache: { data: Konfig; at: number } | null = null;

export async function segarkanGateway(paksa = false): Promise<Konfig> {
  if (!paksa && cache && Date.now() - cache.at < 15000) return cache.data;
  let data: Konfig = { server_key: null, client_key: null, sandbox: true, aktif: false };
  try {
    const rows = await query<Konfig>("SELECT server_key, client_key, sandbox, aktif FROM payment_settings WHERE id = 1");
    if (rows[0]) data = rows[0];
  } catch {
    /* database belum bermigrasi — gateway dianggap belum diatur */
  }
  cache = { data, at: Date.now() };
  return data;
}

export async function gatewaySiap(): Promise<boolean> {
  const k = await segarkanGateway();
  return Boolean(k.aktif && k.server_key && k.client_key);
}

export function gatewayMasker(kunci: string | null): string | null {
  if (!kunci) return null;
  return `••••${kunci.slice(-4)}`;
}

const hostSnap = (sandbox: boolean) => (sandbox ? "https://app.sandbox.midtrans.com" : "https://app.midtrans.com");
const hostApi = (sandbox: boolean) => (sandbox ? "https://api.sandbox.midtrans.com" : "https://api.midtrans.com");

// Buat token Snap untuk satu tagihan. order_id = nomor tagihan resmi.
export async function buatTokenSnap(opts: {
  orderId: string;
  jumlah: number;
  namaWali: string;
  emailWali: string;
  keterangan: string;
}): Promise<{ ok: boolean; token?: string; pesan?: string }> {
  const k = await segarkanGateway();
  if (!k.server_key) return { ok: false, pesan: "Server Key Midtrans belum diisi." };
  const auth = Buffer.from(`${k.server_key}:`).toString("base64");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${hostSnap(k.sandbox)}/snap/v1/transactions`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        transaction_details: { order_id: opts.orderId, gross_amount: Math.round(opts.jumlah) },
        customer_details: { first_name: opts.namaWali, email: opts.emailWali },
        item_details: [{ id: opts.orderId, price: Math.round(opts.jumlah), quantity: 1, name: opts.keterangan.slice(0, 50) }],
      }),
      signal: ctrl.signal,
    });
    const j = (await res.json().catch(() => ({}))) as { token?: string; error_messages?: string[] };
    if (!res.ok || !j.token) {
      return { ok: false, pesan: j.error_messages?.join("; ") || `Midtrans menolak (HTTP ${res.status}).` };
    }
    return { ok: true, token: j.token };
  } catch (error) {
    const putus = (error as Error)?.name === "AbortError";
    return { ok: false, pesan: putus ? "Koneksi ke Midtrans kehabisan waktu (20 detik)." : "Tidak dapat menghubungi Midtrans." };
  } finally {
    clearTimeout(timer);
  }
}

// Uji Server Key: menanyakan status order yang pasti tidak ada.
// 404 = kunci diterima (order memang tidak ada); 401 = kunci salah.
export async function ujiServerKey(serverKey: string, sandbox: boolean): Promise<{ ok: boolean; pesan: string }> {
  const auth = Buffer.from(`${serverKey}:`).toString("base64");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${hostApi(sandbox)}/v2/order-uji-balita/status`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (res.status === 404) return { ok: true, pesan: "Server Key diterima Midtrans (uji ke mode " + (sandbox ? "sandbox" : "produksi") + ")." };
    if (res.status === 401) return { ok: false, pesan: "Server Key ditolak Midtrans (401) — periksa kembali kuncinya dan mode sandbox/produksinya." };
    return { ok: false, pesan: `Midtrans menjawab HTTP ${res.status}.` };
  } catch (error) {
    const putus = (error as Error)?.name === "AbortError";
    return { ok: false, pesan: putus ? "Koneksi kehabisan waktu (15 detik)." : "Tidak dapat menghubungi Midtrans." };
  } finally {
    clearTimeout(timer);
  }
}

// Verifikasi tanda tangan notifikasi Midtrans:
// sha512(order_id + status_code + gross_amount + server_key)
export async function verifikasiNotifikasi(body: {
  order_id?: string; status_code?: string; gross_amount?: string; signature_key?: string;
}): Promise<boolean> {
  const k = await segarkanGateway(true);
  if (!k.server_key || !body.order_id || !body.status_code || !body.gross_amount || !body.signature_key) return false;
  const hitung = crypto
    .createHash("sha512")
    .update(`${body.order_id}${body.status_code}${body.gross_amount}${k.server_key}`)
    .digest("hex");
  return hitung === body.signature_key;
}

// Tandai tagihan lunas dari pembayaran gateway — langkah yang sama dengan
// konfirmasi manual staf: Buku Kas, baris pembayaran, status, kwitansi.
// Idempotent: tagihan yang sudah lunas tidak diproses ulang.
export async function lunasiDariGateway(invoiceId: string, metode: string): Promise<{ ok: boolean; sudah?: boolean }> {
  const inv = await query<{ branch_id: string; amount: string; status: string }>(
    "SELECT branch_id, amount, status FROM invoices WHERE id = $1::uuid",
    [invoiceId]
  );
  if (!inv[0]) return { ok: false };
  if (inv[0].status === "lunas") return { ok: true, sudah: true };
  const amount = Number(inv[0].amount);
  const cash = await query<{ id: string }>(
    `INSERT INTO cash_book_entries (branch_id, entry_date, direction, category, description, amount, source_type, source_id, created_by)
     VALUES ($1, CURRENT_DATE, 'masuk', 'SPP', 'Pembayaran SPP via gateway Midtrans', $2, 'tagihan', $3, NULL) RETURNING id`,
    [inv[0].branch_id, amount, invoiceId]
  );
  await query(
    `INSERT INTO payments (branch_id, invoice_id, method, amount, status, paid_at, confirmed_by, cash_entry_id)
     VALUES ($1, $2, $3, $4, 'terkonfirmasi', CURRENT_TIMESTAMP, NULL, $5)`,
    [inv[0].branch_id, invoiceId, metode.slice(0, 24) || "gateway", amount, cash[0].id]
  );
  await query("UPDATE invoices SET status = 'lunas' WHERE id = $1::uuid", [invoiceId]);
  await query(
    `INSERT INTO receipts (invoice_id, branch_id, amount, method, received_by, paid_at)
     SELECT $1::uuid, $2::uuid, $3::numeric, $4, NULL, CURRENT_DATE
      WHERE NOT EXISTS (SELECT 1 FROM receipts WHERE invoice_id = $1::uuid)`,
    [invoiceId, inv[0].branch_id, amount, metode.slice(0, 24) || "gateway"]
  ).catch(() => null);
  return { ok: true };
}
