"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";
import { ApiError, DataSection, KpiGrid, dateFmt, rupiahFmt, useApi, type AnyRow } from "@/components/module-ui";

type Meta = { programs: AnyRow[]; classes: AnyRow[] };
type Mods = { cycles: AnyRow[] };
type Counts = { counts: Record<string, number> };

export default function AkademikPage() {
  const meta = useApi<Meta>("/api/meta");
  const mods = useApi<Mods>("/api/modules");
  const counts = useApi<Counts>("/api/counts?tables=stppa_assessments,learning_cycles,programs,classes");
  const error = meta.error || mods.error || counts.error;
  const programName = new Map((meta.data?.programs || []).map((p) => [String(p.id), String(p.name)]));

  return (
    <>
      <PageHead title="Akademik" subtitle="Program, kelas, siklus belajar, dan checklist STPPA" action={<Link className="btn" href="/anak/tambah">Kelola Data Awal</Link>} />
      <ApiError error={error} />
      <KpiGrid items={[
        { label: "Program", value: counts.data ? counts.data.counts.programs : "...", icon: "▤", tone: "tone-sky" },
        { label: "Kelas", value: counts.data ? counts.data.counts.classes : "...", icon: "▦", tone: "tone-sage" },
        { label: "Siklus Belajar", value: counts.data ? counts.data.counts.learning_cycles : "...", icon: "↻", tone: "tone-lavender" },
        { label: "Penilaian STPPA", value: counts.data ? counts.data.counts.stppa_assessments : "...", icon: "✓", tone: "tone-peach" },
      ]} />
      <DataSection
        title="Program"
        rows={meta.data ? meta.data.programs : null}
        emptyTitle="Belum ada program"
        emptyBody="Buat program pertama (beserta tarif SPP) lewat panel Data Awal di halaman Tambah Anak."
        columns={[
          { key: "code", label: "Kode" },
          { key: "name", label: "Nama Program", render: (r) => <strong>{String(r.name)}</strong> },
          { key: "monthly_fee", label: "SPP / Bulan", render: (r) => (r.monthly_fee ? rupiahFmt(Number(r.monthly_fee)) : "-") },
        ]}
      />
      <DataSection
        title="Kelas"
        rows={meta.data ? meta.data.classes : null}
        emptyTitle="Belum ada kelas"
        emptyBody="Buat kelas setelah cabang dan program tersedia, lewat panel Data Awal."
        columns={[
          { key: "name", label: "Nama Kelas", render: (r) => <strong>{String(r.name)}</strong> },
          { key: "program_id", label: "Program", render: (r) => programName.get(String(r.program_id)) || "-" },
        ]}
      />
      <DataSection
        title="Siklus Belajar"
        rows={mods.data ? mods.data.cycles : null}
        emptyTitle="Belum ada siklus belajar"
        emptyBody="Siklus belajar (tema + rentang tanggal per kelas) dicatat di tabel learning_cycles dan menjadi payung penilaian STPPA per siklus."
        columns={[
          { key: "theme", label: "Tema", render: (r) => <strong>{String(r.theme)}</strong> },
          { key: "start_date", label: "Mulai", render: (r) => dateFmt(r.start_date) },
          { key: "end_date", label: "Selesai", render: (r) => dateFmt(r.end_date) },
        ]}
      />
    </>
  );
}
