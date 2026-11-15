import { NextResponse } from "next/server";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

// Penanda metode masuk yang aktif, dibaca halaman Masuk dan Daftar supaya
// tombol Google tampil jujur: aktif hanya bila server sudah dikonfigurasi.
export async function GET() {
  return NextResponse.json({ ok: true, google: googleConfigured() });
}
