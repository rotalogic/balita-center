import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentUser } from "@/lib/current-user";
import { gatewaySiap, segarkanGateway, buatTokenSnap } from "@/lib/gateway";

export const dynamic = "force-dynamic";

// Orang tua meminta token pembayaran Snap untuk tagihannya sendiri.
// Kepemilikan ditegakkan di server: email akun harus tercatat sebagai wali
// dari anak pada tagihan itu (pola yang sama dengan halaman kwitansi).

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Belum masuk." }, { status: 401 });
  try {
    const body = (await request.json()) as { invoice_id?: string };
    if (!body.invoice_id) return NextResponse.json({ ok: false, error: "Tagihan wajib dipilih." }, { status: 400 });

    const inv = await query<{
      id: string; invoice_number: string | null; amount: string; status: string;
      description: string | null; child_name: string; child_id: string;
    }>(
      `SELECT i.id, i.invoice_number, i.amount, i.status, i.description,
              c.full_name AS child_name, c.id AS child_id
         FROM invoices i JOIN children c ON c.id = i.child_id
        WHERE i.id = $1::uuid`,
      [body.invoice_id]
    );
    if (!inv[0]) return NextResponse.json({ ok: false, error: "Tagihan tidak ditemukan." }, { status: 404 });
    if (inv[0].status === "lunas") return NextResponse.json({ ok: false, error: "Tagihan ini sudah lunas." }, { status: 409 });
    if (inv[0].status === "batal") return NextResponse.json({ ok: false, error: "Tagihan ini sudah dibatalkan." }, { status: 409 });

    const wali = await query<{ full_name: string }>(
      `SELECT g.full_name FROM child_guardians cg JOIN guardians g ON g.id = cg.guardian_id
        WHERE cg.child_id = $1::uuid AND lower(g.email) = lower($2) LIMIT 1`,
      [inv[0].child_id, user.email]
    );
    if (!wali[0]) return NextResponse.json({ ok: false, error: "Anda tidak berhak membayar tagihan ini." }, { status: 403 });

    if (!(await gatewaySiap())) {
      return NextResponse.json({ ok: false, error: "Pembayaran online belum diaktifkan sekolah. Silakan bayar via transfer dan konfirmasi ke administrasi." }, { status: 409 });
    }
    const k = await segarkanGateway();
    const hasil = await buatTokenSnap({
      orderId: inv[0].invoice_number || `INV-${inv[0].id.slice(0, 8)}`,
      jumlah: Number(inv[0].amount),
      namaWali: wali[0].full_name,
      emailWali: user.email,
      keterangan: inv[0].description || `SPP ${inv[0].child_name}`,
    });
    if (!hasil.ok || !hasil.token) {
      return NextResponse.json({ ok: false, error: hasil.pesan || "Gagal membuat sesi pembayaran." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, token: hasil.token, client_key: k.client_key, sandbox: k.sandbox });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message }, { status: 500 });
  }
}
