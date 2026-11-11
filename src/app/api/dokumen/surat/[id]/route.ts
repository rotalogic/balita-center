import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { guard } from "@/lib/current-user";
import { getIdentitas, kopTigaBaris } from "@/lib/sekolah";

export const dynamic = "force-dynamic";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Dokumen cetak surat resmi berkop tiga baris — unduh/cetak dari peramban.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  const rows = await query<Record<string, string | null>>("SELECT * FROM surat WHERE id = $1", [params.id]);
  if (rows.length === 0) return NextResponse.json({ ok: false, error: "Surat tidak ditemukan." }, { status: 404 });
  const s = rows[0];
  const sekolah = await getIdentitas();
  const kop = kopTigaBaris(sekolah);
  const isiHtml = esc(String(s.isi || "")).replace(/\n/g, "<br />");
  const tanggal = s.diterbitkan_at
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(String(s.diterbitkan_at)))
    : "";
  const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8" />
<title>${esc(String(s.perihal || "Surat"))}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  body { font-family: "Times New Roman", serif; color: #1c2420; margin: 0; }
  .kop { text-align: center; border-bottom: 3px double #4F7A54; padding-bottom: 10px; margin-bottom: 18px; }
  .kop .y { font-size: 13px; letter-spacing: .4px; }
  .kop .n { font-size: 19px; font-weight: bold; margin: 2px 0; }
  .kop .t { font-size: 12px; font-style: italic; }
  .meta { font-size: 13.5px; margin-bottom: 4px; }
  .perihal { font-weight: bold; text-decoration: underline; margin: 14px 0 10px; font-size: 15px; }
  .isi { font-size: 14px; line-height: 1.65; text-align: justify; }
  .ttd { margin-top: 42px; font-size: 13.5px; text-align: right; }
  .watermark { color: #b3541e; border: 1px solid #b3541e; padding: 2px 8px; font-size: 11px; display: inline-block; margin-bottom: 8px; }
  @media print { .watermark { display: none; } }
</style></head>
<body>
  ${s.status === "draft" ? '<span class="watermark">DRAF — BELUM BERNOMOR</span>' : ""}
  <div class="kop">
    <div class="y">${esc(kop[0])}</div>
    <div class="n">${esc(kop[1])}</div>
    <div class="t">${esc(kop[2])}</div>
  </div>
  ${s.nomor ? `<div class="meta">Nomor&nbsp;&nbsp;: ${esc(String(s.nomor))}</div>` : ""}
  <div class="meta">Perihal&nbsp;: ${esc(String(s.perihal || ""))}</div>
  ${s.tujuan ? `<div class="meta">Kepada&nbsp;: ${esc(String(s.tujuan))}</div>` : ""}
  <div class="perihal">${esc(String(s.perihal || ""))}</div>
  <div class="isi">${isiHtml}</div>
  <div class="ttd">
    ${tanggal ? `<p>Malang, ${esc(tanggal)}</p>` : ""}
    <p style="margin-top:56px;">( ______________________ )</p>
  </div>
</body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
