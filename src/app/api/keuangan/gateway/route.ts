import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { catatAudit } from "@/lib/audit";
import { segarkanGateway, gatewayMasker, ujiServerKey } from "@/lib/gateway";

export const dynamic = "force-dynamic";

// Setelan payment gateway Midtrans dari halaman Keuangan.
// Kunci hanya tersimpan di payment_settings; GET tidak pernah mengembalikan
// nilai kunci — hanya status dan samaran 4 karakter terakhir.

export async function GET() {
  const denied = await guard("finance.manage");
  if (denied.error) return denied.error;
  const k = await segarkanGateway(true);
  return NextResponse.json({
    ok: true,
    tersimpan: Boolean(k.server_key),
    server_mask: gatewayMasker(k.server_key),
    client_key: k.client_key,
    sandbox: k.sandbox,
    aktif: k.aktif,
    siap: Boolean(k.aktif && k.server_key && k.client_key),
  });
}

type Body = {
  aksi?: "simpan" | "uji";
  server_key?: string;
  client_key?: string;
  sandbox?: boolean;
  aktif?: boolean;
};

export async function POST(request: Request) {
  const denied = await guard("finance.manage");
  if (denied.error) return denied.error;
  try {
    const body = (await request.json()) as Body;
    const k = await segarkanGateway(true);
    const serverAktif = (body.server_key || "").trim() || k.server_key || "";
    const sandbox = body.sandbox !== undefined ? Boolean(body.sandbox) : k.sandbox;

    if (body.aksi === "uji") {
      if (!serverAktif) return NextResponse.json({ ok: false, error: "Belum ada Server Key untuk diuji." }, { status: 400 });
      const hasil = await ujiServerKey(serverAktif, sandbox);
      return NextResponse.json({ ok: hasil.ok, pesan: hasil.pesan }, { status: hasil.ok ? 200 : 400 });
    }

    // aksi simpan
    const serverBaru = (body.server_key || "").trim();
    if (serverBaru && serverBaru.length < 10) {
      return NextResponse.json({ ok: false, error: "Server Key terlalu pendek — periksa kembali salinannya." }, { status: 400 });
    }
    const clientBaru = (body.client_key || "").trim();
    const aktif = body.aktif !== undefined ? Boolean(body.aktif) : k.aktif;
    if (aktif && !(serverBaru || k.server_key) ) {
      return NextResponse.json({ ok: false, error: "Server Key wajib diisi sebelum gateway diaktifkan." }, { status: 400 });
    }
    if (aktif && !(clientBaru || k.client_key)) {
      return NextResponse.json({ ok: false, error: "Client Key wajib diisi sebelum gateway diaktifkan." }, { status: 400 });
    }
    await query(
      `INSERT INTO payment_settings (id, provider, server_key, client_key, sandbox, aktif, updated_at)
       VALUES (1, 'midtrans', $1, $2, $3, $4, now())
       ON CONFLICT (id) DO UPDATE SET
         server_key = COALESCE(EXCLUDED.server_key, payment_settings.server_key),
         client_key = COALESCE(EXCLUDED.client_key, payment_settings.client_key),
         sandbox = EXCLUDED.sandbox, aktif = EXCLUDED.aktif, updated_at = now()`,
      [serverBaru || null, clientBaru || null, sandbox, aktif]
    );
    await segarkanGateway(true);
    await catatAudit(denied.user, {
      action: "gateway.kunci_diperbarui",
      entityTable: "payment_settings",
      entityId: null,
      detail: { provider: "midtrans", sandbox, aktif, server_key: serverBaru ? "diganti" : "tetap" },
    });
    return NextResponse.json({ ok: true, pesan: "Setelan gateway tersimpan." });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error)?.message }, { status: 500 });
  }
}
