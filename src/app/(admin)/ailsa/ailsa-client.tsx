"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead, StatusBadge } from "@/components/chrome";
import { tanggalPanjang, jamRapi } from "@/lib/format";

type Row = Record<string, string | number | boolean | null>;
type Data = {
  configured: boolean;
  conversations: Row[];
  knowledge: Row[];
  unanswered: Array<{ message_text: string; total: number }>;
  leads: Row[];
};
type Status = {
  configured: boolean;
  llm: { configured: boolean; model: string; kunci?: { utama: boolean; cadangan: boolean; aplikasi?: boolean }; dariAplikasi?: boolean; masker?: string | null };
  env: Array<{ name: string; filled: boolean }>;
  admin_number: string | null;
  settings: Record<string, string | number | boolean> | null;
  templates: string[];
  last_outbound: { created_at: string; delivery_status: string | null } | null;
  outbound: { total: number; gagal: number };
};

export function AilsaClient({ bagian }: { bagian?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tes, setTes] = useState({ to: "", text: "" });
  const [form, setForm] = useState({ question_sample: "", answer_text: "", branch_id: "" });
  const [chat, setChat] = useState<Array<{ siapa: "staf" | "ailsa"; teks: string; meta?: string }>>([]);
  const [ketik, setKetik] = useState("");
  const [persona, setPersona] = useState<"calon" | "wali_belum" | "wali" | "staf">("calon");
  const [anakSim, setAnakSim] = useState("");
  const [panel, setPanel] = useState<Record<string, unknown> | null>(null);
  const [anak, setAnak] = useState<Array<{ id: string; full_name: string }>>([]);
  const [gen, setGen] = useState({ child_id: "", tanggal: new Date().toISOString().slice(0, 10), catatan: "", dari: "", sampai: "" });
  const [hasilGen, setHasilGen] = useState<{ tipe: string; ok: boolean; teks: string; id?: string } | null>(null);
  const [analisa, setAnalisa] = useState<Array<Record<string, string | number | boolean>>>([
  ]);

  const [kunci, setKunci] = useState<{ tersimpan: boolean; masker: string | null; model: string; base_url: string } | null>(null);
  const [kunciForm, setKunciForm] = useState({ api_key: "", model: "deepseek-chat", base_url: "https://api.deepseek.com/v1" });
  const [daftarModel, setDaftarModel] = useState<string[]>(["deepseek-chat", "deepseek-reasoner"]);

  async function muatModel() {
    setBusy("kunci-model");
    setInfo(null);
    const res = await fetch("/api/ailsa/kunci", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: "model_list", ...kunciForm }),
    });
    const d = await res.json();
    setBusy(null);
    if (!d.ok) {
      setInfo({ ok: false, text: d.error || "Gagal memuat daftar model." });
      return;
    }
    setDaftarModel(d.models as string[]);
    setInfo({ ok: true, text: `${(d.models as string[]).length} model ditemukan di server — klik kolom Model untuk memilih, atau ketik nama model lain.` });
  }

  async function aksiKunci(aksi: "simpan" | "hapus" | "uji") {
    setBusy(`kunci-${aksi}`);
    setInfo(null);
    const res = await fetch("/api/ailsa/kunci", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi, ...kunciForm }),
    });
    const d = await res.json();
    setBusy(null);
    setInfo({ ok: Boolean(d.ok), text: d.ok ? (d.pesan || "Berhasil.") : (d.error || d.pesan || "Gagal.") });
    if (d.ok && aksi !== "uji") {
      setKunciForm((f) => ({ ...f, api_key: "" }));
      load();
    }
  }

  const load = useCallback(() => {
    fetch("/api/ailsa")
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setError(d.error)))
      .catch(() => setError("Tidak dapat menghubungi server."));
    fetch("/api/children")
      .then((r) => r.json())
      .then((d) => (d.ok ? setAnak(d.children) : null))
      .catch(() => null);
    fetch("/api/ailsa/generate")
      .then((r) => r.json())
      .then((d) => (d.ok ? setAnalisa(d.analyses) : null))
      .catch(() => null);
    fetch("/api/ailsa/status")
      .then((r) => r.json())
      .then((d) => (d.ok ? setStatus(d) : null))
      .catch(() => null);
    fetch("/api/ailsa/kunci")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setKunci(d);
        setKunciForm((f) => ({ ...f, model: d.model || f.model, base_url: d.base_url || f.base_url }));
      })
      .catch(() => null);
  }, []);

  useEffect(load, [load]);

  async function kirimTes() {
    setBusy("tes");
    setInfo(null);
    const res = await fetch("/api/ailsa/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: tes.to, text: tes.text }),
    });
    const d = await res.json();
    setBusy(null);
    setInfo({ ok: Boolean(d.ok), text: d.ok ? d.pesan : `${d.pesan || "Gagal"}${d.error ? ` (${d.error})` : ""}` });
    load();
  }

  async function simpanSetelan(patch: Record<string, unknown>) {
    setBusy("setelan");
    const res = await fetch("/api/ailsa/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "simpan_setelan", ...patch }),
    });
    const d = await res.json();
    setBusy(null);
    setInfo({ ok: Boolean(d.ok), text: d.ok ? "Setelan bot disimpan." : d.error || "Gagal menyimpan setelan." });
    load();
  }

  async function ambilAlih(wa: string, action: "ambil" | "kembalikan") {
    setBusy(wa);
    const res = await fetch("/api/ailsa/takeover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wa_number: wa, action }),
    });
    const d = await res.json();
    setBusy(null);
    setInfo({ ok: Boolean(d.ok), text: d.ok ? (action === "ambil" ? "Bot dihentikan untuk percakapan ini." : "Percakapan dikembalikan ke bot.") : d.error });
    load();
  }

  async function tanyaAilsa() {
    const teks = ketik.trim();
    if (!teks || busy === "chat") return;
    setChat((c) => [...c, { siapa: "staf", teks: `[${persona}] ${teks}` }]);
    setKetik("");
    setBusy("chat");
    const mulai = performance.now();
    const res = await fetch("/api/ailsa/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: teks, persona, child_id: anakSim || undefined }),
    });
    const d = await res.json();
    const durasi = ((performance.now() - mulai) / 1000).toFixed(1);
    setBusy(null);
    setPanel(d.ok ? { ...d, durasi_detik: durasi } : { galat: d.error, durasi_detik: durasi });
    const meta = d.ok
      ? `model ${d.model} · intent ${d.intent} · confidence ${d.confidence} · ${d.ditahan ? "DITAHAN: " + d.ditahan : d.eskalasi ? "eskalasi" : "terkirim"}`
      : `galat: ${d.error}`;
    setChat((c) => [...c, { siapa: "ailsa", teks: d.ok ? d.reply : d.error, meta }]);
  }

  async function buatDenganAilsa(action: "draft_laporan" | "analisa") {
    if (!gen.child_id) { setHasilGen({ tipe: action, ok: false, teks: "Pilih anak dulu." }); return; }
    setBusy(action);
    setHasilGen(null);
    const payload: Record<string, string> = { action, child_id: gen.child_id };
    if (action === "draft_laporan") {
      payload.tanggal = gen.tanggal;
      payload.catatan = gen.catatan;
    } else {
      if (gen.dari) payload.dari = gen.dari;
      if (gen.sampai) payload.sampai = gen.sampai;
    }
    const res = await fetch("/api/ailsa/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    setBusy(null);
    if (!d.ok) {
      setHasilGen({ tipe: action, ok: false, teks: d.error || "Gagal." });
      return;
    }
    if (action === "draft_laporan") {
      setHasilGen({ tipe: action, ok: true, teks: `Draft laporan dibuat (status draft, belum terbit) dengan ${d.data?.aktivitas ?? 0} aktivitas.`, id: d.id });
    } else {
      const isi = d.data || {};
      const baris = [
        isi.ringkasan ? `Ringkasan: ${isi.ringkasan}` : "",
        ...(Array.isArray(isi.aspects) ? isi.aspects.map((a: Record<string, unknown>) => `• ${a.aspect}: ${a.level}`) : []),
        Array.isArray(isi.strengths) && isi.strengths.length ? `Kekuatan: ${(isi.strengths as string[]).join("; ")}` : "",
        Array.isArray(isi.growth_areas) && isi.growth_areas.length ? `Area tumbuh: ${(isi.growth_areas as string[]).join("; ")}` : "",
        Array.isArray(isi.class_stimulation) && isi.class_stimulation.length ? `Stimulasi kelas: ${(isi.class_stimulation as string[]).join("; ")}` : "",
        isi.needs_teacher_review ? "Perlu tinjauan guru lebih dulu." : "",
      ].filter(Boolean);
      setHasilGen({ tipe: action, ok: true, teks: baris.join("\n"), id: d.id });
      fetch("/api/ailsa/generate").then((r) => r.json()).then((x) => (x.ok ? setAnalisa(x.analyses) : null)).catch(() => null);
    }
  }

  async function setujui(id: string, status: "aktif" | "nonaktif") {
    setBusy(id);
    const res = await fetch("/api/ailsa", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const d = await res.json();
    setBusy(null);
    setInfo({ ok: Boolean(d.ok), text: d.ok ? (status === "aktif" ? "Butir disetujui dan dipakai Ailsa." : "Butir dinonaktifkan.") : d.error });
    if (d.ok) load();
  }

  async function tambahPengetahuan(event: React.FormEvent) {
    event.preventDefault();
    setBusy("know");
    const res = await fetch("/api/ailsa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setBusy(null);
    setInfo({ ok: Boolean(d.ok), text: d.ok ? "Butir pengetahuan ditambahkan sebagai draft (belum dipakai bot)." : d.error });
    if (d.ok) {
      setForm({ question_sample: "", answer_text: "", branch_id: "" });
      load();
    }
  }

  if (error && !data) return (<><PageHead title="Ailsa" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Ailsa" /><LoadingState /></>);

  const siap = Boolean(status?.llm.configured);
  const ambilAlihAktif = new Set(
    data.leads.filter((l) => Boolean(l.takeover_at)).map((l) => String(l.wa_number || ""))
  );

  return (
    <>
      <PageHead
        title="Ailsa"
        subtitle="Asisten AI Balita Center dengan otak DeepSeek: menjawab hanya dari bank pengetahuan yang disetujui, mengumpulkan lead ke pipeline Admission."
      />
      {error ? <ErrorState message={error} /> : null}
      {info ? (
        <p className={info.ok ? "success" : "notice"} role="status">{info.text}</p>
      ) : null}

      <nav aria-label="Kamar-kamar Ailsa" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <a className={bagian === "kanal" ? "btn" : "btn secondary"} href="/ailsa/kanal">Kanal & Kunci LLM</a>
        <a className={bagian === "simulator" ? "btn" : "btn secondary"} href="/ailsa/simulator">Simulator & Buat Konten</a>
        <a className={bagian === "pesan" ? "btn" : "btn secondary"} href="/ailsa/pesan">Pesan Tes & Pengaturan</a>
        <a className={bagian === "percakapan" ? "btn" : "btn secondary"} href="/ailsa/percakapan">Percakapan Terbaru</a>
        <a className={bagian === "pengetahuan" ? "btn" : "btn secondary"} href="/ailsa/pengetahuan">Bank Pengetahuan</a>
      </nav>

      {(!bagian || bagian === "kanal") && (<>
      <article className="card">
        <h2 style={{ marginTop: 0 }}>Status Kanal</h2>
        <table>
          <tbody>
            <tr>
              <th style={{ width: 220 }}>Kanal WhatsApp</th>
              <td>
                <StatusBadge status={status?.configured ? "aktif" : "nonaktif"} />{" "}
                {status?.configured ? "Kredensial Meta terisi, tetapi kanal tidak dipakai atas keputusan pemilik." : "Nonaktif atas keputusan pemilik — Ailsa berjalan di dalam aplikasi (Simulator), bukan lewat Meta."}
              </td>
            </tr>
            <tr>
              <th>Otak LLM</th>
              <td>
                <StatusBadge status={status?.llm.configured ? "aktif" : "nonaktif"} />{" "}
                {status?.llm.configured ? `Model: ${status.llm.model}` : "Belum ada kunci — isi kunci DeepSeek di kartu Kunci LLM di bawah."}
                {status?.llm.dariAplikasi ? (
                  <span className="muted"> · kunci dari aplikasi ({status.llm.masker || "••••"})</span>
                ) : status?.llm.kunci ? (
                  <span className="muted"> · kunci env utama {status.llm.kunci.utama ? "siap" : "kosong"}, cadangan {status.llm.kunci.cadangan ? "siap" : "kosong"}</span>
                ) : null}
              </td>
            </tr>
            <tr>
              <th>Pesan keluar terakhir</th>
              <td>
                {status?.last_outbound
                  ? `${tanggalPanjang(status.last_outbound.created_at)} ${jamRapi(status.last_outbound.created_at)} · ${status.last_outbound.delivery_status || "tanpa status"}`
                  : "Belum ada pesan keluar."}
                {status ? <span className="muted"> · total {status.outbound.total}, gagal {status.outbound.gagal}</span> : null}
              </td>
            </tr>
          </tbody>
        </table>
        <p className={siap ? "muted" : "notice"} style={{ marginBottom: 0 }}>
          {siap
            ? "Otak DeepSeek aktif — Ailsa bisa diajak bicara di Simulator dan dipakai membuat draf laporan serta analisa perkembangan (internal staf)."
            : "Otak Ailsa belum menyala. Isi kunci DeepSeek di kartu Kunci LLM di bawah — tanpa Meta, tanpa mengubah file server."}
        </p>
      </article>

      <article className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Kunci LLM — DeepSeek</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Otak Ailsa memakai DeepSeek, <strong>bukan Meta</strong>. Tempel kunci API DeepSeek
          (dari platform.deepseek.com) di sini — langsung aktif tanpa restart dan tanpa mengubah
          file server. Kunci tersimpan di database sekolah dan tidak pernah ditampilkan lagi
          selain 4 karakter terakhirnya.
        </p>
        <p>
          Status:{" "}
          <StatusBadge status={kunci?.tersimpan ? "aktif" : "nonaktif"} />{" "}
          {kunci?.tersimpan
            ? <>Kunci dari aplikasi terpasang (<strong>{kunci.masker}</strong>), model <strong>{kunci.model}</strong>.</>
            : "Belum ada kunci dari aplikasi. Ailsa memakai kunci env server bila ada."}
        </p>
        <div className="form-grid">
          <div className="field"><label htmlFor="kc-key">Kunci API DeepSeek</label>
            <input id="kc-key" type="password" autoComplete="off" placeholder={kunci?.tersimpan ? "Biarkan kosong untuk mempertahankan kunci lama" : "sk-…"}
              value={kunciForm.api_key} onChange={(e) => setKunciForm({ ...kunciForm, api_key: e.target.value })} /></div>
          <div className="field"><label htmlFor="kc-model">Model</label>
            <input id="kc-model" list="kc-daftar-model" placeholder="deepseek-chat" value={kunciForm.model} onChange={(e) => setKunciForm({ ...kunciForm, model: e.target.value })} />
            <datalist id="kc-daftar-model">
              {daftarModel.map((m) => (<option key={m} value={m} />))}
            </datalist>
            <small className="muted">Pilih dari daftar atau ketik nama model apa pun. Tombol Muat Model Terbaru mengambil daftar persis dari server — selalu yang paling baru.</small></div>
          <div className="field"><label htmlFor="kc-base">Base URL</label>
            <input id="kc-base" type="url" value={kunciForm.base_url} onChange={(e) => setKunciForm({ ...kunciForm, base_url: e.target.value })} /></div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="btn" disabled={busy?.startsWith("kunci")} onClick={() => void aksiKunci("simpan")}>
            {busy === "kunci-simpan" ? "Menyimpan…" : "Simpan Kunci"}
          </button>
          <button type="button" className="btn secondary" disabled={busy?.startsWith("kunci")} onClick={() => void aksiKunci("uji")}>
            {busy === "kunci-uji" ? "Menguji…" : "Uji Koneksi"}
          </button>
          <button type="button" className="btn secondary" disabled={busy?.startsWith("kunci")} onClick={() => void muatModel()}>
            {busy === "kunci-model" ? "Memuat…" : "Muat Model Terbaru"}
          </button>
          {kunci?.tersimpan ? (
            <button type="button" className="btn secondary" style={{ color: "#b42318", borderColor: "#f0c4bf" }} disabled={busy?.startsWith("kunci")} onClick={() => void aksiKunci("hapus")}>
              Hapus Kunci
            </button>
          ) : null}
        </div>
      </article>

      </>)}

      {(!bagian || bagian === "simulator") && (<>
      <article className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Simulator Ailsa (Tahap 0)</h2>
        <p className="alert" style={{ marginTop: 0 }}>
          <strong>Bukan WhatsApp sungguhan.</strong> Percakapan di sini memakai otak yang sama, tetapi tidak
          mengirim pesan ke siapa pun. Semua percakapan dicatat di log berlabel <code>simulator</code>.
        </p>
        <div className="form-grid">
          <div className="field"><label htmlFor="sim_persona">Persona *</label>
            <select id="sim_persona" value={persona} onChange={(e) => setPersona(e.target.value as typeof persona)}>
              <option value="calon">Calon Orang Tua</option>
              <option value="wali_belum">Wali Belum Terverifikasi</option>
              <option value="wali">Wali Terverifikasi</option>
              <option value="staf">Staf / Guru</option>
            </select></div>
          {persona === "wali" ? (
            <div className="field"><label htmlFor="sim_anak">Anak yang dilihat</label>
              <select id="sim_anak" value={anakSim} onChange={(e) => setAnakSim(e.target.value)}>
                <option value="">Pilih anak</option>
                {anak.map((a) => (<option key={a.id} value={a.id}>{a.full_name}</option>))}
              </select></div>
          ) : null}
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto", background: "#f7f8fa", borderRadius: 8, padding: 12 }}>
          {chat.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Belum ada obrolan. Coba tanya “berapa biaya SPP?” atau “apakah ada kelas berenang?”.</p>
          ) : (
            chat.map((m, i) => (
              <div key={i} style={{ margin: "8px 0", textAlign: m.siapa === "staf" ? "right" : "left" }}>
                <div style={{
                  display: "inline-block", padding: "8px 12px", borderRadius: 10, maxWidth: "78%",
                  background: m.siapa === "staf" ? "#dcecff" : "#ffffff", border: "1px solid #e3e7ee", whiteSpace: "pre-line",
                }}>
                  {m.teks}
                </div>
                {m.meta ? <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{m.meta}</div> : null}
              </div>
            ))
          )}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); void tanyaAilsa(); }}
          className="row"
          style={{ marginTop: 10 }}
        >
          <input
            aria-label="Pesan untuk Ailsa"
            placeholder="Tulis pertanyaan seperti orang tua…"
            value={ketik}
            onChange={(e) => setKetik(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn small" type="submit" disabled={busy === "chat"}>
            {busy === "chat" ? "Ailsa mengetik…" : "Kirim"}
          </button>
        </form>
        {panel ? (
          <div className="card" style={{ marginTop: 12, background: "#fbfcfe" }}>
            <h3 style={{ marginTop: 0 }}>Panel Proses</h3>
            {panel.galat ? (
              <p className="notice">Gagal: {String(panel.galat)}</p>
            ) : (
              <table>
                <tbody>
                  <tr><th style={{ width: 180 }}>Durasi</th><td>{String(panel.durasi_detik)} detik</td></tr>
                  <tr><th>Model</th><td>{String(panel.model)}</td></tr>
                  <tr><th>Sumber kunci</th><td>{String(panel.sumber_llm || "-")}</td></tr>
                  <tr><th>Intent / state</th><td>{String(panel.intent)} · confidence {String(panel.confidence)}</td></tr>
                  <tr><th>Pengetahuan dipakai</th><td>{(panel.pengetahuan_dipakai as string[])?.length ? (panel.pengetahuan_dipakai as string[]).join(", ") : <span className="muted">tidak ada butir aktif yang dipakai</span>}</td></tr>
                  <tr><th>Tool dipanggil</th><td>{(panel.tool as string[])?.join(", ") || "-"}</td></tr>
                  <tr><th>Pengawalan</th><td>{panel.ditahan ? `DITAHAN — ${String(panel.ditahan)}` : "lolos"}</td></tr>
                  <tr><th>Eskalasi</th><td>{panel.eskalasi ? "ya" : "tidak"}</td></tr>
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </article>

      <article className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Buat dengan Ailsa</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Ailsa menyusun <strong>draf laporan harian</strong> dari catatan guru (status draft, tidak terbit sendiri)
          dan <strong>analisa perkembangan</strong> dari laporan yang sudah terbit (minimal 3 laporan).
        </p>
        <div className="form-grid">
          <div className="field"><label htmlFor="g_anak">Anak *</label>
            <select id="g_anak" value={gen.child_id} onChange={(e) => setGen({ ...gen, child_id: e.target.value })}>
              <option value="">Pilih anak</option>
              {anak.map((a) => (<option key={a.id} value={a.id}>{a.full_name}</option>))}
            </select></div>
          <div className="field"><label htmlFor="g_tgl">Tanggal laporan</label>
            <input id="g_tgl" type="date" value={gen.tanggal} onChange={(e) => setGen({ ...gen, tanggal: e.target.value })} /></div>
          <div className="field"><label htmlFor="g_dari">Analisa: dari</label>
            <input id="g_dari" type="date" value={gen.dari} onChange={(e) => setGen({ ...gen, dari: e.target.value })} /></div>
          <div className="field"><label htmlFor="g_sampai">Analisa: sampai</label>
            <input id="g_sampai" type="date" value={gen.sampai} onChange={(e) => setGen({ ...gen, sampai: e.target.value })} /></div>
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="g_catatan">Catatan guru untuk draf laporan</label>
          <textarea id="g_catatan" rows={3} placeholder="Contoh: hari ini Rara bermain kartu warna, makan nasi ayam habis, tidur 40 menit, pipis 3x, ceria."
            value={gen.catatan} onChange={(e) => setGen({ ...gen, catatan: e.target.value })} />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn small" type="button" disabled={busy === "draft_laporan"} onClick={() => buatDenganAilsa("draft_laporan")}>
            {busy === "draft_laporan" ? "Menyusun draf…" : "Buat Draf Laporan Harian"}
          </button>
          <button className="btn small secondary" type="button" disabled={busy === "analisa"} onClick={() => buatDenganAilsa("analisa")}>
            {busy === "analisa" ? "Menganalisa…" : "Buat Analisa Perkembangan"}
          </button>
        </div>
        {hasilGen ? (
          <div className={hasilGen.ok ? "alert" : "alert alert-error"} role="status" style={{ marginTop: 12, whiteSpace: "pre-line" }}>
            {hasilGen.teks}
            {hasilGen.ok && hasilGen.tipe === "draft_laporan" && hasilGen.id ? (
              <div style={{ marginTop: 6 }}><a href={`/daily-reports/${hasilGen.id}`}>Buka draf laporan</a></div>
            ) : null}
          </div>
        ) : null}

        <h3 style={{ marginTop: 18 }}>Analisa tersimpan ({analisa.length})</h3>
        {analisa.length === 0 ? (
          <p className="muted">Belum ada analisa. Analisa hanya dibuat bila laporan terbit ≥ 3 pada periode itu.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Anak</th><th>Periode</th><th>Laporan</th><th>Tinjau</th><th>Dibuat</th></tr></thead>
              <tbody>
                {analisa.map((a) => (
                  <tr key={String(a.id)}>
                    <td><strong>{String(a.child_name)}</strong></td>
                    <td>{String(a.period_start)} – {String(a.period_end)}</td>
                    <td>{String(a.published_count)}</td>
                    <td>{a.needs_teacher_review ? "perlu tinjauan guru" : "siap dibaca"}</td>
                    <td>{String(a.created_at).slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      </>)}

      {(!bagian || bagian === "pesan") && (<>
      <section className="grid two" style={{ marginTop: 12 }}>
        <article className="card">
          <h2 style={{ marginTop: 0 }}>Kirim Pesan Tes</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Hanya mengirim ke satu nomor yang Anda ketik (default nomor admin). Tidak ada kirim massal.
          </p>
          <div className="form-grid">
            <div className="field"><label htmlFor="tes_to">Nomor tujuan</label>
              <input id="tes_to" placeholder={status?.admin_number || "62812xxxxxxx"} value={tes.to} onChange={(e) => setTes({ ...tes, to: e.target.value })} /></div>
            <div className="field"><label htmlFor="tes_text">Isi pesan (opsional)</label>
              <input id="tes_text" placeholder="Pesan uji dari Ailsa" value={tes.text} onChange={(e) => setTes({ ...tes, text: e.target.value })} /></div>
          </div>
          <button type="button" className="btn small" disabled={busy === "tes"} onClick={kirimTes} style={{ marginTop: 8 }}>
            {busy === "tes" ? "Mengirim…" : "Kirim Pesan Tes"}
          </button>
        </article>

        <article className="card">
          <h2 style={{ marginTop: 0 }}>Pengaturan</h2>
          <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" defaultChecked={status?.settings?.notify_published !== false} onChange={(e) => simpanSetelan({ notify_published: e.target.checked })} />
              Notifikasi laporan terbit
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" defaultChecked={status?.settings?.remind_invoice !== false} onChange={(e) => simpanSetelan({ remind_invoice: e.target.checked })} />
              Pengingat SPP
            </label>
          </div>
          <div className="form-grid" style={{ marginTop: 10 }}>
            <div className="field"><label htmlFor="adm">Nomor admin / handoff</label>
              <input id="adm" defaultValue={String(status?.settings?.admin_number || status?.admin_number || "")}
                onBlur={(e) => { if (e.target.value !== String(status?.settings?.admin_number || "")) simpanSetelan({ admin_number: e.target.value }); }} /></div>
            <div className="field"><label htmlFor="jam">Jam operasional bot</label>
              <div className="row">
                <input id="jam" type="number" min="0" max="23" style={{ width: 70 }} defaultValue={Number(status?.settings?.hours_start ?? 7)}
                  onBlur={(e) => simpanSetelan({ hours_start: Number(e.target.value) })} />
                <span>s/d</span>
                <input type="number" min="0" max="23" style={{ width: 70 }} defaultValue={Number(status?.settings?.hours_end ?? 21)}
                  onBlur={(e) => simpanSetelan({ hours_end: Number(e.target.value) })} />
              </div></div>
          </div>
          <h3 style={{ marginTop: 14 }}>Variabel lingkungan</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(status?.env || []).map((e) => (
              <li key={e.name}><code>{e.name}</code> — {e.filled ? "terisi" : "belum diisi"}</li>
            ))}
            <li><code>LLM_MODEL</code> / <code>AILSA_LLM_API_KEY</code> — {status?.llm.configured ? "terisi" : "belum diisi"}</li>
          </ul>
        </article>
      </section>
      </>)}

      {(!bagian || bagian === "percakapan") && (<>
      <article className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Percakapan Terbaru</h2>
        {data.conversations.length === 0 ? (
          <EmptyState title="Belum ada percakapan" body="Percakapan WhatsApp masuk dan keluar tampil di sini setelah webhook menerima pesan." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Waktu</th><th>Nomor</th><th>Arah</th><th>Pesan</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {data.conversations.map((c) => (
                  <tr key={String(c.id)}>
                    <td style={{ whiteSpace: "nowrap" }}>{tanggalPanjang(String(c.created_at))} <span className="muted">{jamRapi(String(c.created_at))}</span></td>
                    <td>{String(c.wa_number || "-")}</td>
                    <td>{String(c.direction)} · {String(c.sender)}</td>
                    <td style={{ maxWidth: 380 }}>
                      {String(c.message_text)}
                      {c.blocked_reason ? <div className="muted" style={{ fontSize: 11 }}>ditahan: {String(c.blocked_reason)}</div> : null}
                      {c.escalated ? <div className="muted" style={{ fontSize: 11 }}>dieskalasi</div> : null}
                    </td>
                    <td>{String(c.delivery_status || "-")}</td>
                    <td>
                      {c.wa_number ? (
                        ambilAlihAktif.has(String(c.wa_number)) ? (
                          <button className="btn small secondary" disabled={busy === String(c.wa_number)} onClick={() => ambilAlih(String(c.wa_number), "kembalikan")}>Kembalikan ke Bot</button>
                        ) : (
                          <button className="btn small secondary" disabled={busy === String(c.wa_number)} onClick={() => ambilAlih(String(c.wa_number), "ambil")}>Ambil Alih</button>
                        )
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      </>)}

      {(!bagian || bagian === "pengetahuan") && (<>
      <article className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Pertanyaan Tak Terjawab ({data.unanswered.length})</h2>
        <p className="muted" style={{ marginTop: 0 }}>Jawab di sini, setujui, lalu Ailsa memakai jawaban itu pada percakapan berikutnya.</p>
        {data.unanswered.length === 0 ? (
          <p className="muted">Belum ada pertanyaan yang gagal dijawab.</p>
        ) : (
          <ul>
            {data.unanswered.map((u) => (
              <li key={u.message_text}>
                <strong>{u.message_text}</strong> <span className="muted">({u.total}×)</span>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Bank Pengetahuan ({data.knowledge.length})</h2>
        <form onSubmit={tambahPengetahuan} className="form-grid">
          <div className="field"><label htmlFor="k_q">Pertanyaan contoh *</label>
            <input id="k_q" required value={form.question_sample} onChange={(e) => setForm({ ...form, question_sample: e.target.value })} /></div>
          <div className="field"><label htmlFor="k_a">Jawaban resmi *</label>
            <input id="k_a" required value={form.answer_text} onChange={(e) => setForm({ ...form, answer_text: e.target.value })} /></div>
          <div className="field"><label>&nbsp;</label>
            <button className="btn small" type="submit" disabled={busy === "know"}>
              {busy === "know" ? "Menyimpan…" : "Tambah Butir (draft)"}
            </button></div>
        </form>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>Pertanyaan</th><th>Jawaban</th><th>Status</th><th>Dipakai</th><th>Aksi</th></tr></thead>
            <tbody>
              {data.knowledge.map((k) => (
                <tr key={String(k.id)}>
                  <td>{String(k.question_sample)}</td>
                  <td>{String(k.answer_text)}</td>
                  <td><StatusBadge status={String(k.status)} /></td>
                  <td>{String(k.use_count ?? 0)}</td>
                  <td>
                    {String(k.status) !== "aktif" ? (
                      <button className="btn small" disabled={busy === String(k.id)} onClick={() => setujui(String(k.id), "aktif")}>Setujui</button>
                    ) : (
                      <button className="btn small secondary" disabled={busy === String(k.id)} onClick={() => setujui(String(k.id), "nonaktif")}>Nonaktifkan</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">Butir berstatus draf tidak pernah dipakai bot. Setujui lewat basis data/admin sebelum dipakai.</p>
      </article>
      </>)}
    </>
  );
}
