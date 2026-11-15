"use client";

import { useCallback, useEffect, useState } from "react";

type Paket = {
  id: string;
  nama_paket: string;
  total_sesi: number;
  terpakai: number;
  sisa: number;
  mulai_pada: string;
  selesai_pada: string | null;
  status: string;
  catatan: string | null;
};

type DataPaket = {
  paket: Paket[];
  sesi_bulan_ini: { hadir: number; izin: number; sakit: number; alpa: number };
  insidentil_diikuti: Array<Record<string, unknown>>;
  sesi_mendatang: Array<Record<string, unknown>>;
};

const tanggal = (v: unknown) =>
  new Date(`${String(v)}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// Kartu Riwayat Sesi & Paket di berkas anak (Tur Demo Layar 2). Sisa paket
// dihitung server dari kehadiran; formulir di sini hanya mencatat paket
// yang dibeli keluarga, bukan mengarang jumlah sesi.
export function PaketSesi({ childId }: { childId: string }) {
  const [data, setData] = useState<DataPaket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ nama_paket: "", total_sesi: "", mulai_pada: "", selesai_pada: "", catatan: "" });

  const muat = useCallback(async () => {
    try {
      const res = await fetch(`/api/children/${childId}/paket`);
      const d = await res.json();
      if (d.ok) setData(d as DataPaket);
      else setError(d.error || "Data paket tidak dapat dimuat.");
    } catch {
      setError("Tidak dapat menghubungi server.");
    }
  }, [childId]);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function tambah() {
    setBusy(true);
    setInfo(null);
    setError(null);
    try {
      const res = await fetch(`/api/children/${childId}/paket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Paket gagal disimpan.");
      setForm({ nama_paket: "", total_sesi: "", mulai_pada: "", selesai_pada: "", catatan: "" });
      setInfo("Paket sesi tercatat.");
      await muat();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Paket gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function ubahStatus(p: Paket, status: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/children/${childId}/paket`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paket_id: p.id, status }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Status paket gagal diubah.");
      await muat();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status paket gagal diubah.");
    } finally {
      setBusy(false);
    }
  }

  async function hapus(p: Paket) {
    if (!window.confirm(`Hapus catatan paket "${p.nama_paket}"? Pakai ini hanya untuk paket yang salah input.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/children/${childId}/paket?paket_id=${p.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Paket gagal dihapus.");
      await muat();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Paket gagal dihapus.");
    } finally {
      setBusy(false);
    }
  }

  const s = data?.sesi_bulan_ini;

  return (
    <article className="card" style={{ marginTop: 16 }}>
      <h2>Riwayat Sesi &amp; Paket</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Sesi terpakai dihitung dari kehadiran berstatus hadir sejak tanggal paket mulai.
        Paket dicatat staf dari pembelian keluarga; sistem tidak mengarang sisa sesi.
      </p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {info ? <p className="success" role="status">{info}</p> : null}
      {!data ? (
        <p className="muted">Memuat riwayat sesi…</p>
      ) : (
        <>
          <p style={{ marginTop: 0 }}>
            <strong>Bulan ini:</strong> hadir {s?.hadir ?? 0} sesi · izin {s?.izin ?? 0} · sakit{" "}
            {s?.sakit ?? 0} · tanpa keterangan {s?.alpa ?? 0}
          </p>
          {data.paket.length === 0 ? (
            <p className="muted">Belum ada paket sesi tercatat untuk anak ini.</p>
          ) : (
            <ul className="timeline">
              {data.paket.map((p) => (
                <li key={p.id}>
                  <time>{tanggal(p.mulai_pada)}</time>
                  <div>
                    <strong>{p.nama_paket}</strong>{" "}
                    <span className={p.status === "aktif" ? "badge ok" : "badge"}>{p.status}</span>
                    <div>
                      Terpakai {p.terpakai} dari {p.total_sesi} sesi · <strong>sisa {p.sisa}</strong>
                      {p.selesai_pada ? ` · berlaku sampai ${tanggal(p.selesai_pada)}` : ""}
                      {p.catatan ? ` · ${p.catatan}` : ""}
                    </div>
                    <div className="row" style={{ gap: 8, marginTop: 4 }}>
                      {p.status === "aktif" ? (
                        <button type="button" className="btn small" disabled={busy} onClick={() => void ubahStatus(p, "selesai")}>Tandai selesai</button>
                      ) : (
                        <button type="button" className="btn small" disabled={busy} onClick={() => void ubahStatus(p, "aktif")}>Aktifkan kembali</button>
                      )}
                      <button type="button" className="btn small danger" disabled={busy} onClick={() => void hapus(p)}>Hapus</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="grid two">
            <div>
              <h3 style={{ marginBottom: 6 }}>Kegiatan Insidentil Diikuti</h3>
              {data.insidentil_diikuti.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>Belum ada kegiatan insidentil atau event yang diikuti.</p>
              ) : (
                <ul className="timeline">
                  {data.insidentil_diikuti.map((r, i) => (
                    <li key={i}>
                      <time>{tanggal(r.tanggal)}</time>
                      <div>{String(r.kegiatan_label || r.kegiatan_jenis || "Kegiatan")} · {String(r.status || "").replace(/_/g, " ")}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 style={{ marginBottom: 6 }}>Sesi Mendatang</h3>
              {data.sesi_mendatang.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>Tidak ada sesi terjadwal mendatang atas nama anak ini.</p>
              ) : (
                <ul className="timeline">
                  {data.sesi_mendatang.map((r, i) => (
                    <li key={i}>
                      <time>{tanggal(r.tanggal)}</time>
                      <div>
                        {String(r.jenis || "Sesi")} {String(r.jam_mulai || "").slice(0, 5)}
                        {r.jam_selesai ? `–${String(r.jam_selesai).slice(0, 5)}` : ""} · {String(r.status || "").replace(/_/g, " ")}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <h3>Catat Paket Sesi Baru</h3>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="pk-nama">Nama paket *</label>
              <input id="pk-nama" type="text" placeholder="mis. Movement 10x" value={form.nama_paket} onChange={(e) => setForm({ ...form, nama_paket: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="pk-total">Total sesi *</label>
              <input id="pk-total" type="number" min="1" step="1" value={form.total_sesi} onChange={(e) => setForm({ ...form, total_sesi: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="pk-mulai">Mulai berlaku *</label>
              <input id="pk-mulai" type="date" value={form.mulai_pada} onChange={(e) => setForm({ ...form, mulai_pada: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="pk-selesai">Berlaku sampai</label>
              <input id="pk-selesai" type="date" value={form.selesai_pada} onChange={(e) => setForm({ ...form, selesai_pada: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="pk-catatan">Catatan</label>
              <input id="pk-catatan" type="text" placeholder="mis. dibeli bersama pendaftaran" value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn" disabled={busy} onClick={() => void tambah()}>
              {busy ? "Menyimpan…" : "Simpan Paket"}
            </button>
          </div>
        </>
      )}
    </article>
  );
}
