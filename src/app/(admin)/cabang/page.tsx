"use client";

import Link from "next/link";
import { PageHead } from "@/components/chrome";
import { ApiError, DataSection, KpiGrid, useApi, type AnyRow } from "@/components/module-ui";

type Mods = { branchesAgg: AnyRow[] };
type Counts = { counts: Record<string, number> };

export default function CabangPage() {
  const mods = useApi<Mods>("/api/modules");
  const counts = useApi<Counts>("/api/counts?tables=branch_capital,branches,children,staff");
  const error = mods.error || counts.error;
  const totalChildren = mods.data ? mods.data.branchesAgg.reduce((s, b) => s + Number(b.children || 0), 0) : 0;

  return (
    <>
      <PageHead title="Cabang" subtitle="Cabang, modal investor per cabang, dan kinerja cabang" action={<Link className="btn" href="/anak/tambah">Tambah Cabang (Data Awal)</Link>} />
      <ApiError error={error} />
      <KpiGrid items={[
        { label: "Total Cabang", value: counts.data ? counts.data.counts.branches : "...", icon: "▣", tone: "tone-sky" },
        { label: "Total Anak Semua Cabang", value: mods.data ? totalChildren : "...", icon: "☺", tone: "tone-sage" },
        { label: "Total Staf Semua Cabang", value: counts.data ? counts.data.counts.staff : "...", icon: "⚑", tone: "tone-pink" },
        { label: "Catatan Modal Cabang", value: counts.data ? counts.data.counts.branch_capital : "...", icon: "▦", tone: "tone-peach" },
      ]} />
      <DataSection
        title="Kinerja per Cabang"
        rows={mods.data ? mods.data.branchesAgg : null}
        emptyTitle="Belum ada cabang"
        emptyBody="Buat cabang pertama lewat panel Data Awal. Setiap data operasional terikat branch_id, sehingga angka per cabang di sini selalu hasil hitung dari data asli."
        columns={[
          { key: "name", label: "Cabang", render: (r) => <strong>{String(r.name)}</strong> },
          { key: "code", label: "Kode" },
          { key: "city", label: "Kota" },
          { key: "children", label: "Anak" },
          { key: "staff", label: "Staf" },
          { key: "classes", label: "Kelas" },
        ]}
      />
      <p className="notice">Modal dan bagi hasil investor per cabang tercatat sebagai data di tabel branch_capital, bukan konstanta di kode, dan diringkas agregat di halaman Investor.</p>
    </>
  );
}
