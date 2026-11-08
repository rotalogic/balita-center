import { deflateRawSync } from "zlib";

// XLSX minimal tanpa dependensi: satu sheet, semua sel inline string/number.
// ponytail: satu sheet + tanpa style; pakai exceljs kalau perlu multi-sheet/format.
function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function zip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const lokal: Buffer[] = [];
  const pusat: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const nama = Buffer.from(f.name, "utf8");
    const padat = deflateRawSync(f.data);
    const crc = crc32(f.data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(0, 10);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(padat.length, 18);
    lh.writeUInt32LE(f.data.length, 22);
    lh.writeUInt16LE(nama.length, 26);
    lh.writeUInt16LE(0, 28);
    lokal.push(lh, nama, padat);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(0, 12);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(padat.length, 20);
    ch.writeUInt32LE(f.data.length, 24);
    ch.writeUInt16LE(nama.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    pusat.push(ch, nama);

    offset += lh.length + nama.length + padat.length;
  }
  const akhir = Buffer.alloc(22);
  akhir.writeUInt32LE(0x06054b50, 0);
  akhir.writeUInt16LE(0, 4);
  akhir.writeUInt16LE(0, 6);
  akhir.writeUInt16LE(files.length, 8);
  akhir.writeUInt16LE(files.length, 10);
  const ukuranPusat = pusat.reduce((n, b) => n + b.length, 0);
  akhir.writeUInt32LE(ukuranPusat, 12);
  akhir.writeUInt32LE(offset, 16);
  akhir.writeUInt16LE(0, 20);
  return Buffer.concat([...lokal, ...pusat, akhir]);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function kolom(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function buatXlsx(header: string[], baris: Array<Array<string | number>>, namaSheet = "Laporan"): Buffer {
  const sel = (v: string | number, ref: string) =>
    typeof v === "number"
      ? `<c r="${ref}"><v>${v}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t>${esc(String(v ?? ""))}</t></is></c>`;

  const semua = [header, ...baris];
  const rows = semua
    .map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => sel(v, `${kolom(ci)}${ri + 1}`)).join("")}</row>`)
    .join("");

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${esc(namaSheet).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

  return zip([
    { name: "[Content_Types].xml", data: Buffer.from(types) },
    { name: "_rels/.rels", data: Buffer.from(rels) },
    { name: "xl/workbook.xml", data: Buffer.from(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(wbRels) },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheet) },
  ]);
}

// CSV dengan pemisah titik koma (Excel Indonesia) + BOM agar UTF-8 terbaca benar.
export function buatCsv(header: string[], baris: Array<Array<string | number>>): string {
  const esc1 = (v: string | number) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + [header, ...baris].map((r) => r.map(esc1).join(";")).join("\r\n") + "\r\n";
}
