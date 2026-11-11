"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { tanggalPanjang } from "@/lib/format";
import LencanaAlergi from "@/components/lencana-alergi";

type Ins = {
  id: string; child_name: string; parent_name: string; wa_number: string; email: string | null;
  kegiatan_jenis: string; kegiatan_label: string | null; tanggal: string;
  berbayar: boolean; biaya: number | null; setuju_ketentuan_bayar: boolean;
  alergi_tidak_ada: boolean; alergi_jenis: string | null; alergi_pemicu: string | null;
  alergi_reaksi: string | null; alergi_tindakan: string | null;
  setuju_dokumentasi: boolean; status: string; child_id: string | null;
  child_birth_date: string | null; child_age_months: number | null; catatan: string | null;
  event_edisi_id: string | null; closing_lead_id: string | null;
  branch_id: string | null;
};
type Paket = {
  id: string; kegiatan: string; aspek_dilatih: string; cara_anak: string; ide_rumah: string;
  saluran: string | null; dikirim_at: string | null;
};
type Cabang = { id: string; name: string };

export default function InsidentilDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [ins, setIns] = useState<Ins | null>(null);
  const [paket, setPaket] = useState<Paket[]>([]);
  const [branches, setBranches] = useState<Cabang[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pk, setPk] = useState({ kegiatan: "", aspek_dilatih: "", cara_anak: "", ide_rumah: "" });
  const [saluran, setSaluran] = useState("whatsapp");
  const [conv, setConv] = useState({ branch_id: "", child_birth_date: "" });
  const [aspek, setAspek] = useState<Array<{ label: string; nilai: string }>>(
    Array.from({ length: 6 }, () => ({ label: "", nilai: "Muncul" }))
  );
  const [catatanLaporan, setCatatanLaporan] = useState("");
  const [laporanAda, setLaporanAda] = useState<{ dikirim_at: string | null; saluran: string | null } | null>(null);
  const [namaEdisi, setNamaEdisi] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/admission/insidentil/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError(d.error); return; }
        setIns(d.insidentil);
        setPaket(d.paket || []);
        setBranches(d.branches || []);
        setConv({
          branch_id: d.insidentil.branch_id || "",
          child_birth_date: (d.insidentil.child_birth_date || "").slice(0, 10),
        });
        const terakhir = (d.paket || [])[0];
        if (terakhir) {
          setPk({
            kegiatan: terakhir.kegiatan, aspek_dilatih: terakhir.aspek_dilatih,
            cara_anak: terakhir.cara_anak, ide_rumah: terakhir.ide_rumah,
          });
        }
        setNamaEdisi(d.edisi?.nama || null);
        if (d.laporan_ringan) {
          const lr = d.laporan_ringan as { aspek: Array<{ label: string; nilai: string }>; catatan: string | null; dikirim_at: string | null; saluran: string | null };
          if (Array.isArray(lr.aspek) && lr.aspek.length === 6) setAspek(lr.aspek);
          setCatatanLaporan(lr.catatan || "");
          setLaporanAda({ dikirim_at: lr.dikirim_at, saluran: lr.saluran });
        } else {
          setLaporanAda(null);
        }
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  }, [params.id]);

  useEffect(load, [load]);

  async function aksi(body: Record<string, unknown>, pesan: string) {
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/admission/insidentil/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) { setError(d.error); return null; }
    setInfo(pesan);
    load();
    return d;
  }

  if (error && !ins) return (<><PageHead title="Detail Insidentil" /><ErrorState message={error} /></>);
  if (!ins) return (<><PageHead title="Detail Insidentil" /><LoadingState /></>);

  const paketAktif = paket[0];

  return (
    <>
      <PageHead title={`Insidentil — ${ins.child_name}`} subtitle="Data peserta, alergi, paket edukasi, dan konversi menjadi anggota" />
      <p style={{ marginTop: 0 }}><Link href="/admission/insidentil">← Daftar Insidentil</Link></p>
      {error ? <ErrorState message={error} /> : null}
      {info ? <p className="success" role="status">{info}</p> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Data Peserta</h2>
        <dl>
          <dt className="muted">Anak</dt><dd><strong>{ins.child_name}</strong>{ins.child_age_months ? ` · ${ins.child_age_months} bulan` : ""}</dd>
          <dt className="muted">Orang tua</dt><dd>{ins.parent_name} · <span className="mono">{ins.wa_number}</span>{ins.email ? ` · ${ins.email}` : ""}</dd>
          <dt className="muted">Kegiatan</dt><dd>{ins.kegiatan_label || ins.kegiatan_jenis} · {tanggalPanjang(ins.tanggal)}</dd>
          <dt className="muted">Pembayaran</dt><dd>{ins.berbayar ? `Berbayar${ins.biaya ? ` Rp ${Number(ins.biaya).toLocaleString("id-ID")}` : ""} · ketentuan tidak dapat dibatalkan ${ins.setuju_ketentuan_bayar ? "disetujui" : "belum disetujui"}` : "Gratis"}</dd>
          <dt className="muted">Dokumentasi foto</dt><dd>{ins.setuju_dokumentasi ? "Disetujui orang tua" : "Tidak disetujui"}</dd>
          <dt className="muted">Status</dt><dd>{ins.status.replace(/_/g, " ")}{ins.child_id ? <> · <Link href={`/anak/${ins.child_id}`}>Buka profil anggota</Link></> : ""}</dd>
          {ins.catatan ? (<><dt className="muted">Catatan</dt><dd>{ins.catatan}</dd></>) : null}
        </dl>
        <h3>Alergi Anak</h3>
        <p><LencanaAlergi tidakAda={ins.alergi_tidak_ada} jenis={ins.alergi_jenis} /></p>
        {!ins.alergi_tidak_ada ? (
          <dl>
            <dt className="muted">Pemicu</dt><dd>{ins.alergi_pemicu || "-"}</dd>
            <dt className="muted">Reaksi</dt><dd>{ins.alergi_reaksi || "-"}</dd>
            <dt className="muted">Tindakan orang tua</dt><dd>{ins.alergi_tindakan || "-"}</dd>
          </dl>
        ) : null}
        {ins.status !== "jadi_anggota" && ins.status !== "batal" ? (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn small secondary" type="button" disabled={busy} onClick={() => void aksi({ status: "terjadwal" }, "Status menjadi terjadwal.")}>Tandai Terjadwal</button>
            <button className="btn small danger" type="button" disabled={busy} onClick={() => void aksi({ status: "batal" }, "Pendaftaran dibatalkan.")}>Batalkan</button>
          </div>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Paket Dokumentasi Edukasi</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Dokumentasi dikirim bukan sebagai foto semata, melainkan paket edukasi: kegiatan anak hari itu,
          aspek perkembangan yang dilatih, cara anak menjalaninya, dan satu ide lanjutan di rumah —
          dikirim bersama laporan ringan ke WhatsApp atau email orang tua, dengan isi dan waktu kirim tercatat.
        </p>
        <div className="form-grid">
          <div className="field"><label htmlFor="pk_keg">Kegiatan anak hari itu</label>
            <textarea id="pk_keg" rows={2} value={pk.kegiatan} onChange={(e) => setPk({ ...pk, kegiatan: e.target.value })} /></div>
          <div className="field"><label htmlFor="pk_aspek">Aspek perkembangan yang dilatih</label>
            <textarea id="pk_aspek" rows={2} value={pk.aspek_dilatih} onChange={(e) => setPk({ ...pk, aspek_dilatih: e.target.value })} /></div>
          <div className="field"><label htmlFor="pk_cara">Cara anak menjalaninya</label>
            <textarea id="pk_cara" rows={2} value={pk.cara_anak} onChange={(e) => setPk({ ...pk, cara_anak: e.target.value })} /></div>
          <div className="field"><label htmlFor="pk_ide">Satu ide lanjutan di rumah</label>
            <textarea id="pk_ide" rows={2} value={pk.ide_rumah} onChange={(e) => setPk({ ...pk, ide_rumah: e.target.value })} /></div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button className="btn secondary" type="button" disabled={busy}
            onClick={() => void aksi({ aksi: "paket", paket_id: paketAktif && !paketAktif.dikirim_at ? paketAktif.id : undefined, ...pk }, "Paket edukasi tersimpan.")}>
            Simpan Paket
          </button>
          {paketAktif ? (
            <>
              <select value={saluran} onChange={(e) => setSaluran(e.target.value)} aria-label="Saluran kirim">
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </select>
              <button className="btn" type="button" disabled={busy || Boolean(paketAktif.dikirim_at)}
                onClick={() => void aksi({ aksi: "kirim", paket_id: paketAktif.id, saluran }, `Pengiriman paket tercatat lewat ${saluran}.`)}>
                {paketAktif.dikirim_at ? `Terkirim ${tanggalPanjang(paketAktif.dikirim_at)} via ${paketAktif.saluran}` : "Catat Terkirim ke Orang Tua"}
              </button>
            </>
          ) : null}
        </div>
        {paket.length > 1 ? (
          <p className="muted">Riwayat paket: {paket.length} paket tersimpan untuk peserta ini.</p>
        ) : null}
      </div>

      {ins.event_edisi_id ? (
        <div className="card" style={{ marginTop: 12 }}>
          <h2 style={{ marginTop: 0 }}>Laporan Ringan Pop Up</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Satu halaman untuk peserta {namaEdisi ? <strong>{namaEdisi}</strong> : "edisi ini"}: tepat enam aspek
            bernilai kata <strong>Bersinar · Muncul · Berlatih</strong> — tanpa bintang dan tanpa skor. Nama aspek
            mengikuti tema edisi. Laporan dikirim bersama Paket Dokumentasi Edukasi di atas.
          </p>
          {aspek.map((a, i) => (
            <div className="form-grid" key={i} style={{ marginTop: 8 }}>
              <div className="field">
                <label htmlFor={`lr_label_${i}`}>Aspek {i + 1}</label>
                <input id={`lr_label_${i}`} value={a.label} placeholder="mis. Keberanian Mencoba"
                  onChange={(e) => setAspek((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              </div>
              <div className="field">
                <label htmlFor={`lr_nilai_${i}`}>Nilai Kata</label>
                <select id={`lr_nilai_${i}`} value={a.nilai}
                  onChange={(e) => setAspek((p) => p.map((x, j) => (j === i ? { ...x, nilai: e.target.value } : x)))}>
                  <option value="Bersinar">Bersinar</option>
                  <option value="Muncul">Muncul</option>
                  <option value="Berlatih">Berlatih</option>
                </select>
              </div>
            </div>
          ))}
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor="lr_catatan">Catatan Penutup Laporan</label>
            <textarea id="lr_catatan" rows={2} value={catatanLaporan} onChange={(e) => setCatatanLaporan(e.target.value)} />
          </div>
          <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
            <button className="btn secondary" type="button" disabled={busy}
              onClick={() => void aksi({ aksi: "laporan_ringan", aspek, catatan: catatanLaporan }, "Laporan Ringan tersimpan.")}>
              Simpan Laporan Ringan
            </button>
            {laporanAda && !laporanAda.dikirim_at ? (
              <button className="btn" type="button" disabled={busy}
                onClick={() => void aksi({ aksi: "kirim_laporan", saluran }, `Pengiriman Laporan Ringan tercatat lewat ${saluran}.`)}>
                Catat Terkirim ke Orang Tua
              </button>
            ) : null}
            {laporanAda?.dikirim_at ? (
              <span className="badge ok">✓ Terkirim {tanggalPanjang(laporanAda.dikirim_at)} via {laporanAda.saluran}</span>
            ) : null}
          </div>

          <h3 style={{ marginBottom: 4 }}>Jalur Closing — Lanjut ke Trial ZKC</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Peserta yang berminat lanjut dihubungkan ke jalur Trial tanpa mengisi ulang data dasar:
            sebuah lead Admission dibuat dari data peserta ini.
          </p>
          {ins.closing_lead_id ? (
            <p><span className="badge ok">✓ Sudah terhubung ke Admission</span>{" "}
              <Link className="btn small secondary" href="/admission">Buka Admission</Link></p>
          ) : (
            <button className="btn" type="button" disabled={busy}
              onClick={() => void aksi({ aksi: "closing" }, "Lead Admission dibuat dari data peserta — lanjutkan di menu Admission.")}>
              Hubungkan ke Trial ZKC
            </button>
          )}
        </div>
      ) : null}

      {!ins.child_id ? (
        <div className="card" style={{ marginTop: 12 }}>
          <h2 style={{ marginTop: 0 }}>Jadikan Anggota</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Data dasar terbawa menjadi profil anggota tanpa mengisi ulang: nama anak, tanggal lahir,
            orang tua sebagai wali utama, persetujuan dokumentasi, dan catatan alergi ke catatan kesehatan anak.
          </p>
          <div className="form-grid">
            <div className="field"><label htmlFor="cv_cabang">Cabang *</label>
              <select id="cv_cabang" value={conv.branch_id} onChange={(e) => setConv({ ...conv, branch_id: e.target.value })}>
                <option value="">Pilih cabang…</option>
                {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select></div>
            <div className="field"><label htmlFor="cv_lahir">Tanggal lahir anak *</label>
              <input id="cv_lahir" type="date" value={conv.child_birth_date} onChange={(e) => setConv({ ...conv, child_birth_date: e.target.value })} /></div>
          </div>
          <button className="btn" type="button" disabled={busy} style={{ marginTop: 10 }}
            onClick={async () => {
              const d = await aksi({ aksi: "convert", branch_id: conv.branch_id || undefined, child_birth_date: conv.child_birth_date || undefined }, "Anak kini menjadi anggota.");
              if (d?.child_id) router.push(`/anak/${d.child_id}`);
            }}>
            Buat Profil Anggota dari Data Ini
          </button>
        </div>
      ) : null}
    </>
  );
}
