import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifikasiNotifikasi, lunasiDariGateway } from "@/lib/gateway";

export const dynamic = "force-dynamic";

// Notifikasi Midtrans (webhook). Diautentikasi oleh signature_key yang
// diverifikasi terhadap Server Key sekolah — bukan oleh sesi pengguna,
// jadi rute ini dikecualikan dari middleware (pola yang sama dengan
// webhook WhatsApp). Balasan selalu 200 untuk notifikasi yang sah
// tandatangannya, agar Midtrans tidak mengulang tanpa perlu.

type Notif = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Notif;
    const sah = await verifikasiNotifikasi(body);
    if (!sah) {
      return NextResponse.json({ ok: false, error: "Tanda tangan tidak sah." }, { status: 403 });
    }

    const lunas =
      body.transaction_status === "settlement" ||
      (body.transaction_status === "capture" && (body.fraud_status === "accept" || !body.fraud_status));
    if (!lunas) {
      return NextResponse.json({ ok: true, diterima: true, diproses: false, status: body.transaction_status || null });
    }

    // Order penuh memakai nomor tagihan; order sebagian (cicilan) memakai
    // nomor tagihan + akhiran "-P-<penanda>".
    const nomorTagihan = String(body.order_id || "").split("-P-")[0];
    const inv = await query<{ id: string; amount: string }>(
      "SELECT id, amount FROM invoices WHERE invoice_number = $1",
      [nomorTagihan]
    );
    if (!inv[0]) {
      return NextResponse.json({ ok: true, diterima: true, diproses: false, alasan: "tagihan tidak ditemukan" });
    }
    const gross = Math.round(Number(body.gross_amount));
    const paidRows = await query<{ total: string }>(
      "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE invoice_id = $1 AND status = 'terkonfirmasi'",
      [inv[0].id]
    );
    const sisa = Math.round(Number(inv[0].amount)) - Number(paidRows[0].total);
    // Jumlah harus positif dan tidak melebihi sisa tagihan.
    if (!(gross > 0) || gross > sisa) {
      return NextResponse.json({ ok: true, diterima: true, diproses: false, alasan: "jumlah melebihi sisa tagihan" });
    }
    const hasil = await lunasiDariGateway(inv[0].id, body.payment_type || "gateway", gross, body.order_id);
    return NextResponse.json({ ok: true, diterima: true, diproses: hasil.ok, sudah_lunas: Boolean(hasil.sudah), lunas: Boolean(hasil.lunas), sisa: hasil.sisa ?? null });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message }, { status: 500 });
  }
}
