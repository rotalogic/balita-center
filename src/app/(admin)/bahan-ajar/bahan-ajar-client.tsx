"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { kirimJson } from "@/lib/http";
import { KATEGORI_BAHAN_AJAR, SUBKATEGORI_RESAMI, TARGET_SUBKATEGORI, TARGET_DOKUMEN, labelKategoriBahanAjar } from "@/lib/bahan-ajar";

// Kamar Bahan Ajar & Program Khusus (kerangka Tahap 2). Struktur dan
// formulirnya lengkap; isi resminya dimuat dari Paket Sistem Terpadu
// lembaga — halaman ini tidak mengarang isi apa pun.

type Bahan = { id: string; kategori: string; subkategori: string | null; judul: string; isi: string | null; teks_latin: string | null; urutan: number; aktif: boolean };
type Sesi = { id: string; judul: string; fokus: string | null; kelompok_usia: string | null; durasi_menit: number | null; langkah: string | null; urutan: number; aktif: boolean };
type Tahap = { id: string; nama: string; keterangan: string | null; urutan: number; aktif: boolean };
type Materi = { id: string; tahap_id: string; nama: string; keterangan: string | null; urutan: number; aktif: boolean };
type BulanKurikulum = { id: string; bulan: string; tema: string | null; fondasi: string | null; materi_inti: string | null; menu_sensory: string | null; menu_movement: string | null; subtema: string | null };
type MateriMovement = { id: string; judul: string; keterangan: string | null; urutan: number; aktif: boolean };

const NAMA_BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function labelBulan(kode: string): string {
  const [y, m] = kode.split("-");
  return `${NAMA_BULAN_ID[Number(m) - 1]} ${y}`;
}

const formBahanKosong = { kategori: "islamic_living", subkategori: "", judul: "", isi: "", teks_latin: "", urutan: "0" };
const formSesiKosong = { judul: "", fokus: "", kelompok_usia: "", durasi_menit: "", langkah: "", urutan: "0" };

export function BahanAjarClient({ bagian }: { bagian?: string }) {
  const [bahan, setBahan] = useState<Bahan[] | null>(null);
  const [sesi, setSesi] = useState<Sesi[] | null>(null);
  const [tahap, setTahap] = useState<Tahap[] | null>(null);
  const [materi, setMateri] = useState<Materi[] | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const [saringKategori, setSaringKategori] = useState("");
  const [formBahan, setFormBahan] = useState(formBahanKosong);
  const [editBahan, setEditBahan] = useState("");
  const [formSesi, setFormSesi] = useState(formSesiKosong);
  const [editSesi, setEditSesi] = useState("");
  const [formTahap, setFormTahap] = useState({ nama: "", keterangan: "", urutan: "0" });
  const [editTahap, setEditTahap] = useState("");
  const [formMateri, setFormMateri] = useState({ tahap_id: "", nama: "", keterangan: "", urutan: "0" });
  const [editMateri, setEditMateri] = useState("");
  const [kurikulum, setKurikulum] = useState<BulanKurikulum[] | null>(null);
  const [movement, setMovement] = useState<MateriMovement[] | null>(null);
  const [editBulan, setEditBulan] = useState("");
  const [formBulan, setFormBulan] = useState({ tema: "", fondasi: "", materi_inti: "", menu_sensory: "", menu_movement: "", subtema: "" });
  const [formMovement, setFormMovement] = useState({ judul: "", keterangan: "", urutan: "0" });
  const [editMovement, setEditMovement] = useState("");

  const load = useCallback(async () => {
    try {
      const [b, s, c, k] = await Promise.all([
        fetch("/api/bahan-ajar").then((r) => r.json()),
        fetch("/api/bank-sesi").then((r) => r.json()),
        fetch("/api/calistung").then((r) => r.json()),
        fetch("/api/kurikulum").then((r) => r.json()),
      ]);
      if (b.ok) setBahan(b.bahan as Bahan[]);
      if (s.ok) setSesi(s.sesi as Sesi[]);
      if (c.ok) { setTahap(c.tahap as Tahap[]); setMateri(c.materi as Materi[]); }
      if (k.ok) { setKurikulum(k.bulan as BulanKurikulum[]); setMovement(k.movement as MateriMovement[]); }
      if (!b.ok || !s.ok || !c.ok || !k.ok) setError(b.error || s.error || c.error || k.error || "Gagal memuat data.");
    } catch {
      setError("Koneksi terputus saat memuat data.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function kirim(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body: unknown, sukses: string) {
    setBusy(true); setInfo(""); setError("");
    const r = await kirimJson(url, method, body);
    setBusy(false);
    if (r.ok) { setInfo(sukses); void load(); }
    else setError(String(r.data.error || "Gagal menyimpan."));
    return r.ok;
  }

  async function simpanBahan() {
    const payload = { ...formBahan, urutan: Number(formBahan.urutan) || 0 };
    if (editBahan) {
      if (await kirim("/api/bahan-ajar", "PUT", { id: editBahan, ...payload }, "Bahan ajar diperbarui.")) { setEditBahan(""); setFormBahan(formBahanKosong); }
    } else if (await kirim("/api/bahan-ajar", "POST", payload, "Bahan ajar ditambahkan.")) setFormBahan(formBahanKosong);
  }

  async function simpanSesi() {
    const payload = { ...formSesi, urutan: Number(formSesi.urutan) || 0, durasi_menit: formSesi.durasi_menit === "" ? null : Number(formSesi.durasi_menit) };
    if (editSesi) {
      if (await kirim("/api/bank-sesi", "PUT", { id: editSesi, ...payload }, "Sesi diperbarui.")) { setEditSesi(""); setFormSesi(formSesiKosong); }
    } else if (await kirim("/api/bank-sesi", "POST", payload, "Sesi ditambahkan ke bank sesi.")) setFormSesi(formSesiKosong);
  }

  async function simpanTahap() {
    const payload = { kind: "tahap", nama: formTahap.nama, keterangan: formTahap.keterangan, urutan: Number(formTahap.urutan) || 0 };
    if (editTahap) {
      const lama = tahap?.find((t) => t.id === editTahap);
      if (await kirim("/api/calistung", "PUT", { id: editTahap, aktif: lama?.aktif !== false, ...payload }, "Tahap diperbarui.")) { setEditTahap(""); setFormTahap({ nama: "", keterangan: "", urutan: "0" }); }
    } else if (await kirim("/api/calistung", "POST", payload, "Tahap calistung ditambahkan.")) setFormTahap({ nama: "", keterangan: "", urutan: "0" });
  }

  async function simpanMateri() {
    const payload = { kind: "materi", tahap_id: formMateri.tahap_id, nama: formMateri.nama, keterangan: formMateri.keterangan, urutan: Number(formMateri.urutan) || 0 };
    if (editMateri) {
      const lama = materi?.find((m) => m.id === editMateri);
      if (await kirim("/api/calistung", "PUT", { id: editMateri, aktif: lama?.aktif !== false, ...payload }, "Materi diperbarui.")) { setEditMateri(""); setFormMateri({ tahap_id: "", nama: "", keterangan: "", urutan: "0" }); }
    } else if (await kirim("/api/calistung", "POST", payload, "Materi calistung ditambahkan.")) setFormMateri({ tahap_id: "", nama: "", keterangan: "", urutan: "0" });
  }

  async function simpanBulan() {
    if (await kirim("/api/kurikulum", "PUT", { bulan: editBulan, ...formBulan }, `Kurikulum ${labelBulan(editBulan)} tersimpan.`)) setEditBulan("");
  }

  async function simpanMovement() {
    const payload = { judul: formMovement.judul, keterangan: formMovement.keterangan, urutan: Number(formMovement.urutan) || 0 };
    if (editMovement) {
      const lama = movement?.find((m) => m.id === editMovement);
      if (await kirim("/api/kurikulum", "PATCH", { id: editMovement, aktif: lama?.aktif !== false, ...payload }, "Materi Movement diperbarui.")) { setEditMovement(""); setFormMovement({ judul: "", keterangan: "", urutan: "0" }); }
    } else if (await kirim("/api/kurikulum", "POST", payload, "Materi Movement ditambahkan.")) setFormMovement({ judul: "", keterangan: "", urutan: "0" });
  }

  const bahanTampil = (bahan || []).filter((b) => !saringKategori || b.kategori === saringKategori);

  return (
    <>
      <PageHead title="Bahan Ajar" subtitle="Bahan ajar pelengkap, bank sesi pendampingan individual, dan program khusus calistung" />
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}
      <nav aria-label="Kamar-kamar Bahan Ajar" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <a className={bagian === "pelengkap" ? "btn" : "btn secondary"} href="/bahan-ajar/pelengkap">Bahan Ajar Pelengkap ({bahan?.length ?? 0})</a>
        <a className={bagian === "bank-sesi" ? "btn" : "btn secondary"} href="/bahan-ajar/bank-sesi">Bank Sesi Pendampingan ({sesi?.length ?? 0})</a>
        <a className={bagian === "calistung" ? "btn" : "btn secondary"} href="/bahan-ajar/calistung">Program Khusus Calistung ({tahap?.length ?? 0} tahap)</a>
        <a className={bagian === "kurikulum" ? "btn" : "btn secondary"} href="/bahan-ajar/kurikulum">Kurikulum ZKC 14 Bulan</a>
      </nav>

      {(!bagian || bagian === "pelengkap") && (<>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Bahan Ajar Pelengkap</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Isi resmi — doa, hadis, surah, hijaiyah, bacaan, dan bahan bahasa — dimuat apa adanya dari Paket Sistem
          Terpadu lembaga (Tahap 2). Kamar ini adalah tempatnya; jangan mengarang isi di luar bahan resmi.
        </p>
        <div className="form-grid">
          <div className="field"><label htmlFor="ba_kat">Kategori *</label>
            <select id="ba_kat" value={formBahan.kategori} onChange={(e) => setFormBahan({ ...formBahan, kategori: e.target.value })}>
              {KATEGORI_BAHAN_AJAR.map((k) => (<option key={k.kode} value={k.kode}>{k.label}</option>))}
            </select></div>
          <div className="field"><label htmlFor="ba_sub">Subkategori (resmi dari prompt lembaga)</label>
            <input id="ba_sub" list="ba_sub_list" placeholder="Pilih atau tulis subkategori" value={formBahan.subkategori} onChange={(e) => setFormBahan({ ...formBahan, subkategori: e.target.value })} />
            <datalist id="ba_sub_list">
              {(SUBKATEGORI_RESAMI[formBahan.kategori] || []).map((s) => (<option key={s} value={s} />))}
            </datalist></div>
          <div className="field"><label htmlFor="ba_judul">Judul *</label>
            <input id="ba_judul" value={formBahan.judul} onChange={(e) => setFormBahan({ ...formBahan, judul: e.target.value })} /></div>
          <div className="field"><label htmlFor="ba_urut">Urutan</label>
            <input id="ba_urut" type="number" value={formBahan.urutan} onChange={(e) => setFormBahan({ ...formBahan, urutan: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="ba_isi">Isi / teks bahan</label>
            <textarea id="ba_isi" rows={4} value={formBahan.isi} onChange={(e) => setFormBahan({ ...formBahan, isi: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="ba_latin">Teks latin / transliterasi</label>
            <textarea id="ba_latin" rows={2} value={formBahan.teks_latin} onChange={(e) => setFormBahan({ ...formBahan, teks_latin: e.target.value })} /></div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="btn" disabled={busy} onClick={() => void simpanBahan()}>{editBahan ? "Simpan Perubahan" : "+ Tambah Bahan"}</button>
          {editBahan ? <button type="button" className="btn secondary" onClick={() => { setEditBahan(""); setFormBahan(formBahanKosong); }}>Batal ubah</button> : null}
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <label htmlFor="ba_saring">Tampilkan kategori</label>
          <select id="ba_saring" value={saringKategori} onChange={(e) => setSaringKategori(e.target.value)}>
            <option value="">Semua kategori</option>
            {KATEGORI_BAHAN_AJAR.map((k) => (<option key={k.kode} value={k.kode}>{k.label}</option>))}
          </select>
        </div>
        <div className="row" style={{ marginTop: 12, gap: 6, flexWrap: "wrap" }}>
          <span className="muted">Kelengkapan paket Islamic Living (target prompt):</span>
          {Object.entries(TARGET_SUBKATEGORI).map(([sub, target]) => {
            const ada = (bahan || []).filter((b) => b.subkategori === sub).length;
            return (<span key={sub} className={ada >= target ? "badge ok" : "badge"}>{sub}: {ada}/{target}</span>);
          })}
        </div>
        <div className="row" style={{ marginTop: 8, gap: 6, flexWrap: "wrap" }}>
          <span className="muted">Kelengkapan menurut dokumen kurikulum (Ummi, Inggris, Arab):</span>
          {TARGET_DOKUMEN.map((t) => {
            const ada = (bahan || []).filter((b) => b.subkategori === t.subkategori).length;
            return (<span key={t.subkategori} className={ada >= t.target ? "badge ok" : "badge"} title={t.keterangan}>{t.subkategori}: {ada}/{t.target}</span>);
          })}
        </div>
        {!bahan ? <LoadingState /> : bahanTampil.length === 0 ? (
          <EmptyState title="Belum ada bahan pada kategori ini" body="Bahan resmi dimuat dari Paket Sistem Terpadu lembaga. Petunjuk kategori: Islamic Living (doa, hadis, surah, hijaiyah, bacaan Ummi), Bahasa Inggris ZKC, Bahasa Arab SAM." />
        ) : (
          <div style={{ marginTop: 10 }}>
            {bahanTampil.map((b) => (
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <div>
                  <strong>{b.judul}</strong>{" "}
                  <span className="muted">· {labelKategoriBahanAjar(b.kategori)}{b.subkategori ? ` · ${b.subkategori}` : ""}</span>
                  {b.isi ? <div className="muted" style={{ whiteSpace: "pre-wrap" }}>{b.isi.slice(0, 220)}{b.isi.length > 220 ? "…" : ""}</div> : null}
                </div>
                <div className="row" style={{ flexShrink: 0 }}>
                  <span className={b.aktif ? "badge ok" : "badge"}>{b.aktif ? "Aktif" : "Nonaktif"}</span>
                  <button type="button" className="btn small secondary" onClick={() => { setEditBahan(b.id); setFormBahan({ kategori: b.kategori, subkategori: b.subkategori || "", judul: b.judul, isi: b.isi || "", teks_latin: b.teks_latin || "", urutan: String(b.urutan) }); }}>Ubah</button>
                  <button type="button" className="btn small secondary" disabled={busy}
                    onClick={() => void kirim("/api/bahan-ajar", "PUT", { id: b.id, kategori: b.kategori, subkategori: b.subkategori, judul: b.judul, isi: b.isi, teks_latin: b.teks_latin, urutan: b.urutan, aktif: !b.aktif }, b.aktif ? "Bahan dinonaktifkan." : "Bahan diaktifkan.")}>
                    {b.aktif ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                  <button type="button" className="btn small danger" disabled={busy}
                    onClick={() => { if (window.confirm(`Hapus bahan "${b.judul}"?`)) void kirim(`/api/bahan-ajar?id=${b.id}`, "DELETE", undefined, "Bahan dihapus."); }}>
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>)}

      {(!bagian || bagian === "bank-sesi") && (<>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Bank Sesi Pendampingan Individual</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Kumpulan rencana sesi pendampingan individual (sesi berjalan sesudah pukul 13.00, satu anak per sesi —
          jadwalnya sendiri diatur di Admission → Jadwal Sesi). Isi resmi bank ini berasal dari bahan lembaga.
        </p>
        <div className="form-grid">
          <div className="field"><label htmlFor="bs_judul">Judul sesi *</label>
            <input id="bs_judul" value={formSesi.judul} onChange={(e) => setFormSesi({ ...formSesi, judul: e.target.value })} /></div>
          <div className="field"><label htmlFor="bs_usia">Kelompok usia</label>
            <input id="bs_usia" placeholder="mis. 3–4 tahun" value={formSesi.kelompok_usia} onChange={(e) => setFormSesi({ ...formSesi, kelompok_usia: e.target.value })} /></div>
          <div className="field"><label htmlFor="bs_durasi">Durasi (menit)</label>
            <input id="bs_durasi" type="number" min="0" value={formSesi.durasi_menit} onChange={(e) => setFormSesi({ ...formSesi, durasi_menit: e.target.value })} /></div>
          <div className="field"><label htmlFor="bs_urut">Urutan</label>
            <input id="bs_urut" type="number" value={formSesi.urutan} onChange={(e) => setFormSesi({ ...formSesi, urutan: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="bs_fokus">Fokus / tujuan sesi</label>
            <textarea id="bs_fokus" rows={2} value={formSesi.fokus} onChange={(e) => setFormSesi({ ...formSesi, fokus: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="bs_langkah">Langkah-langkah sesi</label>
            <textarea id="bs_langkah" rows={4} value={formSesi.langkah} onChange={(e) => setFormSesi({ ...formSesi, langkah: e.target.value })} /></div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="btn" disabled={busy} onClick={() => void simpanSesi()}>{editSesi ? "Simpan Perubahan" : "+ Tambah Sesi"}</button>
          {editSesi ? <button type="button" className="btn secondary" onClick={() => { setEditSesi(""); setFormSesi(formSesiKosong); }}>Batal ubah</button> : null}
        </div>
        {!sesi ? <LoadingState /> : sesi.length === 0 ? (
          <EmptyState title="Bank sesi masih kosong" body="Rencana sesi resmi dimuat dari bahan lembaga (Paket Sistem Terpadu). Tambahkan manual hanya dari bahan yang sudah disahkan." />
        ) : (
          <div style={{ marginTop: 10 }}>
            {sesi.map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <div>
                  <strong>{s.judul}</strong>
                  <span className="muted">{s.kelompok_usia ? ` · usia ${s.kelompok_usia}` : ""}{s.durasi_menit ? ` · ${s.durasi_menit} menit` : ""}</span>
                  {s.fokus ? <div className="muted">{s.fokus}</div> : null}
                </div>
                <div className="row" style={{ flexShrink: 0 }}>
                  <span className={s.aktif ? "badge ok" : "badge"}>{s.aktif ? "Aktif" : "Nonaktif"}</span>
                  <button type="button" className="btn small secondary" onClick={() => { setEditSesi(s.id); setFormSesi({ judul: s.judul, fokus: s.fokus || "", kelompok_usia: s.kelompok_usia || "", durasi_menit: s.durasi_menit ? String(s.durasi_menit) : "", langkah: s.langkah || "", urutan: String(s.urutan) }); }}>Ubah</button>
                  <button type="button" className="btn small secondary" disabled={busy}
                    onClick={() => void kirim("/api/bank-sesi", "PUT", { id: s.id, judul: s.judul, fokus: s.fokus, kelompok_usia: s.kelompok_usia, durasi_menit: s.durasi_menit, langkah: s.langkah, urutan: s.urutan, aktif: !s.aktif }, s.aktif ? "Sesi dinonaktifkan." : "Sesi diaktifkan.")}>
                    {s.aktif ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                  <button type="button" className="btn small danger" disabled={busy}
                    onClick={() => { if (window.confirm(`Hapus sesi "${s.judul}" dari bank?`)) void kirim(`/api/bank-sesi?id=${s.id}`, "DELETE", undefined, "Sesi dihapus dari bank."); }}>
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>)}

      {(!bagian || bagian === "calistung") && (<>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Program Khusus Calistung — Tahapan</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Program khusus calistung Ziel Kids Club memakai aparatus dan tahapan resmi lembaga. Nama tahapan dan
          materi di bawah ini diisi dari Paket Sistem Terpadu — strukturnya siap, isinya menunggu bahan resmi.
        </p>
        <div className="form-grid">
          <div className="field"><label htmlFor="ct_nama">Nama tahap *</label>
            <input id="ct_nama" value={formTahap.nama} onChange={(e) => setFormTahap({ ...formTahap, nama: e.target.value })} /></div>
          <div className="field"><label htmlFor="ct_urut">Urutan</label>
            <input id="ct_urut" type="number" value={formTahap.urutan} onChange={(e) => setFormTahap({ ...formTahap, urutan: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="ct_ket">Keterangan tahap</label>
            <textarea id="ct_ket" rows={2} value={formTahap.keterangan} onChange={(e) => setFormTahap({ ...formTahap, keterangan: e.target.value })} /></div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="btn" disabled={busy} onClick={() => void simpanTahap()}>{editTahap ? "Simpan Perubahan" : "+ Tambah Tahap"}</button>
          {editTahap ? <button type="button" className="btn secondary" onClick={() => { setEditTahap(""); setFormTahap({ nama: "", keterangan: "", urutan: "0" }); }}>Batal ubah</button> : null}
        </div>
        {!tahap ? <LoadingState /> : tahap.length === 0 ? (
          <EmptyState title="Belum ada tahapan calistung" body="Tahapan resmi program khusus calistung dimuat dari Paket Sistem Terpadu lembaga." />
        ) : (
          <div style={{ marginTop: 10 }}>
            {tahap.map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <div><strong>{t.urutan}. {t.nama}</strong> <span className="muted">· {(materi || []).filter((m) => m.tahap_id === t.id).length} materi</span>
                  {t.keterangan ? <div className="muted">{t.keterangan}</div> : null}</div>
                <div className="row" style={{ flexShrink: 0 }}>
                  <span className={t.aktif ? "badge ok" : "badge"}>{t.aktif ? "Aktif" : "Nonaktif"}</span>
                  <button type="button" className="btn small secondary" onClick={() => { setEditTahap(t.id); setFormTahap({ nama: t.nama, keterangan: t.keterangan || "", urutan: String(t.urutan) }); }}>Ubah</button>
                  <button type="button" className="btn small secondary" disabled={busy}
                    onClick={() => void kirim("/api/calistung", "PUT", { kind: "tahap", id: t.id, nama: t.nama, keterangan: t.keterangan, urutan: t.urutan, aktif: !t.aktif }, t.aktif ? "Tahap dinonaktifkan." : "Tahap diaktifkan.")}>
                    {t.aktif ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                  <button type="button" className="btn small danger" disabled={busy}
                    onClick={() => { if (window.confirm(`Hapus tahap "${t.nama}" beserta seluruh materinya?`)) void kirim(`/api/calistung?kind=tahap&id=${t.id}`, "DELETE", undefined, "Tahap dan materinya dihapus."); }}>
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Materi Calistung per Tahap</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="cm_tahap">Tahap *</label>
            <select id="cm_tahap" value={formMateri.tahap_id} onChange={(e) => setFormMateri({ ...formMateri, tahap_id: e.target.value })}>
              <option value="">Pilih tahap</option>
              {(tahap || []).map((t) => (<option key={t.id} value={t.id}>{t.nama}</option>))}
            </select></div>
          <div className="field"><label htmlFor="cm_nama">Nama materi *</label>
            <input id="cm_nama" value={formMateri.nama} onChange={(e) => setFormMateri({ ...formMateri, nama: e.target.value })} /></div>
          <div className="field"><label htmlFor="cm_urut">Urutan</label>
            <input id="cm_urut" type="number" value={formMateri.urutan} onChange={(e) => setFormMateri({ ...formMateri, urutan: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="cm_ket">Keterangan materi</label>
            <textarea id="cm_ket" rows={2} value={formMateri.keterangan} onChange={(e) => setFormMateri({ ...formMateri, keterangan: e.target.value })} /></div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="btn" disabled={busy} onClick={() => void simpanMateri()}>{editMateri ? "Simpan Perubahan" : "+ Tambah Materi"}</button>
          {editMateri ? <button type="button" className="btn secondary" onClick={() => { setEditMateri(""); setFormMateri({ tahap_id: "", nama: "", keterangan: "", urutan: "0" }); }}>Batal ubah</button> : null}
        </div>
        {!materi ? <LoadingState /> : materi.length === 0 ? (
          <EmptyState title="Belum ada materi calistung" body="Buat tahapannya dulu, lalu isi materi resmi dari Paket Sistem Terpadu lembaga." />
        ) : (
          <div style={{ marginTop: 10 }}>
            {materi.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <div><strong>{m.nama}</strong> <span className="muted">· tahap {(tahap || []).find((t) => t.id === m.tahap_id)?.nama || "?"}</span>
                  {m.keterangan ? <div className="muted">{m.keterangan}</div> : null}</div>
                <div className="row" style={{ flexShrink: 0 }}>
                  <span className={m.aktif ? "badge ok" : "badge"}>{m.aktif ? "Aktif" : "Nonaktif"}</span>
                  <button type="button" className="btn small secondary" onClick={() => { setEditMateri(m.id); setFormMateri({ tahap_id: m.tahap_id, nama: m.nama, keterangan: m.keterangan || "", urutan: String(m.urutan) }); }}>Ubah</button>
                  <button type="button" className="btn small secondary" disabled={busy}
                    onClick={() => void kirim("/api/calistung", "PUT", { kind: "materi", id: m.id, tahap_id: m.tahap_id, nama: m.nama, keterangan: m.keterangan, urutan: m.urutan, aktif: !m.aktif }, m.aktif ? "Materi dinonaktifkan." : "Materi diaktifkan.")}>
                    {m.aktif ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                  <button type="button" className="btn small danger" disabled={busy}
                    onClick={() => { if (window.confirm(`Hapus materi "${m.nama}"?`)) void kirim(`/api/calistung?kind=materi&id=${m.id}`, "DELETE", undefined, "Materi dihapus."); }}>
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>)}

      {(!bagian || bagian === "kurikulum") && (<>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Kurikulum ZKC — November 2026 s.d. Desember 2027</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Empat belas bulan sesuai prompt lembaga. Setiap bulan memuat tema bulanan, fondasi yang dilatih, materi
          inti, menu sensory play, menu movement, dan subtema mingguan. Tema dan isi resmi dimuat apa adanya dari
          Paket Sistem Terpadu — baris bulan yang masih kosong berarti isinya belum dimuat, bukan dihapus.
        </p>
        {!kurikulum ? <LoadingState /> : (
          <div>
            {kurikulum.map((b) => {
              const terisi = [b.tema, b.fondasi, b.materi_inti, b.menu_sensory, b.menu_movement, b.subtema].filter(Boolean).length;
              return (
                <div key={b.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <strong>{labelBulan(b.bulan)}</strong>{" "}
                      {b.tema ? <span>· Tema: {b.tema}</span> : <span className="muted">· tema resmi belum dimuat dari paket</span>}
                      <div className="muted" style={{ fontSize: 13 }}>
                        Komponen terisi {terisi}/6 — Fondasi {b.fondasi ? "✓" : "—"} · Materi inti {b.materi_inti ? "✓" : "—"} · Sensory {b.menu_sensory ? "✓" : "—"} · Movement {b.menu_movement ? "✓" : "—"} · Subtema {b.subtema ? "✓" : "—"}
                      </div>
                    </div>
                    <button type="button" className="btn small secondary" onClick={() => {
                      if (editBulan === b.bulan) { setEditBulan(""); return; }
                      setEditBulan(b.bulan);
                      setFormBulan({ tema: b.tema || "", fondasi: b.fondasi || "", materi_inti: b.materi_inti || "", menu_sensory: b.menu_sensory || "", menu_movement: b.menu_movement || "", subtema: b.subtema || "" });
                    }}>{editBulan === b.bulan ? "Tutup" : "Isi / Ubah"}</button>
                  </div>
                  {editBulan === b.bulan ? (
                    <div style={{ marginTop: 10 }}>
                      <div className="form-grid">
                        <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="kb_tema">Tema bulanan</label>
                          <input id="kb_tema" value={formBulan.tema} onChange={(e) => setFormBulan({ ...formBulan, tema: e.target.value })} /></div>
                        <div className="field"><label htmlFor="kb_fondasi">Fondasi yang dilatih</label>
                          <textarea id="kb_fondasi" rows={3} value={formBulan.fondasi} onChange={(e) => setFormBulan({ ...formBulan, fondasi: e.target.value })} /></div>
                        <div className="field"><label htmlFor="kb_materi">Materi inti</label>
                          <textarea id="kb_materi" rows={3} value={formBulan.materi_inti} onChange={(e) => setFormBulan({ ...formBulan, materi_inti: e.target.value })} /></div>
                        <div className="field"><label htmlFor="kb_sensory">Menu sensory play</label>
                          <textarea id="kb_sensory" rows={3} value={formBulan.menu_sensory} onChange={(e) => setFormBulan({ ...formBulan, menu_sensory: e.target.value })} /></div>
                        <div className="field"><label htmlFor="kb_movement">Menu movement</label>
                          <textarea id="kb_movement" rows={3} value={formBulan.menu_movement} onChange={(e) => setFormBulan({ ...formBulan, menu_movement: e.target.value })} /></div>
                        <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="kb_subtema">Subtema mingguan</label>
                          <textarea id="kb_subtema" rows={3} value={formBulan.subtema} onChange={(e) => setFormBulan({ ...formBulan, subtema: e.target.value })} /></div>
                      </div>
                      <div className="row" style={{ marginTop: 10 }}>
                        <button type="button" className="btn" disabled={busy} onClick={() => void simpanBulan()}>Simpan {labelBulan(b.bulan)}</button>
                        <button type="button" className="btn secondary" onClick={() => setEditBulan("")}>Batal</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Kurikulum Kelas Movement — Peta Materi</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Peta materi Kelas Movement lembaga (kelasnya berjalan 90 menit, kuota 6, sesudah pukul 13.00 — jadwal di
          Admission). Materi resmi dimuat dari Paket Sistem Terpadu.
        </p>
        <div className="form-grid">
          <div className="field"><label htmlFor="mv_judul">Judul materi *</label>
            <input id="mv_judul" value={formMovement.judul} onChange={(e) => setFormMovement({ ...formMovement, judul: e.target.value })} /></div>
          <div className="field"><label htmlFor="mv_urut">Urutan</label>
            <input id="mv_urut" type="number" value={formMovement.urutan} onChange={(e) => setFormMovement({ ...formMovement, urutan: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="mv_ket">Keterangan</label>
            <textarea id="mv_ket" rows={2} value={formMovement.keterangan} onChange={(e) => setFormMovement({ ...formMovement, keterangan: e.target.value })} /></div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="btn" disabled={busy} onClick={() => void simpanMovement()}>{editMovement ? "Simpan Perubahan" : "+ Tambah Materi"}</button>
          {editMovement ? <button type="button" className="btn secondary" onClick={() => { setEditMovement(""); setFormMovement({ judul: "", keterangan: "", urutan: "0" }); }}>Batal ubah</button> : null}
        </div>
        {!movement ? <LoadingState /> : movement.length === 0 ? (
          <EmptyState title="Peta materi Movement masih kosong" body="Materi resmi kurikulum Kelas Movement dimuat dari Paket Sistem Terpadu lembaga." />
        ) : (
          <div style={{ marginTop: 10 }}>
            {movement.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <div><strong>{m.judul}</strong>{m.keterangan ? <div className="muted">{m.keterangan}</div> : null}</div>
                <div className="row" style={{ flexShrink: 0 }}>
                  <span className={m.aktif ? "badge ok" : "badge"}>{m.aktif ? "Aktif" : "Nonaktif"}</span>
                  <button type="button" className="btn small secondary" onClick={() => { setEditMovement(m.id); setFormMovement({ judul: m.judul, keterangan: m.keterangan || "", urutan: String(m.urutan) }); }}>Ubah</button>
                  <button type="button" className="btn small secondary" disabled={busy}
                    onClick={() => void kirim("/api/kurikulum", "PATCH", { id: m.id, judul: m.judul, keterangan: m.keterangan, urutan: m.urutan, aktif: !m.aktif }, m.aktif ? "Materi dinonaktifkan." : "Materi diaktifkan.")}>
                    {m.aktif ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                  <button type="button" className="btn small danger" disabled={busy}
                    onClick={() => { if (window.confirm(`Hapus materi Movement "${m.judul}"?`)) void kirim(`/api/kurikulum?id=${m.id}`, "DELETE", undefined, "Materi Movement dihapus."); }}>
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>)}
    </>
  );
}
