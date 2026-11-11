"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { LABEL_ARAH, LABEL_HASIL_SAM } from "@/lib/filter-arah";
import { tanggalPendek } from "@/lib/format";

type FormRow = {
  id: string;
  child_name: string | null;
  parent_name: string | null;
  program_pilihan: string | null;
  arah_rekomendasi: string | null;
  arah_keyakinan: string | null;
  arah_berbeda: boolean;
  sam_hasil: string | null;
  acc_status: string;
  acc_nama: string | null;
  updated_at: string;
};

export default function DaftarFormulirTrialPage() {
  const [forms, setForms] = useState<FormRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admission/trial")
      .then((r) => r.json())
      .then((d) => (d.ok ? setForms(d.forms) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  useEffect(load, [load]);

  if (error && !forms) return (<><PageHead title="Formulir Trial" /><ErrorState message={error} /></>);
  if (!forms) return (<><PageHead title="Formulir Trial" /><LoadingState /></>);

  return (
    <>
      <PageHead
        title="Formulir Trial"
        subtitle="Formulir pendaftaran dengan Filter Arah transparan, Filter SAM dua sisi, dan ACC guru program"
        action={<Link className="btn" href="/admission/trial/baru">+ Formulir Baru</Link>}
      />
      <p style={{ marginTop: 0 }}>
        <Link href="/admission">← Kembali ke pipeline Admission</Link>
      </p>
      {forms.length === 0 ? (
        <EmptyState
          title="Belum ada Formulir Trial"
          body="Buat formulir untuk lead yang sudah masuk pipeline. Filter Arah berjalan otomatis dari isian formulir."
        />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Anak</th><th>Orang tua</th><th>Pilihan</th><th>Rekomendasi Filter Arah</th><th>Filter SAM</th><th>ACC</th><th>Terakhir diubah</th><th></th></tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.child_name || "-"}</strong></td>
                  <td>{f.parent_name || "-"}</td>
                  <td>{f.program_pilihan || "-"}</td>
                  <td>
                    {f.arah_rekomendasi ? (
                      <>
                        {LABEL_ARAH[f.arah_rekomendasi as keyof typeof LABEL_ARAH] || f.arah_rekomendasi}
                        <div className="muted">Keyakinan: {f.arah_keyakinan || "-"}</div>
                        {f.arah_berbeda ? <span className="badge warn">Berbeda dari pilihan orang tua</span> : null}
                      </>
                    ) : "-"}
                  </td>
                  <td>{f.sam_hasil ? LABEL_HASIL_SAM[f.sam_hasil as keyof typeof LABEL_HASIL_SAM] || f.sam_hasil : "-"}</td>
                  <td>
                    {f.acc_status === "menunggu" ? (
                      <span className="badge warn">Menunggu ACC</span>
                    ) : (
                      <span className="badge ok">{f.acc_status === "disetujui" ? "Disetujui" : "Disetujui bersyarat"}{f.acc_nama ? ` · ${f.acc_nama}` : ""}</span>
                    )}
                  </td>
                  <td>{tanggalPendek(f.updated_at)}</td>
                  <td><Link className="btn small secondary" href={`/admission/trial/${f.id}`}>Buka</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
