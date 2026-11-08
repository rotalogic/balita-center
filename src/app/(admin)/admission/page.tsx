"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { tanggalPendek } from "@/lib/format";

type Lead = {
  id: string;
  wa_number: string;
  parent_name: string | null;
  child_name: string | null;
  child_age_months: number | null;
  stage: string;
  trial_at: string | null;
  notes: string | null;
  source: string;
  created_at: string;
  program_name: string | null;
  branch_name: string | null;
  converted_child_name: string | null;
  converted_child_id: string | null;
};
type Data = {
  leads: Lead[];
  counts: Record<string, number>;
  programs: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
};

const STAGES: Array<[string, string]> = [
  ["lead_masuk", "Lead Masuk"],
  ["dihubungi", "Dihubungi"],
  ["trial_terjadwal", "Trial Terjadwal"],
  ["trial_selesai", "Trial Selesai"],
  ["diterima", "Diterima"],
  ["ditolak", "Ditolak"],
  ["terdaftar", "Terdaftar"],
];

const STATUS_CLASS: Record<string, string> = {
  lead_masuk: "badge neutral",
  dihubungi: "badge warn",
  trial_terjadwal: "badge warn",
  trial_selesai: "badge warn",
  diterima: "badge ok",
  ditolak: "badge danger",
  terdaftar: "badge ok",
};

export default function AdmissionPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    parent_name: "",
    child_name: "",
    wa_number: "",
    child_age_months: "",
    branch_id: "",
    interested_program_id: "",
  });

  const load = useCallback(() => {
    fetch("/api/admission")
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, []);

  useEffect(load, [load]);

  async function ubahTahap(id: string, payload: Record<string, unknown>, label: string) {
    setBusy(id);
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/admission/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    setBusy(null);
    if (!d.ok) {
      setError(d.error || "Gagal memperbarui tahap.");
      return;
    }
    setInfo(label);
    load();
  }

  async function tambah(event: React.FormEvent) {
    event.preventDefault();
    setBusy("baru");
    setError(null);
    setInfo(null);
    const res = await fetch("/api/admission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setBusy(null);
    if (!d.ok) {
      setError(d.error || "Gagal menyimpan lead.");
      return;
    }
    setInfo(`Lead ${form.child_name} masuk pipeline.`);
    setForm({ parent_name: "", child_name: "", wa_number: "", child_age_months: "", branch_id: "", interested_program_id: "" });
    load();
  }

  if (error && !data) return (<><PageHead title="Admission" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Admission" /><LoadingState /></>);

  return (
    <>
      <PageHead
        title="Admission"
        subtitle="Pipeline pendaftaran: dari lead masuk sampai terdaftar sebagai anak didik"
        action={<span className="muted">{data.leads.length} lead</span>}
      />
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}

      <div className="card">
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          {STAGES.map(([code, label]) => (
            <div key={code} className="card" style={{ padding: "10px 14px", minWidth: 120 }}>
              <div className="muted" style={{ fontSize: 12 }}>{label}</div>
              <strong style={{ fontSize: 20 }}>{data.counts[code] ?? 0}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Lead baru (input manual)</h2>
        <form onSubmit={tambah}>
          <div className="form-grid">
            <div className="field"><label htmlFor="p_name">Nama orang tua *</label>
              <input id="p_name" required value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} /></div>
            <div className="field"><label htmlFor="c_name">Nama anak *</label>
              <input id="c_name" required value={form.child_name} onChange={(e) => setForm({ ...form, child_name: e.target.value })} /></div>
            <div className="field"><label htmlFor="wa">Nomor WhatsApp *</label>
              <input id="wa" required placeholder="62812..." value={form.wa_number} onChange={(e) => setForm({ ...form, wa_number: e.target.value })} /></div>
            <div className="field"><label htmlFor="age">Usia anak (bulan)</label>
              <input id="age" type="number" min="0" max="120" value={form.child_age_months} onChange={(e) => setForm({ ...form, child_age_months: e.target.value })} /></div>
            <div className="field"><label htmlFor="br">Cabang</label>
              <select id="br" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                <option value="">Belum ditentukan</option>
                {data.branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select></div>
            <div className="field"><label htmlFor="pr">Program diminati</label>
              <select id="pr" value={form.interested_program_id} onChange={(e) => setForm({ ...form, interested_program_id: e.target.value })}>
                <option value="">Belum ditentukan</option>
                {data.programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select></div>
          </div>
          <button className="btn" type="submit" disabled={busy === "baru"} style={{ marginTop: 12 }}>
            {busy === "baru" ? "Menyimpan…" : "Tambah Lead"}
          </button>
        </form>
      </div>

      {data.leads.length === 0 ? (
        <div style={{ marginTop: 16 }}>
          <EmptyState title="Pipeline masih kosong" body="Tambahkan lead manual di atas, atau biarkan Bot Ailsa mengisi pipeline dari percakapan WhatsApp." />
        </div>
      ) : (
        <div className="card table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Masuk</th><th>Orang tua</th><th>Anak</th><th>WhatsApp</th><th>Program</th><th>Tahap</th><th>Aksi</th></tr></thead>
            <tbody>
              {data.leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{tanggalPendek(lead.created_at)}</td>
                  <td>{lead.parent_name || "-"}</td>
                  <td><strong>{lead.child_name || "-"}</strong>{lead.child_age_months ? <div className="muted">{lead.child_age_months} bulan</div> : null}</td>
                  <td className="mono">{lead.wa_number}</td>
                  <td>{lead.program_name || "-"}</td>
                  <td>
                    <span className={STATUS_CLASS[lead.stage] || "badge neutral"}>{lead.stage.replace(/_/g, " ")}</span>
                    {lead.trial_at ? <div className="muted">{tanggalPendek(lead.trial_at)}</div> : null}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                      <select
                        value={lead.stage}
                        disabled={busy === lead.id}
                        onChange={(e) => ubahTahap(lead.id, { stage: e.target.value }, `Tahap ${lead.child_name} → ${e.target.value}.`)}
                        aria-label={`Ubah tahap ${lead.child_name}`}
                      >
                        {STAGES.map(([code, label]) => (<option key={code} value={code}>{label}</option>))}
                      </select>
                      {lead.stage === "trial_terjadwal" ? (
                        <input
                          type="date"
                          aria-label="Tanggal trial"
                          value={(lead.trial_at || "").slice(0, 10)}
                          disabled={busy === lead.id}
                          onChange={(e) => ubahTahap(lead.id, { trial_at: e.target.value || null }, `Jadwal trial ${lead.child_name} disimpan.`)}
                        />
                      ) : null}
                      {lead.stage === "diterima" && !lead.converted_child_id ? (
                        <Link className="btn small" href={`/anak/tambah?lead=${lead.id}`}>Ubah jadi Anak Didik</Link>
                      ) : null}
                      {lead.converted_child_id ? (
                        <Link className="btn small secondary" href={`/anak/${lead.converted_child_id}`}>{lead.converted_child_name}</Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
