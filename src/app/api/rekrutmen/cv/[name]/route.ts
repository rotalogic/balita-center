import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { guard } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const DIR = process.env.UPLOAD_DIR || "/app/uploads";
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Unduh CV pelamar — hanya staf yang masuk. Nama berkas dipatok pola ketat
// cv-<uuid>.<ext> (cegah path traversal).
export async function GET(_request: Request, { params }: { params: { name: string } }) {
  const denied = await guard("dashboard.view");
  if (denied.error) return denied.error;
  const name = path.basename(params.name);
  if (!/^cv-[a-f0-9-]{36}\.(pdf|doc|docx)$/i.test(name)) {
    return new NextResponse("Berkas tidak ditemukan.", { status: 404 });
  }
  try {
    const buffer = await readFile(path.join(DIR, name));
    const ext = name.split(".").pop()?.toLowerCase() || "pdf";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch {
    return new NextResponse("Berkas tidak ditemukan.", { status: 404 });
  }
}
