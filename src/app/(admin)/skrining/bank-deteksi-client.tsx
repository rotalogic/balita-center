"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Entri = {
  id: string; kategori: string; judul: string; isi: string;
  urutan: number; aktif: boolean;
};

const FLAT = { kategori: "", judul: "", isi: "", urutan: 0, aktif: true };

async function kirim(method: "POST" | "PUT" | "DELETE", url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return (await res.json()) as { ok: boolean; error?: string };
}

// Bank Deteksi & Rujukan (Tahap 2, folder 04 Paket Sistem Terpadu): katalog
// acuan staf untuk deteksi dini dan rujukan — bukan alat diagnosis.
export function BankDeteksiClient() {
  const [rows, setRows] = useState<Entri[] | null>(null);
  const [f, setF] = useState(FLAT);
  const [editId, setEditId] = useState<string | null>(null);
  const [cari, setCari] = useState("");
  const [katAktif, setKatAktif] = useState<string>("Semua");
  const [buka, setBuka] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const muat = useCallback(async () => {
    const res = await fetch("/api/bank-deteksi");
    const d = (await res.json()) as { ok: boolean; entri?: Entri[]; error?: string };
    if (d.ok) setRows(d.entri || []);
    else setError(d.error || "Gagal memuat bank deteksi.");
  }, []);

  useEffect(() => { void muat(); }, [muat]);

  const kategori = useMemo(() => {
    const peta = new Map<string, number>();
    for (const r of rows || []) peta.set(r.kategori, (peta.get(r.kategori) || 0) + 1);
    return [...peta.entries()];
  }, [rows]);

  const tampil = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return (rows || []).filter((r) =>
      (katAktif === "Semua" || r.kategori === katAktif) &&
      (!kata || r.judul.toLowerCase().includes(kata) || r.isi.toLowerCase().includes(kata))
    );
  }, [rows, cari, katAktif]);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const d = editId
      ? await kirim("PUT", "/api/bank-deteksi", { id: editId, ...f })
      : await kirim("POST", "/api/bank-deteksi", f);
    setBusy(false);
    if (!d.ok) { setError(d.error || "Gagal menyimpan."); return; }
    setInfo(editId ? "Entri diperbarui." : "Entri ditambahkan.");
    setF(FLAT); setEditId(null);
    void muat();
  }

  async function hapus(r: Entri) {
    if (!window.confirm(`Hapus entri "${r.judul}"?`)) return;
    const d = await kirim("DELETE", `/api/bank-deteksi?id=${encodeURIComponent(r.id)}`);
    if (!d.ok) { setError(d.error || "Gagal menghapus."); return; }
    setInfo("Entri dihapus.");
    void muat();
  }

  return (
    <div className="stack">
      <header>
        <p className="eyebrow">Ziel Kids Club • Sekolah Alam Montessori</p>
        <h1>Bank Deteksi &amp; Rujukan</h1>
        <p className="muted" style={{ maxWidth: 760 }}>
          Katalog acuan staf dari Paket Sistem Terpadu lembaga: 12 kelompok indikasi beserta ambang rujuknya,
          bank program individual, 100 indikator kesulitan belajar usia sekolah, dampak, pemetaan kekuatan,
          bank tugas skrining risiko disleksia, dan kesimpulan kurasi folder bakat minat. Seluruhnya bahan
          deteksi dini dan rujukan — <strong>bukan alat diagnosis</strong>; diagnosis adalah kewenangan
          psikolog klinis / dokter anak.
        </p>
      </header>

      <nav className="row" aria-label="Kamar Skrining">
        <a className="btn secondary" href="/skrining/daftar">Klien &amp; Pemeriksaan</a>
        <a className="btn secondary" href="/skrining/rujukan">Berkas Rujukan</a>
        <a className="btn" href="/skrining/bank">Bank Deteksi &amp; Rujukan</a>
      </nav>

      {error ? <div className="notice error">{error}</div> : null}
      {info ? <div className="notice">{info}</div> : null}

      <section className="card stack">
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <button type="button" className={katAktif === "Semua" ? "btn small" : "btn small secondary"}
            onClick={() => setKatAktif("Semua")}>Semua ({rows?.length ?? 0})</button>
          {kategori.map(([k, n]) => (
            <button key={k} type="button" className={katAktif === k ? "btn small" : "btn small secondary"}
              onClick={() => setKatAktif(k)}>{k} ({n})</button>
          ))}
        </div>
        <input type="search" aria-label="Cari entri bank deteksi" placeholder="Cari judul atau isi…"
          value={cari} onChange={(e) => setCari(e.target.value)} />
        {rows === null ? <p className="muted">Memuat…</p> : tampil.length === 0 ? (
          <p className="muted">Tidak ada entri yang cocok.</p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {tampil.map((r) => (
              <article key={r.id} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <span className="badge">{r.kategori}</span>{" "}
                    <strong>{r.judul}</strong>
                    {!r.aktif ? <span className="muted"> · nonaktif</span> : null}
                  </div>
                  <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                    <button type="button" className="btn small secondary"
                      onClick={() => setBuka(buka === r.id ? null : r.id)}>{buka === r.id ? "Tutup" : "Baca"}</button>
                    <button type="button" className="btn small secondary" onClick={() => {
                      setEditId(r.id);
                      setF({ kategori: r.kategori, judul: r.judul, isi: r.isi, urutan: r.urutan, aktif: r.aktif });
                    }}>Ubah</button>
                    <button type="button" className="btn small danger" onClick={() => void hapus(r)}>Hapus</button>
                  </div>
                </div>
                {buka === r.id ? (
                  <div style={{ whiteSpace: "pre-wrap", marginTop: 8, lineHeight: 1.55 }}>{r.isi}</div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>{editId ? "Ubah Entri" : "Tambah Entri"}</h2>
        <form className="stack" onSubmit={(e) => void simpan(e)}>
          <label>Kategori
            <input list="kategori-deteksi" value={f.kategori} required
              onChange={(e) => setF({ ...f, kategori: e.target.value })} placeholder="mis. Indikasi & Ambang Rujuk" />
            <datalist id="kategori-deteksi">
              {kategori.map(([k]) => <option key={k} value={k} />)}
            </datalist>
          </label>
          <label>Judul
            <input value={f.judul} required onChange={(e) => setF({ ...f, judul: e.target.value })} />
          </label>
          <label>Isi
            <textarea rows={7} value={f.isi} required onChange={(e) => setF({ ...f, isi: e.target.value })} />
          </label>
          <div className="row">
            <label style={{ maxWidth: 140 }}>Urutan
              <input type="number" value={f.urutan} onChange={(e) => setF({ ...f, urutan: Number(e.target.value) })} />
            </label>
            <label className="row" style={{ gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={f.aktif} onChange={(e) => setF({ ...f, aktif: e.target.checked })} /> Aktif
            </label>
          </div>
          <div className="row">
            <button className="btn" type="submit" disabled={busy}>{busy ? "Menyimpan…" : editId ? "Simpan Perubahan" : "Tambah Entri"}</button>
            {editId ? (
              <button type="button" className="btn secondary" onClick={() => { setEditId(null); setF(FLAT); }}>Batal</button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
