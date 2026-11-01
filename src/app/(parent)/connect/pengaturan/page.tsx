"use client";

import { useEffect, useState } from "react";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { childAgeLabel, useConnect } from "@/lib/use-connect";

const PREFS = [
  ["notif_laporan", "Notifikasi laporan harian terbit"],
  ["notif_kegiatan", "Pengingat kegiatan & RSVP"],
  ["notif_tagihan", "Pengingat tagihan"],
  ["newsletter", "Buletin sekolah bulanan"],
] as const;

export default function ConnectPengaturanPage() {
  const { data, error } = useConnect();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ notif_laporan: true, notif_kegiatan: true, notif_tagihan: true, newsletter: false });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("bc-parent-prefs");
      if (raw) setPrefs((prev) => ({ ...prev, ...(JSON.parse(raw) as Record<string, boolean>) }));
    } catch { /* abaikan */ }
  }, []);

  function save() {
    try {
      window.localStorage.setItem("bc-parent-prefs", JSON.stringify(prefs));
    } catch { /* abaikan */ }
    setSaved(true);
  }

  if (error) return (<><PageHead title="Pengaturan" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Pengaturan" /><LoadingState /></>);
  const child = data.child;

  return (
    <>
      <PageHead title="Pengaturan" subtitle="Profil anak dan preferensi notifikasi Anda" />
      <section className="grid two">
        <article className="card">
          <h2>Profil Anak Terhubung</h2>
          {child ? (
            <dl>
              <dt className="muted">Nama</dt><dd><strong>{String(child.full_name)}</strong></dd>
              <dt className="muted">Nama panggilan</dt><dd>{String(child.nickname || "-")}</dd>
              <dt className="muted">Usia</dt><dd>{childAgeLabel(child.birth_date)}</dd>
              <dt className="muted">Golongan darah</dt><dd>{String(child.blood_type || "-")}</dd>
              <dt className="muted">Izin foto &amp; video</dt><dd>{child.photo_consent ? "Diizinkan" : "Tidak diizinkan"}</dd>
            </dl>
          ) : (<p className="muted">Belum ada anak terhubung pada konteks demo ini.</p>)}
          <p className="notice">Di paket ini portal membaca anak pertama menurut abjad sebagai konteks demo. Produksi wajib memetakan akun orang tua ke anaknya sendiri dan perubahan profil dilakukan lewat admin sekolah.</p>
        </article>
        <article className="card">
          <h2>Preferensi Notifikasi</h2>
          {PREFS.map(([key, label]) => (
            <div className="field" key={key} style={{ marginBottom: 10 }}>
              <label>
                <input type="checkbox" checked={!!prefs[key]} onChange={(e) => { setPrefs({ ...prefs, [key]: e.target.checked }); setSaved(false); }} /> {label}
              </label>
            </div>
          ))}
          <button className="btn" onClick={save}>Simpan Preferensi</button>
          {saved ? <p className="success" role="status" style={{ marginTop: 10 }}>Preferensi tersimpan di peramban ini.</p> : null}
          <p className="hint muted" style={{ marginTop: 8 }}>Preferensi disimpan lokal sebagai demo; pengiriman notifikasi sungguhan memerlukan kanal WhatsApp/email yang belum tersambung.</p>
        </article>
      </section>
    </>
  );
}
