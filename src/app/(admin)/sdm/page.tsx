"use client";

import { useEffect, useState } from "react";
import { PageHead, StatusBadge } from "@/components/chrome";
import { ApiError, DataSection, KpiGrid, dateFmt, useApi, type AnyRow } from "@/components/module-ui";

type Hr = { staff: AnyRow[]; leaves: AnyRow[]; attendanceToday: number };

export default function SdmPage() {
  const { data, error, reload } = useApi<Hr>("/api/hr");
  const [decider, setDecider] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && data.staff.length > 0) setDecider((p) => p || String(data.staff[0].id));
  }, [data]);

  async function putuskan(leaveId: string, decision: "disetujui" | "ditolak") {
    if (!decider) { setFeedback("Pilih staf pemutus dulu."); return; }
    setBusy(true);
    const res = await fetch("/api/hr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "putuskan_cuti", leave_id: leaveId, decided_by: decider, decision }) });
    const d = await res.json();
    setBusy(false);
    setFeedback(d.ok ? `Permintaan cuti kini berstatus ${d.status}.` : d.error);
    if (d.ok) reload();
  }

  const pending = data ? data.leaves.filter((l) => l.status === "menunggu").length : 0;

  return (
    <>
      <PageHead title="SDM" subtitle="Data staf, kehadiran, cuti, KPI, rekrutmen, dan onboarding" />
      <ApiError error={error} />
      <KpiGrid items={[
        { label: "Total Staf & Guru", value: data ? data.staff.length : "...", icon: "⚑", tone: "tone-pink" },
        { label: "Cuti Menunggu Keputusan", value: data ? pending : "...", icon: "✎", tone: "tone-peach" },
        { label: "Kehadiran Staf Hari Ini", value: data ? data.attendanceToday : "...", icon: "✓", tone: "tone-sage" },
        { label: "Total Permintaan Cuti", value: data ? data.leaves.length : "...", icon: "▤", tone: "tone-sky" },
      ]} />
      <article className="card">
        <h2>Persetujuan Cuti / Izin / Lembur</h2>
        <div className="row">
          <span className="muted">Diputuskan oleh:</span>
          <select value={decider} onChange={(e) => setDecider(e.target.value)} aria-label="Staf pemutus cuti">
            <option value="">Pilih staf</option>
            {(data?.staff || []).map((s) => (<option key={String(s.id)} value={String(s.id)}>{String(s.full_name)} · {String(s.position)}</option>))}
          </select>
        </div>
        {feedback ? <p className="notice" role="status" style={{ marginTop: 10 }}>{feedback}</p> : null}
      </article>
      <DataSection
        title="Permintaan Cuti Terbaru"
        rows={data ? data.leaves : null}
        emptyTitle="Belum ada permintaan cuti"
        emptyBody="Permintaan cuti, izin, dan lembur dari tabel leave_requests tampil di sini untuk diputuskan."
        columns={[
          { key: "staff_name", label: "Staf", render: (r) => <strong>{String(r.staff_name)}</strong> },
          { key: "kind", label: "Jenis" },
          { key: "start_date", label: "Mulai", render: (r) => dateFmt(r.start_date) },
          { key: "end_date", label: "Selesai", render: (r) => dateFmt(r.end_date) },
          { key: "reason", label: "Alasan" },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: "aksi", label: "", render: (r) => r.status === "menunggu" ? (
            <span className="row">
              <button className="btn small" disabled={busy} onClick={() => putuskan(String(r.id), "disetujui")}>Setujui</button>
              <button className="btn small danger" disabled={busy} onClick={() => putuskan(String(r.id), "ditolak")}>Tolak</button>
            </span>
          ) : <span className="muted">Sudah diputuskan</span> },
        ]}
      />
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
    </>
  );
}
