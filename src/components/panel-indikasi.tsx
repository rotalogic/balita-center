"use client";

import { useEffect, useState } from "react";

type Kelompok = {
  kelompok: string;
  ambang_tercapai: boolean;
  indikator: string[];
  catatan: string[];
};

type DataIndikasi = {
  ada: boolean;
  skrining_id?: string;
  jenis_label?: string;
  status?: string;
  tahap?: number;
  kelompok?: Kelompok[];
  rujukan_aktif?: number;
};

// Ringkasan indikasi skrining terakhir di berkas anak (Tur Demo Layar 2):
// status pemetaan selalu tampil di kepala berkas, lengkapnya tetap di
// modul Skrining. Bahasa non-diagnostik dijaga di semua keadaan tampil.
export function PanelIndikasi({ childId }: { childId: string }) {
  const [data, setData] = useState<DataIndikasi | null>(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    let hidup = true;
    fetch(`/api/children/${childId}/indikasi`)
      .then((r) => r.json())
      .then((d) => {
        if (!hidup) return;
        if (d.ok) setData(d as DataIndikasi);
        else setGagal(true);
      })
      .catch(() => {
        if (hidup) setGagal(true);
      });
    return () => {
      hidup = false;
    };
  }, [childId]);

  if (gagal) return null;
  if (!data) {
    return (
      <article className="card" style={{ marginTop: 16 }}>
        <h2>Ringkasan Indikasi Skrining</h2>
        <p className="muted" style={{ margin: 0 }}>Memuat ringkasan…</p>
      </article>
    );
  }
  if (!data.ada) {
    return (
      <article className="card" style={{ marginTop: 16 }}>
        <h2>Ringkasan Indikasi Skrining</h2>
        <p className="muted" style={{ margin: 0 }}>
          Anak ini belum memiliki layanan skrining. Ringkasan pemetaan indikasi tampil di sini
          setelah skrining berjalan, dan tidak ada label diagnosis di berkas ini.
        </p>
      </article>
    );
  }

  const kelompok = data.kelompok || [];
  return (
    <article className="card" style={{ marginTop: 16 }}>
      <div className="row spread">
        <h2 style={{ margin: 0 }}>Ringkasan Indikasi Skrining</h2>
        <a href={`/skrining/${data.skrining_id}`}>Buka skrining lengkap</a>
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        {data.jenis_label} · status {String(data.status || "").replace(/_/g, " ")}
        {data.tahap ? ` · tahap ${data.tahap} dari 5` : ""}
        {typeof data.rujukan_aktif === "number" && data.rujukan_aktif > 0
          ? ` · ${data.rujukan_aktif} berkas rujukan aktif`
          : ""}
        . Bahasa pemetaan, bukan diagnosis.
      </p>
      {kelompok.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Pemetaan indikasi belum diisi pemeriksa pada Tahap 4 skrining ini.
        </p>
      ) : (
        <div className="grid two">
          {kelompok.map((k) => (
            <div key={k.kelompok} style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
              <div className="row spread">
                <strong>{k.kelompok}</strong>
                <span className={k.ambang_tercapai ? "badge warn" : "badge ok"}>
                  {k.ambang_tercapai ? "Ambang Tercapai" : "Dalam Pemantauan"}
                </span>
              </div>
              {k.catatan.length > 0 ? (
                <div className="muted">{k.catatan.join(" · ")}</div>
              ) : k.indikator.length > 0 ? (
                <div className="muted">{k.indikator.join(" · ")}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
