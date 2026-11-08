"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";
import { tanggalPendek } from "@/lib/format";

type RaporRow = {
  id: string; status: string; child_name: string; cycle_theme: string;
  cycle_start: string; cycle_end: string; teacher_name: string | null;
};
type Anak = { id: string; full_name: string };
type Siklus = { id: string; theme: string; start_date: string; end_date: string; class_name?: string };
type Staf = { id: string; full_name: string; position: string };

export default function RaporListPage() {
  const [rows, setRows] = useState<RaporRow[] | null>(null);
  const [anak, setAnak] = useState<Anak[]>([]);
  const [siklus, setSiklus] = useState<Siklus[]>([]);
  const [staf, setStaf] = useState<Staf[]>([]);
  const [form, setForm] = useState({ child_id: "", cycle_id: "", created_by: "" });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/rapor").then((r) => r.json()).then((d) => (d.ok ? setRows(d.reports) : setError(d.error))).catch(() => setError("Tidak dapat menghubungi server."));
    fetch("/api/children").then((r) => r.json()).then((d) => (d.ok ? setAnak(d.children) : null)).catch(() => null);
    fetch("/api/academic").then((r) => r.json()).then((d) => (d.ok ? setSiklus(d.cycles) : null)).catch(() => null);
    fetch("/api/meta").then((r) => r.json()).then((d) => (d.ok ? setStaf(d.staff) : null)).catch(() => null);
  }, []);

  async function buat() {
    setError(null);
    setInfo(null);
    if (!form.child_id || !form.cycle_id || !form.created_by) {
      setError("Anak, siklus, dan guru pembuat wajib dipilih.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/rapor", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const d = await res.json();
    setBusy(false);
    if (d.ok) {
      window.location.href = `/rapor/${d.id}/edit`;
      return;
    }
    if (d.existing_id) {
      setInfo(`Rapor untuk pilihan itu sudah ada.`);
      setError(`${d.error} Buka dari daftar di bawah.`);
      return;
    }
    setError(d.error || "Gagal membuat rapor.");
  }

  return (
    <>
      <PageHead title="Rapor Perkembangan" subtitle="Rapor periodik per siklus belajar — narasi STPPA, area Montessori, kesimpulan, dan saran untuk orang tua" />
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Buat Rapor Baru</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="r-anak">Anak</label>
            <select id="r-anak" value={form.child_id} onChange={(e) => setForm({ ...form, child_id: e.target.value })}>
              <option value="">Pilih anak</option>
              {anak.map((a) => (<option key={a.id} value={a.id}>{a.full_name}</option>))}
            </select></div>
          <div className="field"><label htmlFor="r-siklus">Siklus Belajar</label>
            <select id="r-siklus" value={form.cycle_id} onChange={(e) => setForm({ ...form, cycle_id: e.target.value })}>
              <option value="">Pilih siklus</option>
              {siklus.map((s) => (<option key={s.id} value={s.id}>{s.theme} ({tanggalPendek(s.start_date)} – {tanggalPendek(s.end_date)})</option>))}
            </select></div>
          <div className="field"><label htmlFor="r-guru">Guru Pembuat</label>
            <select id="r-guru" value={form.created_by} onChange={(e) => setForm({ ...form, created_by: e.target.value })}>
              <option value="">Pilih guru</option>
              {staf.map((s) => (<option key={s.id} value={s.id}>{s.full_name} — {s.position}</option>))}
            </select></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn" disabled={busy} onClick={buat}>{busy ? "Membuat…" : "Buat Draft Rapor"}</button>
        </div>
      </div>

      {!rows ? <LoadingState /> : rows.length === 0 ? (
        <EmptyState title="Belum ada rapor" body="Buat draft rapor pertama lewat formulir di atas. Rapor terbit tampil untuk orang tua di Balita Connect dan bisa diunduh sebagai PDF." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Anak</th><th>Siklus</th><th>Periode</th><th>Guru</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.child_name}</strong></td>
                  <td>{r.cycle_theme}</td>
                  <td>{tanggalPendek(r.cycle_start)} – {tanggalPendek(r.cycle_end)}</td>
                  <td>{r.teacher_name || "-"}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    <span className="row">
                      <Link className="btn small secondary" href={`/rapor/${r.id}`}>Lihat</Link>
                      <Link className="btn small" href={`/rapor/${r.id}/edit`}>Edit</Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
