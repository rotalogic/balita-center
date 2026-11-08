"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";
import { tanggalPanjang } from "@/lib/format";
import { kirimJson } from "@/lib/http";

type Cycle = {
  id: string;
  theme: string;
  start_date: string;
  end_date: string;
  branch_name: string;
  class_name: string;
  report_count: number;
};
type Butir = {
  id: string;
  age_group: string;
  aspect: string;
  aspect_label: string;
  item_text: string;
  sort_order: number;
  is_active: boolean;
};
type Data = {
  cycles: Cycle[];
  stppa: Butir[];
  classes: Array<{ id: string; name: string; branch_id: string }>;
  branches: Array<{ id: string; name: string }>;
  aspects: Array<{ code: string; label: string }>;
  ageGroups: string[];
};

const CONTOH_CSV = `Kelompok Usia;Aspek;Butir
3-4 tahun;Nilai Agama & Moral;Mengucap salam kepada guru dan teman
3-4 tahun;Motorik Kasar;Melompat dengan dua kaki di tempat
3-4 tahun;Motorik Halus;Menggunting mengikuti garis lurus
3-4 tahun;Bahasa;Menyebutkan nama anggota keluarga
3-4 tahun;Kognitif;Mengelompokkan benda berdasarkan warna
3-4 tahun;Sosial Emosional;Mau berbagi mainan dengan teman
3-4 tahun;Kemandirian;Memakai sepatu sendiri`;

export default function AkademikPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cycle, setCycle] = useState({ branch_id: "", class_id: "", theme: "", start_date: "", end_date: "" });
  const [stppa, setStppa] = useState({ age_group: "", aspect: "", item_text: "", sort_order: "0" });
  const [csv, setCsv] = useState("");
  const [laporanCsv, setLaporanCsv] = useState<Array<{ baris: number; alasan: string; isi: string }>>([]);
  const [edit, setEdit] = useState<{ id: string; item_text: string; sort_order: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/academic")
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  useEffect(load, [load]);

  async function simpan(payload: Record<string, unknown>, label: string) {
    setBusy(label);
    setError(null);
    setInfo(null);
    const { ok, data: d } = await kirimJson("/api/academic", "POST", payload);
    setBusy(null);
    if (!ok) {
      setError(String(d.error || "Gagal menyimpan."));
      return false;
    }
    setInfo(payload.kind === "cycle" ? "Siklus belajar ditambahkan." : "Butir STPPA ditambahkan.");
    // Muat ulang dari server: penghitung & daftar langsung segar, tanpa reload manual.
    load();
    return true;
  }

  async function hapus(kind: "cycle" | "stppa", id: string, label: string) {
    if (!window.confirm(`Hapus ${label}?`)) return;
    setError(null);
    const { ok, data: d } = await kirimJson(`/api/academic/${id}?kind=${kind}`, "DELETE");
    if (!ok) return setError(String(d.error || "Gagal menghapus."));
    setInfo("Data dihapus.");
    load();
  }

  async function ubahButir(id: string, patch: Record<string, unknown>, pesan: string) {
    setBusy(id);
    setError(null);
    const { ok, data: d } = await kirimJson(`/api/academic/${id}?kind=stppa`, "PATCH", patch);
    setBusy(null);
    if (!ok) return setError(String(d.error || "Gagal mengubah butir."));
    setInfo(pesan);
    setEdit(null);
    load();
  }

  async function imporCsv() {
    setBusy("csv");
    setError(null);
    setInfo(null);
    setLaporanCsv([]);
    const { ok, data: d } = await kirimJson("/api/academic", "POST", { kind: "stppa_import", csv });
    setBusy(null);
    if (!ok) return setError(String(d.error || "Impor gagal."));
    setLaporanCsv((d.gagal as Array<{ baris: number; alasan: string; isi: string }>) || []);
    setInfo(`Impor selesai: ${d.masuk} butir masuk, ${d.duplikat} dilewati karena sudah ada, ${(d.gagal as unknown[])?.length || 0} baris gagal.`);
    load();
  }

  if (error && !data) return (<><PageHead title="Akademik" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Akademik" /><LoadingState /></>);

  const kelasTersaring = data.classes.filter((k) => !cycle.branch_id || k.branch_id === cycle.branch_id);
  const labelAspek = (code: string) => data.aspects.find((a) => a.code === code)?.label || code;

  return (
    <>
      <PageHead title="Akademik" subtitle="Siklus belajar per kelas dan butir capaian STPPA" />
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Siklus belajar ({data.cycles.length})</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const berhasil = await simpan({ kind: "cycle", ...cycle }, "cycle");
            if (berhasil) setCycle({ branch_id: "", class_id: "", theme: "", start_date: "", end_date: "" });
          }}
        >
          <div className="form-grid">
            <div className="field"><label htmlFor="cy_br">Cabang *</label>
              <select id="cy_br" required value={cycle.branch_id} onChange={(e) => setCycle({ ...cycle, branch_id: e.target.value, class_id: "" })}>
                <option value="">Pilih cabang</option>
                {data.branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select></div>
            <div className="field"><label htmlFor="cy_kl">Kelas *</label>
              <select id="cy_kl" required value={cycle.class_id} onChange={(e) => setCycle({ ...cycle, class_id: e.target.value })}>
                <option value="">Pilih kelas</option>
                {kelasTersaring.map((k) => (<option key={k.id} value={k.id}>{k.name}</option>))}
              </select></div>
            <div className="field"><label htmlFor="cy_th">Tema *</label>
              <input id="cy_th" required placeholder="Contoh: Aku Cinta Indonesia" value={cycle.theme} onChange={(e) => setCycle({ ...cycle, theme: e.target.value })} /></div>
            <div className="field"><label htmlFor="cy_sd">Mulai *</label>
              <input id="cy_sd" type="date" required value={cycle.start_date} onChange={(e) => setCycle({ ...cycle, start_date: e.target.value })} /></div>
            <div className="field"><label htmlFor="cy_ed">Selesai *</label>
              <input id="cy_ed" type="date" required value={cycle.end_date} onChange={(e) => setCycle({ ...cycle, end_date: e.target.value })} /></div>
          </div>
          <button className="btn small" type="submit" disabled={busy === "cycle"} style={{ marginTop: 8 }}>
            {busy === "cycle" ? "Menyimpan… (maks 20 detik)" : "Tambah Siklus"}
          </button>
        </form>

        {data.cycles.length === 0 ? (
          <div style={{ marginTop: 12 }}><EmptyState title="Belum ada siklus" body="Tambahkan siklus belajar untuk kelas, lalu guru bisa mengisi laporan perkembangan anak." /></div>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Tema</th><th>Cabang / Kelas</th><th>Periode</th><th>Laporan</th><th>Aksi</th></tr></thead>
              <tbody>
                {data.cycles.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.theme}</strong></td>
                    <td>{c.branch_name}<div className="muted">{c.class_name}</div></td>
                    <td>{tanggalPanjang(c.start_date)} – {tanggalPanjang(c.end_date)}</td>
                    <td>{c.report_count}</td>
                    <td><button type="button" className="btn small secondary" onClick={() => hapus("cycle", c.id, `siklus ${c.theme}`)}>Hapus</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Butir STPPA ({data.stppa.length})</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const berhasil = await simpan({ kind: "stppa", ...stppa }, "stppa");
            if (berhasil) setStppa({ age_group: stppa.age_group, aspect: "", item_text: "", sort_order: "0" });
          }}
        >
          <div className="form-grid">
            <div className="field"><label htmlFor="st_ag">Kelompok usia *</label>
              <select id="st_ag" required value={stppa.age_group} onChange={(e) => setStppa({ ...stppa, age_group: e.target.value })}>
                <option value="">Pilih kelompok usia</option>
                {data.ageGroups.map((g) => (<option key={g} value={g}>{g}</option>))}
              </select></div>
            <div className="field"><label htmlFor="st_as">Aspek *</label>
              <select id="st_as" required value={stppa.aspect} onChange={(e) => setStppa({ ...stppa, aspect: e.target.value })}>
                <option value="">Pilih aspek</option>
                {data.aspects.map((a) => (<option key={a.code} value={a.code}>{a.label}</option>))}
              </select></div>
            <div className="field"><label htmlFor="st_tx">Butir capaian *</label>
              <input id="st_tx" required value={stppa.item_text} onChange={(e) => setStppa({ ...stppa, item_text: e.target.value })} /></div>
            <div className="field"><label htmlFor="st_so">Urutan</label>
              <input id="st_so" type="number" min="0" value={stppa.sort_order} onChange={(e) => setStppa({ ...stppa, sort_order: e.target.value })} /></div>
          </div>
          <button className="btn small" type="submit" disabled={busy === "stppa"} style={{ marginTop: 8 }}>
            {busy === "stppa" ? "Menyimpan… (maks 20 detik)" : "Tambah Butir"}
          </button>
        </form>

        {data.stppa.length === 0 ? (
          <div style={{ marginTop: 12 }}><EmptyState title="Belum ada butir STPPA" body="Isi butir capaian per kelompok usia dan aspek perkembangan, atau impor lewat CSV di bawah." /></div>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Usia</th><th>Aspek</th><th>Butir</th><th>Urutan</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {data.stppa.map((s) => (
                  <tr key={s.id}>
                    <td>{s.age_group}</td>
                    <td>{s.aspect_label || labelAspek(s.aspect)}</td>
                    <td>
                      {edit?.id === s.id ? (
                        <input value={edit.item_text} onChange={(e) => setEdit({ ...edit, item_text: e.target.value })} />
                      ) : s.item_text}
                    </td>
                    <td>
                      {edit?.id === s.id ? (
                        <input type="number" min="0" style={{ width: 70 }} value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })} />
                      ) : s.sort_order}
                    </td>
                    <td><StatusBadge status={s.is_active === false ? "nonaktif" : "aktif"} /></td>
                    <td>
                      {edit?.id === s.id ? (
                        <span className="row">
                          <button type="button" className="btn small" disabled={busy === s.id} onClick={() => ubahButir(s.id, { item_text: edit.item_text, sort_order: edit.sort_order }, "Butir diperbarui.")}>Simpan</button>
                          <button type="button" className="btn small secondary" onClick={() => setEdit(null)}>Batal</button>
                        </span>
                      ) : (
                        <span className="row">
                          <button type="button" className="btn small secondary" onClick={() => setEdit({ id: s.id, item_text: s.item_text, sort_order: String(s.sort_order) })}>Edit</button>
                          <button type="button" className="btn small secondary" disabled={busy === s.id} onClick={() => ubahButir(s.id, { is_active: s.is_active === false }, s.is_active === false ? "Butir diaktifkan lagi." : "Butir dinonaktifkan — data penilaian lama tetap utuh.")}>
                            {s.is_active === false ? "Aktifkan" : "Nonaktifkan"}
                          </button>
                          <button type="button" className="btn small danger" onClick={() => hapus("stppa", s.id, "butir ini")}>Hapus</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Impor Butir STPPA (CSV)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Format: <code>Kelompok Usia; Aspek; Butir</code> — satu butir per baris. Butir yang sudah ada tidak digandakan.
        </p>
        <textarea
          aria-label="Isi CSV butir STPPA"
          rows={7}
          style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
          placeholder={CONTOH_CSV}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn small" disabled={busy === "csv" || !csv.trim()} onClick={imporCsv}>
            {busy === "csv" ? "Mengimpor…" : "Impor CSV"}
          </button>
          <button
            type="button"
            className="btn small secondary"
            onClick={() => {
              const blob = new Blob([CONTOH_CSV], { type: "text/csv;charset=utf-8" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "contoh-butir-stppa.csv";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Unduh contoh CSV
          </button>
        </div>
        {laporanCsv.length > 0 ? (
          <div style={{ marginTop: 12 }}>
            <h3>Baris yang gagal ({laporanCsv.length})</h3>
            <ul>
              {laporanCsv.map((g) => (
                <li key={g.baris}><strong>Baris {g.baris}:</strong> {g.alasan} <span className="muted">({g.isi})</span></li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </>
  );
}
