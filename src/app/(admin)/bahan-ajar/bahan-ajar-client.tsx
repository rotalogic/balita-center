"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { kirimJson } from "@/lib/http";
import { KATEGORI_BAHAN_AJAR, labelKategoriBahanAjar } from "@/lib/bahan-ajar";

// Kamar Bahan Ajar & Program Khusus (kerangka Tahap 2). Struktur dan
// formulirnya lengkap; isi resminya dimuat dari Paket Sistem Terpadu
// lembaga — halaman ini tidak mengarang isi apa pun.

type Bahan = { id: string; kategori: string; subkategori: string | null; judul: string; isi: string | null; teks_latin: string | null; urutan: number; aktif: boolean };
type Sesi = { id: string; judul: string; fokus: string | null; kelompok_usia: string | null; durasi_menit: number | null; langkah: string | null; urutan: number; aktif: boolean };
type Tahap = { id: string; nama: string; keterangan: string | null; urutan: number; aktif: boolean };
type Materi = { id: string; tahap_id: string; nama: string; keterangan: string | null; urutan: number; aktif: boolean };

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

  const load = useCallback(async () => {
    try {
      const [b, s, c] = await Promise.all([
        fetch("/api/bahan-ajar").then((r) => r.json()),
        fetch("/api/bank-sesi").then((r) => r.json()),
        fetch("/api/calistung").then((r) => r.json()),
      ]);
      if (b.ok) setBahan(b.bahan as Bahan[]);
      if (s.ok) setSesi(s.sesi as Sesi[]);
      if (c.ok) { setTahap(c.tahap as Tahap[]); setMateri(c.materi as Materi[]); }
      if (!b.ok || !s.ok || !c.ok) setError(b.error || s.error || c.error || "Gagal memuat data.");
    } catch {
      setError("Koneksi terputus saat memuat data.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function kirim(url: string, method: "POST" | "PUT" | "DELETE", body: unknown, sukses: string) {
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
          <div className="field"><label htmlFor="ba_sub">Subkategori</label>
            <input id="ba_sub" placeholder="mis. Doa Harian / Hadis / Surah / Hijaiyah" value={formBahan.subkategori} onChange={(e) => setFormBahan({ ...formBahan, subkategori: e.target.value })} /></div>
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
    </>
  );
}
