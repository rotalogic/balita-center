"use client";

import { PageHead } from "@/components/chrome";
import { ApiError, KpiGrid, rupiahFmt, useApi, type AnyRow } from "@/components/module-ui";

type Mods = { branchesAgg: AnyRow[]; cashIn: number; cashOut: number };
type Counts = { counts: Record<string, number> };

export default function InvestorPage() {
  const mods = useApi<Mods>("/api/modules");
  const counts = useApi<Counts>("/api/counts?tables=branch_capital,children,staff,branches");
  const error = mods.error || counts.error;
  const net = mods.data ? mods.data.cashIn - mods.data.cashOut : 0;

  return (
    <>
      <PageHead title="Investor" subtitle="Kinerja agregat lintas cabang untuk investor" />
      <ApiError error={error} />
      <KpiGrid items={[
        { label: "Cabang", value: counts.data ? counts.data.counts.branches : "...", icon: "▣", tone: "tone-sky" },
        { label: "Total Anak (agregat)", value: counts.data ? counts.data.counts.children : "...", icon: "☺", tone: "tone-sage" },
        { label: "Total Staf (agregat)", value: counts.data ? counts.data.counts.staff : "...", icon: "⚑", tone: "tone-pink" },
        { label: "Catatan Modal", value: counts.data ? counts.data.counts.branch_capital : "...", icon: "▦", tone: "tone-peach" },
      ]} />
      <section className="grid three">
        <article className="card"><h2>Arus Kas Masuk (total)</h2><div className="kpi-value" style={{ fontSize: 24 }}>{mods.data ? rupiahFmt(mods.data.cashIn) : "..."}</div></article>
        <article className="card"><h2>Arus Kas Keluar (total)</h2><div className="kpi-value" style={{ fontSize: 24 }}>{mods.data ? rupiahFmt(mods.data.cashOut) : "..."}</div></article>
        <article className="card"><h2>Arus Kas Bersih</h2><div className="kpi-value" style={{ fontSize: 24 }}>{mods.data ? rupiahFmt(net) : "..."}</div></article>
      </section>
      <article className="card">
        <h2>Agregat per Cabang</h2>
        {mods.data ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cabang</th><th>Anak</th><th>Staf</th><th>Kelas</th></tr></thead>
              <tbody>
                {mods.data.branchesAgg.map((b) => (
                  <tr key={String(b.id)}><td><strong>{String(b.name)}</strong></td><td>{String(b.children)}</td><td>{String(b.staff)}</td><td>{String(b.classes)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="notice">Halaman investor hanya membaca agregat. Tidak ada nama anak, orang tua, atau data kesehatan yang dibuka di sini, sesuai batasan PRD.</p>
      </article>
    </>
  );
}
