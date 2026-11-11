"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHead, StatusBadge } from "@/components/chrome";
import { ApiError, DataSection, KpiGrid, dateFmt, useApi, type AnyRow } from "@/components/module-ui";

type Hr = { staff: AnyRow[]; leaves: AnyRow[]; attendanceToday: number };
type Leave = {
  requests: AnyRow[];
  counts: Record<string, number>;
  me: { id: string; full_name: string; branch_id: string | null } | null;
  staff: AnyRow[];
  canPickStaff: boolean;
};

export function SdmClient({ bagian }: { bagian?: string }) {
  const { data, error } = useApi<Hr>("/api/hr");
  const leave = useApi<Leave>("/api/hr/leave");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pemohon, setPemohon] = useState("");

  useEffect(() => {
    if (leave.data?.me) setPemohon((p) => p || leave.data!.me!.id);
  }, [leave.data]);

  async function ajukan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const el = event.currentTarget;
    const form = new FormData(el);
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/hr/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: String(form.get("kind") || ""),
          start_date: String(form.get("start_date") || ""),
          end_date: String(form.get("end_date") || ""),
          reason: String(form.get("reason") || ""),
          staff_id: pemohon || undefined,
        }),
      });
      const d = await res.json();
      setFeedback({
        ok: Boolean(d.ok),
        text: d.ok ? `Pengajuan atas nama ${d.staff_name} terkirim dan menunggu keputusan.` : d.error || "Gagal mengirim pengajuan.",
      });
      if (d.ok) {
        el.reset();
        leave.reload();
      }
    } catch {
      setFeedback({ ok: false, text: "Koneksi terputus — pengajuan belum terkirim." });
    } finally {
      setBusy(false);
    }
  }

  async function putuskan(leaveId: string, status: "disetujui" | "ditolak") {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/hr/leave/${leaveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await res.json();
      setFeedback({ ok: Boolean(d.ok), text: d.ok ? `Pengajuan kini berstatus ${d.status}.` : d.error || "Gagal memutuskan." });
      if (d.ok) leave.reload();
    } catch {
      setFeedback({ ok: false, text: "Koneksi terputus — keputusan belum tersimpan." });
    } finally {
      setBusy(false);
    }
  }

  const pending = leave.data?.counts.menunggu ?? 0;
  const bisaPilih = Boolean(leave.data?.canPickStaff) && (leave.data?.staff.length ?? 0) > 0;

  return (
    <>
      <PageHead title="SDM" subtitle="Data staf, kehadiran, cuti, KPI, rekrutmen, dan onboarding" />
      <ApiError error={error || leave.error} />
      <nav aria-label="Kamar-kamar SDM" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <a className={bagian === "staf" ? "btn" : "btn secondary"} href="/sdm/staf">Data Staf & Guru</a>
        <a className={bagian === "cuti" ? "btn" : "btn secondary"} href="/sdm/cuti">Cuti / Izin / Lembur</a>
        <a className="btn secondary" href="/sdm/kompetensi">Kompetensi Guru</a>
        <a className="btn secondary" href="/sdm/probation">Probation</a>
        <a className="btn secondary" href="/sdm/rekrutmen">Rekrutmen</a>
      </nav>
      <article className="card">
        <h2 style={{ marginTop: 0 }}>Perangkat SDM Lembaga</h2>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <a className="btn secondary" href="/sdm/kompetensi">Standar &amp; Kompetensi Guru</a>
          <a className="btn secondary" href="/sdm/probation">Masa Magang &amp; Probation</a>
          <a className="btn secondary" href="/sdm/rekrutmen">Rekrutmen Guru</a>
          <a className="btn secondary" href="/papan-poin">Papan Poin Guru</a>
          <a className="btn secondary" href="/peraturan">Peraturan &amp; Kesepakatan Bersama</a>
        </div>
      </article>
      <KpiGrid items={[
        { label: "Total Staf & Guru", value: data ? data.staff.length : "...", icon: "⚑", tone: "tone-pink" },
        { label: "Cuti Menunggu Keputusan", value: leave.data ? pending : "...", icon: "✎", tone: "tone-peach" },
        { label: "Kehadiran Staf Hari Ini", value: data ? data.attendanceToday : "...", icon: "✓", tone: "tone-sage" },
        { label: "Total Permintaan Cuti", value: leave.data ? leave.data.requests.length : "...", icon: "▤", tone: "tone-sky" },
      ]} />

      {(!bagian || bagian === "cuti") && (<>
      <article className="card">
        <h2>Ajukan Cuti / Izin / Lembur</h2>
        {leave.data && !leave.data.me ? (
          <div className="alert alert-error" role="alert" style={{ marginBottom: 12 }}>
            Akun Anda belum tertaut ke data staf, jadi pengajuan tidak bisa dibuat atas nama Anda.{" "}
            <Link href="/pengguna">Tautkan di menu Pengguna</Link> (Super Admin), lalu muat ulang halaman ini.
          </div>
        ) : null}
        <form onSubmit={ajukan}>
          <div className="form-grid">
            {bisaPilih ? (
              <div className="field">
                <label htmlFor="lv_staff">Diajukan untuk *</label>
                <select id="lv_staff" value={pemohon} onChange={(e) => setPemohon(e.target.value)}>
                  {leave.data!.staff.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {String(s.full_name)} · {String(s.position)} · {String(s.branch_name || "-")}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="field"><label htmlFor="lv_kind">Jenis *</label>
              <select id="lv_kind" name="kind" required defaultValue="cuti">
                <option value="cuti">Cuti</option>
                <option value="izin">Izin</option>
                <option value="lembur">Lembur</option>
              </select></div>
            <div className="field"><label htmlFor="lv_sd">Mulai *</label>
              <input id="lv_sd" name="start_date" type="date" required /></div>
            <div className="field"><label htmlFor="lv_ed">Selesai *</label>
              <input id="lv_ed" name="end_date" type="date" required /></div>
            <div className="field"><label htmlFor="lv_rs">Alasan</label>
              <input id="lv_rs" name="reason" placeholder="Keperluan keluarga" /></div>
          </div>
          <button className="btn small" type="submit" disabled={busy} style={{ marginTop: 8 }}>
            {busy ? "Mengirim…" : "Kirim Pengajuan"}
          </button>
          <p className="hint">
            {bisaPilih
              ? "Sebagai Kepala Sekolah/Admin Cabang Anda boleh mengajukan atas nama staf lain."
              : "Pengajuan tercatat atas nama akun yang login."}
          </p>
        </form>
      </article>

      <article className="card">
        <h2>Persetujuan Cuti / Izin / Lembur</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Keputusan tercatat atas nama akun Anda sendiri
          {leave.data?.me ? ` (${leave.data.me.full_name})` : ""} — tidak ada lagi pilih-pilih nama pemutus.
        </p>
        {feedback ? (
          <p className={feedback.ok ? "success" : "notice"} role="status" style={{ marginTop: 10 }}>
            {feedback.text}
          </p>
        ) : null}
        <div className="row" style={{ marginTop: 8 }}>
          <span className="badge">Menunggu: {pending}</span>
          <span className="badge">Disetujui: {leave.data?.counts.disetujui ?? 0}</span>
          <span className="badge">Ditolak: {leave.data?.counts.ditolak ?? 0}</span>
        </div>
      </article>

      <DataSection
        title="Permintaan Cuti Terbaru"
        rows={leave.data ? leave.data.requests : null}
        emptyTitle="Belum ada permintaan cuti"
        emptyBody="Permintaan cuti, izin, dan lembur yang diajukan staf tampil di sini untuk diputuskan."
        columns={[
          { key: "staff_name", label: "Staf", render: (r) => <strong>{String(r.staff_name)}</strong> },
          { key: "kind", label: "Jenis" },
          { key: "start_date", label: "Mulai", render: (r) => dateFmt(r.start_date) },
          { key: "end_date", label: "Selesai", render: (r) => dateFmt(r.end_date) },
          { key: "reason", label: "Alasan" },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: "decided_by_name", label: "Diputuskan", render: (r) => (r.decided_by_name ? String(r.decided_by_name) : <span className="muted">—</span>) },
          { key: "aksi", label: "", render: (r) => r.status === "menunggu" ? (
            <span className="row">
              <button className="btn small" disabled={busy} onClick={() => putuskan(String(r.id), "disetujui")}>Setujui</button>
              <button className="btn small danger" disabled={busy} onClick={() => putuskan(String(r.id), "ditolak")}>Tolak</button>
            </span>
          ) : <span className="muted">Sudah diputuskan</span> },
        ]}
      />

      </>)}

      {(!bagian || bagian === "staf") && (<>
      <DataSection
        title="Data Staf & Guru"
        rows={data ? data.staff : null}
        emptyTitle="Belum ada staf"
        emptyBody="Tambahkan staf pertama lewat panel Data Awal di halaman Tambah Anak."
        columns={[
          { key: "full_name", label: "Nama", render: (r) => <strong>{String(r.full_name)}</strong> },
          { key: "position", label: "Jabatan" },
          { key: "branch_name", label: "Cabang" },
          { key: "phone", label: "Telepon" },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status || "aktif")} /> },
        ]}
      />
      </>)}
    </>
  );
}
