import { NextResponse } from "next/server";
import { currentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Belum masuk." }, { status: 401 });
  return NextResponse.json({ ok: true, user });
}
