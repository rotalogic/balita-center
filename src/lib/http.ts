// Satu pembungkus fetch untuk semua form: selalu ada batas waktu, selalu
// mengembalikan { ok, data } — tidak ada lagi tombol macet di "Menyimpan…".
export async function kirimJson(
  url: string,
  method: "POST" | "PATCH" | "DELETE" | "PUT",
  body?: unknown,
  timeoutMs = 20000
): Promise<{ status: number; ok: boolean; data: Record<string, unknown> }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, ok: res.ok && data.ok !== false, data };
  } catch (error) {
    const putus = (error as Error)?.name === "AbortError";
    return {
      status: 0,
      ok: false,
      data: {
        error: putus
          ? `Server tidak menjawab dalam ${Math.round(timeoutMs / 1000)} detik. Data belum tersimpan — coba lagi.`
          : "Koneksi terputus. Data belum tersimpan — coba lagi.",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
