"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { MODULES } from "../modul-config";

const TONES = ["tone-sky", "tone-pink", "tone-sage", "tone-peach"];

export default function ModulPage() {
  const params = useParams<{ modul: string }>();
  const config = MODULES[params.modul];
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    const tables = config.tables.map((t) => t.table).join(",");
    fetch(`/api/counts?tables=${encodeURIComponent(tables)}`)
      .then((r) => r.json())
      .then((d) => (d.ok ? setCounts(d.counts) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [config]);

  if (!config) {
    notFound();
  }

  return (
    <>
      <PageHead title={config.title} subtitle={config.subtitle} />
      <article className="card">
        <p style={{ marginTop: 0 }}>{config.description}</p>
        {config.note ? <p className="notice">{config.note}</p> : null}
        <div className="row">
          {config.links.map((link) => (
            <Link key={link.href + link.label} className="btn secondary" href={link.href}>{link.label}</Link>
          ))}
        </div>
      </article>
      {error ? <ErrorState message={error} /> : null}
      {!counts && !error ? <LoadingState /> : null}
      {counts ? (
        <section className="grid kpi" aria-label={`Data ${config.title}`}>
          {config.tables.map((t, i) => (
            <article className="card kpi-card" key={t.table}>
              <div className={`kpi-icon ${TONES[i % TONES.length]}`} aria-hidden="true">▦</div>
              <div className="kpi-label">{t.label}</div>
              <div className="kpi-value">{counts[t.table] ?? 0}</div>
              <div className="muted">baris di tabel {t.table}</div>
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}
