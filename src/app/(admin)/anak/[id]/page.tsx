"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";
import { tanggalPanjang } from "@/lib/format";
import { labelGizi } from "@/lib/rapor-data";

type Row = Record<string, string | number | null>;
type Payload = {
  child: Row;
  guardians: Row[];
  enrollment: Row | null;
  reports: Array<{ id: string; report_date: string; status: string; mood: string | null }>;
  health: Row[];
  development: Row[];
  milestones: Row[];
  observations: Row[];
};

const TABS = ["Profil Anak", "Pendidikan & STPPA", "Kesehatan", "Laporan & Perkembangan"] as const;
const LABEL_GENDER: Record<string, string> = {
  laki_laki: "Laki-laki",
  perempuan: "Perempuan",
};
const labelAtau = (peta: Record<string, string>, nilai: unknown) => {
  const teks = String(nilai ?? "").trim();
  if (!teks) return "-";
  return peta[teks.toLowerCase()] || teks;
};
const ASPECTS: Array<[string, string]> = [
  ["physical_pct", "Pertumbuhan Fisik"], ["gross_motor_pct", "Motorik Kasar"], ["fine_motor_pct", "Motorik Halus"],
  ["cognitive_pct", "Kognitif"], ["language_pct", "Bahasa"], ["social_emotional_pct", "Sosial & Emosional"], ["independence_pct", "Kemandirian"],
];

export default function DetailAnakPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Profil Anak");

  const [staf, setStaf] = useState<Array<{ id: string; full_name: string; position: string }>>([]);
  const [ukur, setUkur] = useState<Record<string, string>>({ checked_on: new Date().toISOString().slice(0, 10) });
  const [ukurInfo, setUkurInfo] = useState<string | null>(null);
  const [ukurError, setUkurError] = useState<string | null>(null);
  const [ukurBusy, setUkurBusy] = useState(false);

  const muat = useCallback(() => {
    fetch(`/api/children/${params.id}`)
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [params.id]);

  useEffect(() => {
    muat();
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => (d.ok ? setStaf(d.staff || []) : null))
      .catch(() => null);
  }, [muat]);

  const setU = (k: string, v: string) => setUkur((p) => ({ ...p, [k]: v }));

  async function simpanUkur() {
    setUkurBusy(true);
    setUkurInfo(null);
    setUkurError(null);
    const res = await fetch(`/api/children/${params.id}/health`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ukur),
    });
    const d = await res.json();
    setUkurBusy(false);
    if (!d.ok) { setUkurError(d.error || "Gagal mencatat pemeriksaan."); return; }
    setUkur({ checked_on: new Date().toISOString().slice(0, 10) });
    setUkurInfo("Pemeriksaan tercatat. Hasil ukur terbaru ikut tampil di Balita Connect dan panel Tumbuh Kembang rapor.");
    muat();
  }

  async function hapusUkur(checkId: string) {
    if (!window.confirm("Hapus catatan pemeriksaan ini?")) return;
    const res = await fetch(`/api/children/${params.id}/health?check_id=${checkId}`, { method: "DELETE" });
    const d = await res.json();
    if (d.ok) muat();
    else setUkurError(d.error || "Gagal menghapus catatan.");
  }

  if (error) return (<><PageHead title="Detail Anak Didik" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Detail Anak Didik" /><LoadingState /></>);

  const child = data.child;
  const dev = data.development[0];

  return (
    <>
      <PageHead
        title={String(child.full_name || "Detail Anak Didik")}
        subtitle="Lihat dan kelola informasi lengkap anak didik"
        action={
          <div className="row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn secondary" href={`/anak/${params.id}/edit`}>Ubah Data</Link>
            <Link className="btn secondary" href={`/connect?child_id=${params.id}&preview=1`} target="_blank">
              Pratinjau sebagai Orang Tua
            </Link>
            <Link className="btn" href="/daily-reports/buat">+ Daily Report</Link>
            <button
              className="btn secondary"
              style={{ color: "#b42318", borderColor: "#f0c4bf" }}
              onClick={async () => {
                const alasan = window.prompt(`Hapus (Sampah) data ${child.full_name}? Tulis alasan singkat:`);
                if (alasan === null) return;
                const res = await fetch(`/api/children/${params.id}/sampah`, {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ reason: alasan }),
                });
                const d = await res.json();
                if (d.ok) window.location.href = "/anak";
                else window.alert(d.error || "Gagal menghapus.");
              }}
            >
              Hapus (Sampah)
            </button>
          </div>
        }
      />
      <div className="tab-row" role="tablist" aria-label="Bagian detail anak">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "tab-pill active" : "tab-pill"} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "Profil Anak" ? (
        <section className="grid three">
          <article className="card">
            <h2>Ringkasan</h2>
            {child.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={String(child.photo_url)}
                alt={String(child.full_name || "Foto anak")}
                style={{ width: "100%", maxWidth: 180, aspectRatio: "1", objectFit: "cover", borderRadius: 12, marginBottom: 12 }}
              />
            ) : null}
            <p><StatusBadge status={String(child.status || "aktif")} /></p>
            <dl>
              <dt className="muted">Tanggal lahir</dt><dd>{tanggalPanjang(child.birth_date as string)}</dd>
              <dt className="muted">Tempat lahir</dt><dd>{String(child.birth_place || "-")}</dd>
              <dt className="muted">Jenis kelamin</dt><dd>{labelAtau(LABEL_GENDER, child.gender)}</dd>
              <dt className="muted">Agama</dt><dd>{String(child.religion || "-")}</dd>
              <dt className="muted">Bahasa</dt><dd>{String(child.languages || "-")}</dd>
              <dt className="muted">Hobi / minat</dt><dd>{String(child.hobbies || "-")}</dd>
              <dt className="muted">Transportasi</dt><dd>{String(child.transport_mode || "-")}</dd>
              <dt className="muted">Tanggal masuk</dt><dd>{tanggalPanjang(child.enrolled_on as string)}</dd>
            </dl>
          </article>
          <article className="card">
            <h2>Orang Tua / Wali</h2>
            {data.guardians.length === 0 ? (
              <EmptyState title="Belum ada wali" body="Wali utama ditambahkan saat pendaftaran anak." />
            ) : (
              data.guardians.map((g) => (
                <div key={String(g.id)} style={{ marginBottom: 10 }}>
                  <strong>{String(g.full_name)}</strong>
                  <div className="muted">{String(g.relation || "Wali")} · {String(g.phone || "-")}</div>
                  <div className="muted">{String(g.occupation || "")}{g.employer ? ` · ${String(g.employer)}` : ""}</div>
                  <div className="muted">{String(g.address || "")}</div>
                </div>
              ))
            )}
          </article>
          <article className="card">
            <h2>Persetujuan &amp; Catatan</h2>
            <dl>
              <dt className="muted">Izin foto &amp; video</dt><dd>{child.photo_consent ? "Diizinkan" : "Tidak diizinkan"}</dd>
              <dt className="muted">Kebutuhan khusus</dt><dd>{String(child.special_needs || "Tidak ada")}</dd>
              <dt className="muted">Catatan kesehatan / alergi</dt><dd>{String(child.health_notes || "Tidak ada")}</dd>
            </dl>
          </article>
        </section>
      ) : null}

      {tab === "Pendidikan & STPPA" ? (
        <section className="grid two">
          <article className="card">
            <h2>Pendidikan Saat Ini</h2>
            {data.enrollment ? (
              <p>{String(data.enrollment.program_name)} · Kelas {String(data.enrollment.class_name)}<br /><span className="muted">Mulai {String(data.enrollment.start_date || "-")} · Status {String(data.enrollment.status)}</span></p>
            ) : (<EmptyState title="Belum ada pendaftaran aktif" body="Pendaftaran dibuat otomatis saat anak ditambahkan dengan cabang, program, dan kelas." />)}
          </article>
          <article className="card">
            <h2>Milestone</h2>
            {data.observations.length > 0 ? (
              <>
                <h3 style={{ marginTop: 0 }}>Observasi dari Laporan Harian</h3>
                <ul className="timeline">
                  {data.observations.map((o) => (
                    <li key={String(o.id)}>
                      <time>{String(o.observed_on || "")}</time>
                      <div>{String(o.indikator)}
                        <div className="muted">Usia {String(o.age_group || "-")}{o.level ? <> · Capaian {"★".repeat(Number(o.level))}{"☆".repeat(4 - Number(o.level))}</> : null}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {data.milestones.length === 0 && data.observations.length === 0 ? (
              <EmptyState title="Belum ada milestone tercatat" body="Pilih milestone pada aktivitas Observasi (atau material terkait) di editor laporan harian — capaiannya tercatat otomatis di sini." />
            ) : data.milestones.length > 0 ? (
              <ul className="timeline">
                {data.milestones.map((m) => (
                  <li key={String(m.id)}><time>{String(m.achieved_on || "")}</time><div><strong>{String(m.title)}</strong><div className="muted">{String(m.category || "")} · {String(m.notes || "")}</div></div></li>
                ))}
              </ul>
            ) : null}
          </article>
        </section>
      ) : null}

      {tab === "Kesehatan" ? (
        <>
        <section className="grid two">
          <article className="card">
            <h2>Informasi Kesehatan</h2>
            <dl>
              <dt className="muted">Golongan darah</dt><dd>{String(child.blood_type || "-")}</dd>
              <dt className="muted">Kebutuhan khusus</dt><dd>{String(child.special_needs || "Tidak ada")}</dd>
              <dt className="muted">Catatan kesehatan</dt><dd>{String(child.health_notes || "Tidak ada")}</dd>
            </dl>
          </article>
          <article className="card">
            <h2>Riwayat Pemeriksaan</h2>
            {data.health.length === 0 ? (
              <EmptyState title="Belum ada pemeriksaan" body="Catat hasil ukur pertama lewat formulir di bawah — berat, tinggi, dan lingkar kepala mengisi panel Tumbuh Kembang di rapor." />
            ) : (
              <ul className="timeline">
                {data.health.map((h) => (
                  <li key={String(h.id)}>
                    <time>{String(h.checked_on)}</time>
                    <div>
                      {String(h.condition || "Pemeriksaan rutin")}
                      <div className="muted">
                        {String(h.weight_kg || "-")} kg · {String(h.height_cm || "-")} cm · LK {String(h.head_circumference_cm || "-")} cm · {String(h.temperature_c || "-")}°C
                        {h.nutrition_status ? <> · Status gizi: <strong>{labelGizi(String(h.nutrition_status))}</strong></> : null}
                      </div>
                      <button type="button" className="btn small danger" style={{ marginTop: 4 }} onClick={() => void hapusUkur(String(h.id))}>Hapus</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <article className="card" style={{ marginTop: 16 }}>
          <h2>Catat Pemeriksaan Baru</h2>
          {ukurInfo ? <p className="success" role="status">{ukurInfo}</p> : null}
          {ukurError ? <p className="error" role="alert">{ukurError}</p> : null}
          <div className="form-grid">
            <div className="field"><label htmlFor="uk-tanggal">Tanggal *</label>
              <input id="uk-tanggal" type="date" value={ukur.checked_on || ""} onChange={(e) => setU("checked_on", e.target.value)} /></div>
            <div className="field"><label htmlFor="uk-berat">Berat Badan (kg)</label>
              <input id="uk-berat" type="number" step="0.1" min="0" placeholder="mis. 13,8" value={ukur.weight_kg || ""} onChange={(e) => setU("weight_kg", e.target.value)} /></div>
            <div className="field"><label htmlFor="uk-tinggi">Tinggi Badan (cm)</label>
              <input id="uk-tinggi" type="number" step="0.1" min="0" placeholder="mis. 101,4" value={ukur.height_cm || ""} onChange={(e) => setU("height_cm", e.target.value)} /></div>
            <div className="field"><label htmlFor="uk-lk">Lingkar Kepala (cm)</label>
              <input id="uk-lk" type="number" step="0.1" min="0" placeholder="mis. 49,2" value={ukur.head_circumference_cm || ""} onChange={(e) => setU("head_circumference_cm", e.target.value)} /></div>
            <div className="field"><label htmlFor="uk-suhu">Suhu (°C)</label>
              <input id="uk-suhu" type="number" step="0.1" min="0" placeholder="mis. 36,6" value={ukur.temperature_c || ""} onChange={(e) => setU("temperature_c", e.target.value)} /></div>
            <div className="field"><label htmlFor="uk-gizi">Status Gizi</label>
              <select id="uk-gizi" value={ukur.nutrition_status || ""} onChange={(e) => setU("nutrition_status", e.target.value)}>
                <option value="">Belum dinilai</option>
                <option value="gizi_baik">Gizi Baik</option>
                <option value="gizi_kurang">Gizi Kurang</option>
                <option value="gizi_lebih">Gizi Lebih</option>
                <option value="obesitas">Obesitas</option>
                <option value="stunting">Stunting</option>
              </select></div>
            <div className="field"><label htmlFor="uk-kondisi">Kondisi</label>
              <input id="uk-kondisi" type="text" placeholder="mis. Sehat / Batuk ringan" value={ukur.condition || ""} onChange={(e) => setU("condition", e.target.value)} /></div>
            <div className="field"><label htmlFor="uk-pemeriksa">Diperiksa oleh</label>
              <select id="uk-pemeriksa" value={ukur.checked_by || ""} onChange={(e) => setU("checked_by", e.target.value)}>
                <option value="">Pilih staf</option>
                {staf.map((s) => (<option key={s.id} value={s.id}>{s.full_name} — {s.position}</option>))}
              </select></div>
            <div className="field"><label htmlFor="uk-catatan">Catatan</label>
              <input id="uk-catatan" type="text" placeholder="Catatan tambahan (opsional)" value={ukur.notes || ""} onChange={(e) => setU("notes", e.target.value)} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn" disabled={ukurBusy} onClick={() => void simpanUkur()}>{ukurBusy ? "Menyimpan…" : "Simpan Pemeriksaan"}</button>
          </div>
        </article>
        </>
      ) : null}

      {tab === "Laporan & Perkembangan" ? (
        <section className="grid two">
          <article className="card">
            <h2>Daily Report Terakhir</h2>
            {data.reports.length === 0 ? (
              <EmptyState title="Belum ada laporan" body="Laporan harian anak ini akan tampil di sini setelah guru membuatnya." />
            ) : (
              <ul className="timeline">
                {data.reports.map((r) => (
                  <li key={r.id}><time>{new Date(r.report_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</time><div><strong>{r.status.replace(/_/g, " ")}</strong><div className="muted">Mood: {r.mood || "-"}</div></div></li>
                ))}
              </ul>
            )}
          </article>
          <article className="card">
            <h2>Perkembangan Terakhir</h2>
            {!dev ? (
              <EmptyState title="Belum ada catatan perkembangan" body="Catatan per aspek dari tabel child_development_records tampil di sini dan di Balita Connect." />
            ) : (
              <>
                {ASPECTS.map(([key, label]) => (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <div className="row spread"><span>{label}</span><strong>{dev[key] ?? "-"}%</strong></div>
                    <div style={{ background: "var(--soft-gray)", borderRadius: 999, height: 8 }}><div style={{ width: `${Number(dev[key] || 0)}%`, background: "var(--teal)", borderRadius: 999, height: 8 }} /></div>
                  </div>
                ))}
                <p className="muted">Periode: {String(dev.recorded_on)}</p>
              </>
            )}
          </article>
        </section>
      ) : null}
    </>
  );
}
