"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHead, useMe } from "@/components/chrome";
import { tanggalPanjang } from "@/lib/format";

type Report = {
  id: string;
  report_date: string;
  status: string;
  child_name: string;
  class_name: string;
  teacher_name: string;
  photo_count: string;
  deleted_at: string | null;
  deleted_by_name: string | null;
};

const LABEL_STATUS: Record<string, string> = {
  draft: "Draft",
  menunggu_review: "Menunggu Review",
  revisi: "Perlu Revisi",
  published: "Terbit",
};

export default function DailyReportsPage() {
  const me = useMe();
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState("");
  const [sampah, setSampah] = useState(false);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [hapus, setHapus] = useState<Report | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (sampah) params.set("sampah", "1");
      const res = await fetch(`/api/daily-reports?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) {
        setGalat(data.error || "Gagal memuat laporan.");
        setReports([]);
        return;
      }
      setReports(data.reports);
    } catch {
      setGalat("Koneksi terputus saat memuat laporan.");
    } finally {
      setMemuat(false);
    }
  }, [status, sampah]);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function konfirmasiHapus() {
    if (!hapus) return;
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`/api/daily-reports/${hapus.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        setGalat(data.error || "Gagal menghapus laporan.");
        return;
      }
      setPesan(`Draft laporan ${hapus.child_name} tanggal ${tanggalPanjang(hapus.report_date)} dihapus. Super Admin bisa memulihkannya dari filter Sampah.`);
      setHapus(null);
      await muat();
    } catch {
      setGalat("Koneksi terputus saat menghapus.");
    } finally {
      setSibuk(false);
    }
  }

  async function pulihkan(report: Report) {
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`/api/daily-reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      const data = await res.json();
      if (!data.ok) {
        setGalat(data.error || "Gagal memulihkan laporan.");
        return;
      }
      setPesan(`Laporan ${report.child_name} dipulihkan.`);
      await muat();
    } catch {
      setGalat("Koneksi terputus saat memulihkan.");
    } finally {
      setSibuk(false);
    }
  }

  async function kirim(report: Report) {
    setSibuk(true);
    setGalat(null);
    setPesan(null);
    try {
      const res = await fetch(`/api/daily-reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submit: true }),
      });
      const data = await res.json();
      if (!data.ok) {
        const kurang = Array.isArray(data.kurang) && data.kurang.length ? ` Yang kurang: ${data.kurang.join(" ")}` : "";
        setGalat(`${data.error || "Gagal mengirim."}${kurang}`);
        return;
      }
      setPesan(`Laporan ${report.child_name} terkirim untuk review.`);
      await muat();
    } catch {
      setGalat("Koneksi terputus saat mengirim.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <PageHead title="Daily Reports" subtitle="Laporan harian anak — draft, review, dan terbit" />
      <KartuUnduhMassalLaporan />
      {galat ? <div className="alert alert-error" role="alert">{galat}</div> : null}
      {pesan ? <div className="alert alert-ok" role="status">{pesan}</div> : null}

      <div className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Semua</option>
              {Object.entries(LABEL_STATUS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", paddingBottom: 8 }}>
            <input type="checkbox" checked={sampah} onChange={(event) => setSampah(event.target.checked)} />
            <span>Sampah (terhapus)</span>
          </label>
          <Link className="btn" href="/daily-reports/buat" style={{ marginLeft: "auto" }}>
            + Laporan Baru
          </Link>
        </div>
      </div>

      <div className="card">
        {memuat ? (
          <p className="muted">Memuat laporan…</p>
        ) : reports.length === 0 ? (
          <p className="muted">
            {sampah ? "Tidak ada laporan terhapus." : "Belum ada laporan pada filter ini."}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Anak</th>
                <th>Kelas</th>
                <th>Status</th>
                <th>Foto</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{tanggalPanjang(report.report_date)}</td>
                  <td>{report.child_name}</td>
                  <td>{report.class_name}</td>
                  <td>
                    {LABEL_STATUS[report.status] || report.status}
                    {report.deleted_at ? (
                      <span className="muted" style={{ display: "block", fontSize: 11 }}>
                        dihapus {report.deleted_by_name ? `oleh ${report.deleted_by_name}` : ""}
                      </span>
                    ) : null}
                  </td>
                  <td>{Number(report.photo_count) || 0}</td>
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {report.deleted_at ? (
                      <button type="button" className="btn" disabled={sibuk} onClick={() => void pulihkan(report)}>
                        Pulihkan
                      </button>
                    ) : (
                      <>
                        <Link className="btn" href={`/daily-reports/buat?id=${report.id}`}>
                          {report.status === "draft" ? "Edit" : "Buka"}
                        </Link>
                        {report.status === "published" && !report.deleted_at ? (
                          <a className="btn secondary" href={`/api/dokumen/laporan/${report.id}/pdf`} target="_blank" rel="noreferrer">
                            PDF
                          </a>
                        ) : null}
                        {report.status === "draft" ? (
                          <>
                            <button type="button" className="btn" disabled={sibuk} onClick={() => void kirim(report)}>
                              Kirim
                            </button>
                            <button type="button" className="btn btn-danger" disabled={sibuk} onClick={() => setHapus(report)}>
                              Hapus
                            </button>
                          </>
                        ) : null}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {hapus ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="judul-hapus"
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
            display: "grid", placeItems: "center", zIndex: 60, padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 440, width: "100%" }}>
            <h2 id="judul-hapus">Hapus draft laporan?</h2>
            <p>
              Draft untuk <strong>{hapus.child_name}</strong> tanggal{" "}
              <strong>{tanggalPanjang(hapus.report_date)}</strong> akan dihapus.
              Super Admin masih bisa memulihkannya dari filter Sampah.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn" disabled={sibuk} onClick={() => setHapus(null)}>
                Batal
              </button>
              <button type="button" className="btn btn-danger" disabled={sibuk} onClick={() => void konfirmasiHapus()}>
                {sibuk ? "Menghapus…" : "Ya, hapus"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function KartuUnduhMassalLaporan() {
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [kelas, setKelas] = useState("");
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => {
    fetch("/api/academic").then((r) => r.json()).then((d) => (d.ok ? setClasses(d.classes || []) : null)).catch(() => null);
  }, []);
  return (
    <article className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>Unduh Massal per Kelas &amp; Tanggal</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Semua laporan <strong>terbit</strong> satu kelas pada satu tanggal digabungkan menjadi satu berkas PDF (urutan nama anak).
      </p>
      <div className="row" style={{ gap: 10, alignItems: "end", flexWrap: "wrap" }}>
        <div className="field" style={{ minWidth: 220 }}>
          <label htmlFor="massal-kelas">Kelas</label>
          <select id="massal-kelas" value={kelas} onChange={(e) => setKelas(e.target.value)}>
            <option value="">— Pilih kelas —</option>
            {classes.map((k) => (<option key={k.id} value={k.id}>{k.name}</option>))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="massal-tanggal">Tanggal</label>
          <input id="massal-tanggal" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </div>
        {kelas && tanggal ? (
          <a className="btn" href={`/api/dokumen/laporan/massal?kelas=${kelas}&tanggal=${tanggal}`}>Unduh PDF Gabungan</a>
        ) : (
          <button type="button" className="btn" disabled>Unduh PDF Gabungan</button>
        )}
      </div>
    </article>
  );
}
