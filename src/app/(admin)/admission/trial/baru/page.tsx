"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import FormulirTrial from "@/components/formulir-trial";

type Lead = { id: string; child_name: string | null; parent_name: string | null; stage: string };

export default function FormulirTrialBaruPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [sudahAda, setSudahAda] = useState<Set<string>>(new Set());
  const [leadId, setLeadId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/admission").then((r) => r.json()),
      fetch("/api/admission/trial").then((r) => r.json()),
    ])
      .then(([a, t]) => {
        if (!a.ok) { setError(a.error); return; }
        setLeads(a.leads || []);
        if (t.ok) {
          setSudahAda(new Set((t.forms || []).map((f: { lead_id: string }) => f.lead_id)));
        }
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  useEffect(load, [load]);

  if (error && !leads) return (<><PageHead title="Formulir Trial Baru" /><ErrorState message={error} /></>);
  if (!leads) return (<><PageHead title="Formulir Trial Baru" /><LoadingState /></>);

  const tersedia = leads.filter((l) => !sudahAda.has(l.id) && l.stage !== "tidak_lanjut");

  return (
    <>
      <PageHead title="Formulir Trial Baru" subtitle="Pilih lead dari pipeline, lalu lengkapi formulirnya" />
      <p style={{ marginTop: 0 }}><Link href="/admission/trial">← Daftar Formulir Trial</Link></p>
      {tersedia.length === 0 ? (
        <EmptyState title="Tidak ada lead yang menunggu formulir" body="Semua lead aktif sudah memiliki Formulir Trial, atau pipeline masih kosong." />
      ) : (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="field">
              <label htmlFor="pilih_lead">Lead (anak · orang tua)</label>
              <select id="pilih_lead" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                <option value="">Pilih lead…</option>
                {tersedia.map((l) => (
                  <option key={l.id} value={l.id}>{l.child_name || "(anak belum bernama)"} · {l.parent_name || "-"}</option>
                ))}
              </select>
            </div>
          </div>
          {leadId ? <FormulirTrial key={leadId} leadId={leadId} /> : null}
        </>
      )}
    </>
  );
}
