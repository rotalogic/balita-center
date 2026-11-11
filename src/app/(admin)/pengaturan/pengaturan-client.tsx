"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHead, StatusBadge } from "@/components/chrome";
import { ApiError, DataSection, KpiGrid, dateFmt, useApi, type AnyRow } from "@/components/module-ui";

type Mods = { users: AnyRow[]; rolesAgg: AnyRow[]; audit: AnyRow[] };

export function PengaturanClient({ bagian }: { bagian?: string }) {
  const mods = useApi<Mods>("/api/modules");
  const counts = useApi<{ counts: Record<string, number> }>("/api/counts?tables=users,roles,permissions,audit_logs");
  const storage = useApi<{ driver: string; label: string; peringatan: string | null; bucket: string | null }>("/api/storage");
  const error = mods.error || counts.error || storage.error;

  return (
    <>
      <PageHead title="Pengaturan" subtitle="Pengguna, peran & izin RBAC, cabang, dan jejak audit" action={<Link className="btn secondary" href="/login">Buka Layar Login</Link>} />
      <ApiError error={error} />
      <nav aria-label="Kamar-kamar Pengaturan" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <a className={bagian === "identitas" ? "btn" : "btn secondary"} href="/pengaturan/identitas">Identitas Sekolah</a>
        <a className={bagian === "status" ? "btn" : "btn secondary"} href="/pengaturan/status">Status Konfigurasi</a>
        <a className={bagian === "akses" ? "btn" : "btn secondary"} href="/pengaturan/akses">Peran & Pengguna</a>
        <a className={bagian === "audit" ? "btn" : "btn secondary"} href="/pengaturan/audit">Jejak Audit</a>
        <a className={bagian === "penyimpanan" ? "btn" : "btn secondary"} href="/pengaturan/penyimpanan">Penyimpanan Foto</a>
      </nav>
      {(!bagian || bagian === "identitas") && (<>
      <KartuIdentitas />
      </>)}
      {(!bagian || bagian === "status") && (<>
      <KartuStatus />
      </>)}
      <KpiGrid items={[
        { label: "Pengguna", value: counts.data ? counts.data.counts.users : "...", icon: "☺", tone: "tone-sky" },
        { label: "Peran RBAC", value: counts.data ? counts.data.counts.roles : "...", icon: "⚑", tone: "tone-sage" },
        { label: "Izin", value: counts.data ? counts.data.counts.permissions : "...", icon: "✓", tone: "tone-peach" },
        { label: "Jejak Audit", value: counts.data ? counts.data.counts.audit_logs : "...", icon: "▤", tone: "tone-lavender" },
      ]} />
      {(!bagian || bagian === "akses") && (<>
      <DataSection
        title="Peran & Pemetaan Izin"
        rows={mods.data ? mods.data.rolesAgg : null}
        emptyTitle="Seed RBAC belum terpasang"
        emptyBody="Peran dan izin berasal dari seed file SQL (10 peran, 23 izin, 105 pemetaan). Bila kosong, file SQL belum dijalankan di database ini."
        columns={[
          { key: "name", label: "Peran", render: (r) => <strong>{String(r.name)}</strong> },
          { key: "code", label: "Kode" },
          { key: "permission_count", label: "Jumlah Izin" },
          { key: "user_count", label: "Pengguna Terpetakan" },
        ]}
      />
      <DataSection
        title="Pengguna"
        rows={mods.data ? mods.data.users : null}
        emptyTitle="Belum ada pengguna"
        emptyBody="Akun pengguna dibuat saat autentikasi sungguhan diaktifkan. Paket ini belum membuat akun awal atau kata sandi bawaan."
        columns={[
          { key: "full_name", label: "Nama", render: (r) => <strong>{String(r.full_name)}</strong> },
          { key: "email", label: "Email" },
          { key: "role", label: "Peran Akun" },
          { key: "is_active", label: "Aktif", render: (r) => <StatusBadge status={r.is_active ? "aktif" : "revisi"} /> },
        ]}
      />
      </>)}

      {(!bagian || bagian === "audit") && (<>
      <article className="card">
        <h2 style={{ marginTop: 0 }}>Jejak Audit</h2>
        <p style={{ margin: "0 0 10px" }}>
          Tercatat <strong>{counts.data ? counts.data.counts.audit_logs : "…"}</strong> entri. Untuk menyelidiki siapa
          melakukan apa, gunakan halaman Jejak Audit (jam WIB, filter aktor/aksi/entitas/tanggal, ekspor CSV).
        </p>
        <a className="btn" href="/audit">Buka Jejak Audit</a>
      </article>
      </>)}

      {(!bagian || bagian === "penyimpanan") && (<>
      <article className="card">
        <h2 style={{ marginTop: 0 }}>Penyimpanan Foto</h2>
        <p style={{ margin: "0 0 6px" }}>
          Driver aktif: <strong>{storage.data ? storage.data.driver : "..."}</strong>
          {storage.data ? <span className="muted"> — {storage.data.label}</span> : null}
        </p>
        <p className={storage.data?.driver === "lokal" ? "notice" : "muted"} style={{ margin: 0 }}>
          {storage.data?.peringatan ||
            "Foto disimpan di object storage (S3/R2). Verifikasi dengan mengunggah satu foto di Daily Report lalu membukanya kembali."}
        </p>
      </article>
      </>)}
      <p className="success">Login kata sandi aktif (scrypt), sesi cookie httpOnly, RBAC ditegakkan di server pada setiap API, dan pendaftaran baru menunggu persetujuan Super Admin. Kata sandi bisa direset lewat tautan sekali pakai dari menu Pengguna, serta 2FA TOTP tersedia di halaman Akun.</p>
    </>
  );
}

type Identitas = {
  nama: string; tagline: string; alamat: string | null; telepon: string | null; email: string | null; logo_url: string | null;
  nama_yayasan: string; nama_gabungan: string; tagline_gabungan: string;
  visi: string | null; misi: string | null; motto: string | null; warna_zkc: string; warna_sam: string;
};
type BarisStatus = { kunci: string; label: string; ok: boolean; keterangan: string };

function KartuIdentitas() {
  const [form, setForm] = useState<Identitas | null>(null);
  const [sibuk, setSibuk] = useState("");
  const [info, setInfo] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/pengaturan")
      .then((r) => r.json())
      .then((d) => (d.ok ? setForm(d.identitas) : null))
      .catch(() => null);
  }, []);

  async function simpan() {
    if (!form) return;
    setSibuk("simpan");
    setInfo(null);
    const r = await fetch("/api/pengaturan", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const d = await r.json();
    setSibuk("");
    setInfo(d.ok ? { ok: true, text: d.pesan || "Tersimpan." } : { ok: false, text: d.error || "Gagal menyimpan." });
  }

  async function unggahLogo(file: File | null) {
    if (!file) return;
    setSibuk("logo");
    setInfo(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/pengaturan/logo", { method: "POST", body: fd });
    const d = await r.json();
    setSibuk("");
    if (d.ok) {
      setForm((f) => (f ? { ...f, logo_url: d.url } : f));
      setInfo({ ok: true, text: "Logo tersimpan." });
    } else setInfo({ ok: false, text: d.error || "Gagal mengunggah logo." });
  }

  if (!form) return (<article className="card"><h2 style={{ marginTop: 0 }}>Identitas Sekolah</h2><p className="muted">Memuat…</p></article>);
  const set = (k: keyof Identitas) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <article className="card">
      <h2 style={{ marginTop: 0 }}>Identitas Sekolah</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Nama, tagline, dan kontak ini tampil di kop dokumen resmi — rapor, tagihan SPP, dan kwitansi —
        menggantikan teks bawaan. Perubahan berlaku untuk dokumen yang dibuat sesudahnya.
      </p>
      <div className="form-grid">
        <div className="field"><label htmlFor="id-nama">Nama Sekolah *</label>
          <input id="id-nama" value={form.nama} onChange={set("nama")} /></div>
        <div className="field"><label htmlFor="id-tagline">Tagline</label>
          <input id="id-tagline" value={form.tagline} onChange={set("tagline")} /></div>
        <div className="field"><label htmlFor="id-telepon">Telepon / WhatsApp</label>
          <input id="id-telepon" value={form.telepon || ""} onChange={set("telepon")} placeholder="mis. 0812-3456-7890" /></div>
        <div className="field"><label htmlFor="id-email">Email Resmi</label>
          <input id="id-email" value={form.email || ""} onChange={set("email")} placeholder="halo@sekolah.sch.id" /></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="id-alamat">Alamat</label>
          <input id="id-alamat" value={form.alamat || ""} onChange={set("alamat")} placeholder="Jalan, nomor, kota" /></div>
      </div>
      <h3 style={{ margin: "18px 0 4px" }}>Kop Resmi Tiga Baris</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Susunan terkunci pada kop sistem, kop laporan, kop surat, dan kepala website:
        baris yayasan, nama gabungan dua rumah, lalu tagline gabungan dalam satu baris.
      </p>
      <div className="form-grid">
        <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="id-yayasan">Baris 1 — Yayasan</label>
          <input id="id-yayasan" value={form.nama_yayasan} onChange={set("nama_yayasan")} /></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="id-gabungan">Baris 2 — Nama Gabungan</label>
          <input id="id-gabungan" value={form.nama_gabungan} onChange={set("nama_gabungan")} /></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="id-tagline-gabungan">Baris 3 — Tagline Gabungan</label>
          <input id="id-tagline-gabungan" value={form.tagline_gabungan} onChange={set("tagline_gabungan")} /></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="id-visi">Visi Lembaga</label>
          <textarea id="id-visi" rows={2} value={form.visi || ""} onChange={set("visi")} /></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="id-misi">Misi Lembaga (satu butir per baris)</label>
          <textarea id="id-misi" rows={3} value={form.misi || ""} onChange={set("misi")} /></div>
        <div className="field"><label htmlFor="id-motto">Motto Yayasan</label>
          <input id="id-motto" value={form.motto || ""} onChange={set("motto")} /></div>
        <div className="field"><label htmlFor="id-warna-zkc">Warna Ziel Kids Club (cokelat natural)</label>
          <input id="id-warna-zkc" type="color" value={form.warna_zkc || "#8A6844"} onChange={set("warna_zkc")} /></div>
        <div className="field"><label htmlFor="id-warna-sam">Warna Sekolah Alam Montessori (hijau natural)</label>
          <input id="id-warna-sam" type="color" value={form.warna_sam || "#4F7A54"} onChange={set("warna_sam")} /></div>
      </div>
      <div className="row" style={{ alignItems: "center", gap: 14, marginTop: 10 }}>
        {form.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.logo_url} alt="Logo sekolah" style={{ height: 54, maxWidth: 180, objectFit: "contain", background: "#faf7f2", borderRadius: 8, padding: 6 }} />
        ) : (<span className="muted">Belum ada logo.</span>)}
        <label className="btn secondary" style={{ cursor: "pointer" }}>
          {sibuk === "logo" ? "Mengunggah…" : "Unggah Logo"}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void unggahLogo(e.target.files?.[0] || null)} />
        </label>
        <button type="button" className="btn" disabled={sibuk === "simpan"} onClick={() => void simpan()}>{sibuk === "simpan" ? "Menyimpan…" : "Simpan Identitas"}</button>
      </div>
      {info ? <p className={info.ok ? "notice ok" : "notice"} role="status" style={{ marginTop: 10 }}>{info.text}</p> : null}
    </article>
  );
}

function KartuStatus() {
  const [baris, setBaris] = useState<BarisStatus[] | null>(null);
  useEffect(() => {
    fetch("/api/pengaturan")
      .then((r) => r.json())
      .then((d) => (d.ok ? setBaris(d.status) : null))
      .catch(() => null);
  }, []);
  return (
    <article className="card">
      <h2 style={{ marginTop: 0 }}>Status Konfigurasi</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Keadaan sambungan dan kunci yang menentukan fitur berjalan atau menunggu — nilai kunci tidak pernah ditampilkan.
      </p>
      {!baris ? <p className="muted">Memuat…</p> : (
        <div className="table-wrap">
          <table>
            <tbody>
              {baris.map((b) => (
                <tr key={b.kunci}>
                  <td style={{ width: 230 }}><strong>{b.label}</strong></td>
                  <td style={{ width: 110 }}><span className={b.ok ? "badge ok" : "badge warn"}>{b.ok ? "Siap" : "Perlu perhatian"}</span></td>
                  <td className="muted">{b.keterangan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
