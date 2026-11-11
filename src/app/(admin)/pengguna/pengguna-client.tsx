"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  organization_name: string | null;
  is_active: boolean;
  totp_enabled: boolean;
  created_at: string;
  last_login_wib: string | null;
  branch_names: string | null;
  staff_id: string | null;
  staff_name: string | null;
};
type Staff = { id: string; full_name: string; position: string | null; user_id: string | null };
type Role = { code: string; name: string; permission_count: number };
type Branch = { id: string; name: string };
type Data = { users: UserRow[]; roles: Role[]; branches: Branch[]; staff: Staff[] };

const STATUS_LABEL: Record<string, string> = {
  aktif: "Aktif",
  menunggu_persetujuan: "Menunggu persetujuan",
  nonaktif: "Nonaktif",
};

export function PenggunaClient({ bagian }: { bagian?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cari, setCari] = useState("");
  const [invite, setInvite] = useState({ full_name: "", email: "", role: "orang_tua", branch_id: "", organization_name: "" });
  const [activation, setActivation] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  useEffect(load, [load]);

  async function patch(id: string, payload: Record<string, unknown>, label: string) {
    setBusy(id);
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    setBusy(null);
    if (!d.ok) {
      setError(d.error || "Gagal menyimpan.");
      return;
    }
    setInfo(label);
    load();
  }

  async function buatTautan(id: string, kind: "reset" | "aktivasi") {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/users/${id}/reset-link`, { method: "POST" });
    const d = await res.json();
    setBusy(null);
    if (!d.ok) {
      setError(d.error || "Gagal membuat tautan.");
      return;
    }
    setActivation(d.reset_url);
    setInfo(`Tautan ${kind} untuk ${d.email} berlaku ${d.expires_minutes} menit.`);
  }

  async function undang(event: React.FormEvent) {
    event.preventDefault();
    setBusy("invite");
    setError(null);
    setActivation(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invite),
    });
    const d = await res.json();
    setBusy(null);
    if (!d.ok) {
      setError(d.error || "Gagal mengundang.");
      return;
    }
    setActivation(d.activation_url);
    setInfo(`Undangan dibuat untuk ${invite.email}. Kirim tautan ini (berlaku ${d.expires_hours / 24} hari).`);
    setInvite({ full_name: "", email: "", role: "orang_tua", branch_id: "", organization_name: "" });
    load();
  }

  if (error && !data) return (<><PageHead title="Pengguna" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Pengguna" /><LoadingState /></>);

  const pending = data.users.filter((u) => u.status === "menunggu_persetujuan");

  return (
    <>
      <PageHead
        title="Pengguna"
        subtitle={`${data.users.length} akun · ${pending.length} menunggu persetujuan`}
      />
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}
      <nav aria-label="Kamar-kamar Pengguna" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <a className={bagian === "undang" ? "btn" : "btn secondary"} href="/pengguna/undang">Undang Pengguna</a>
        <a className={bagian === "daftar" ? "btn" : "btn secondary"} href="/pengguna/daftar">Daftar Pengguna</a>
      </nav>

      {(!bagian || bagian === "undang") && (<>
      {activation ? (
        <div className="card" role="status">
          <h2 style={{ marginTop: 0 }}>Tautan sekali pakai</h2>
          <p className="muted">Kirim tautan ini ke pengguna lewat WhatsApp/email. Tautan hangus setelah dipakai.</p>
          <input readOnly value={activation} onFocus={(e) => e.currentTarget.select()} style={{ width: "100%" }} />
          <p className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn small secondary" onClick={() => navigator.clipboard?.writeText(activation)}>Salin</button>
            <button type="button" className="btn small secondary" onClick={() => setActivation(null)}>Tutup</button>
          </p>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Undang pengguna baru</h2>
        <form onSubmit={undang}>
          <div className="form-grid">
            <div className="field"><label htmlFor="inv_name">Nama lengkap *</label>
              <input id="inv_name" required value={invite.full_name} onChange={(e) => setInvite({ ...invite, full_name: e.target.value })} /></div>
            <div className="field"><label htmlFor="inv_email">Email *</label>
              <input id="inv_email" type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></div>
            <div className="field"><label htmlFor="inv_role">Peran *</label>
              <select id="inv_role" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                {data.roles.map((r) => (<option key={r.code} value={r.code}>{r.name} ({r.permission_count} izin)</option>))}
              </select></div>
            <div className="field"><label htmlFor="inv_branch">Cabang</label>
              <select id="inv_branch" value={invite.branch_id} onChange={(e) => setInvite({ ...invite, branch_id: e.target.value })}>
                <option value="">Semua cabang</option>
                {data.branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select></div>
            <div className="field"><label htmlFor="inv_org">Sekolah/Organisasi</label>
              <input id="inv_org" value={invite.organization_name} onChange={(e) => setInvite({ ...invite, organization_name: e.target.value })} /></div>
          </div>
          <button className="btn" type="submit" disabled={busy === "invite"} style={{ marginTop: 12 }}>
            {busy === "invite" ? "Membuat…" : "Buat Undangan"}
          </button>
          <p className="hint">Pengguna menerima tautan aktivasi sekali pakai, bukan kata sandi.</p>
        </form>
      </div>

      </>)}

      {(!bagian || bagian === "daftar") && (<>
      <p className="hint" style={{ marginTop: 12 }}>
        Kolom <strong>Akun Staf</strong> menautkan akun login ke baris staf — wajib sebelum staf bisa mengajukan cuti
        atau memutuskan cuti. Satu staf hanya boleh punya satu akun.
      </p>
      <div style={{ marginTop: 16, maxWidth: 420 }}>
        <input aria-label="Cari pengguna" placeholder="Cari nama atau email pengguna…" value={cari} onChange={(e) => setCari(e.target.value)} />
      </div>
      <div className="card table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Cabang</th><th>Akun Staf</th><th>Status</th><th>Terakhir Masuk</th><th>Aksi</th></tr></thead>
          <tbody>
            {data.users
              .filter((u) => !cari || `${u.full_name} ${u.email}`.toLowerCase().includes(cari.toLowerCase()))
              .map((u) => (
              <tr key={u.id}>
                <td><strong>{u.full_name}</strong>{u.totp_enabled ? <span className="muted"> · 2FA</span> : null}</td>
                <td>{u.email}</td>
                <td>
                  <select value={u.role} disabled={busy === u.id} onChange={(e) => patch(u.id, { role: e.target.value }, `Peran ${u.email} diubah.`)}>
                    {data.roles.map((r) => (<option key={r.code} value={r.code}>{r.name}</option>))}
                  </select>
                </td>
                <td>
                  <select value="" disabled={busy === u.id} onChange={(e) => patch(u.id, { branch_id: e.target.value || null }, `Cabang ${u.email} diubah.`)}>
                    <option value="">{u.branch_names || "Semua cabang"}</option>
                    {data.branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                  </select>
                </td>
                <td>
                  <select
                    value={u.staff_id || ""}
                    disabled={busy === u.id}
                    aria-label={`Akun staf untuk ${u.email}`}
                    onChange={(e) => patch(u.id, { staff_id: e.target.value || null }, `Akun ${u.email} ditautkan ke staf.`)}
                  >
                    <option value="">— belum tertaut —</option>
                    {data.staff
                      .filter((s) => !s.user_id || s.user_id === u.id)
                      .map((s) => (<option key={s.id} value={s.id}>{s.full_name}{s.position ? ` · ${s.position}` : ""}</option>))}
                  </select>
                  {u.staff_name ? <div className="muted" style={{ fontSize: 11 }}>tertaut</div> : null}
                </td>
                <td>{STATUS_LABEL[u.status] || u.status}</td>
                <td className="muted" style={{ whiteSpace: "nowrap", fontSize: 12.5 }}>{u.last_login_wib ? `${u.last_login_wib.replace("T", " · ")} WIB` : "Belum pernah"}</td>
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    {u.status === "menunggu_persetujuan" ? (
                      <button type="button" className="btn small" disabled={busy === u.id} onClick={() => patch(u.id, { status: "aktif" }, `${u.email} disetujui.`)}>Setujui</button>
                    ) : null}
                    {u.status === "aktif" ? (
                      <button type="button" className="btn small secondary" disabled={busy === u.id} onClick={() => patch(u.id, { status: "nonaktif" }, `${u.email} dinonaktifkan.`)}>Nonaktifkan</button>
                    ) : null}
                    {u.status === "nonaktif" ? (
                      <button type="button" className="btn small secondary" disabled={busy === u.id} onClick={() => patch(u.id, { status: "aktif" }, `${u.email} diaktifkan.`)}>Aktifkan</button>
                    ) : null}
                    <button type="button" className="btn small secondary" disabled={busy === u.id} onClick={() => buatTautan(u.id, u.status === "menunggu_persetujuan" ? "aktivasi" : "reset")}>Tautan</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>)}
    </>
  );
}
