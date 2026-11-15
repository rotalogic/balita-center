"use client";

import { useCallback, useEffect, useState } from "react";
import { kataSkor } from "@/lib/skala";

type Ringkasan = {
  bulan: string;
  kehadiran: { hadir: number; izin: number; sakit: number; alpa: number };
  laporan: { terbit: number; draf: number; proses: number };
  aktivitas: {
    total: number;
    per_rating: Array<{ rating: number; jumlah: number }>;
    per_area: Array<{ area: string; jumlah: number }>;
  };
  milestone: Array<{ level: string; jumlah: number }>;
  stppa: { dinilai: number; tercapai: number };
  perkembangan_terakhir: Record<string, unknown> | null;
};

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function labelBulan(bulan: string): string {
  const [y, m] = bulan.split("-").map(Number);
  return `${NAMA_BULAN[(m || 1) - 1]} ${y}`;
}

// Lapisan bulanan Satu Meja Laporan (Tur Demo Layar 3): agregasi otomatis
// dari laporan harian, absensi, dan penilaian bulan terpilih. Guru tidak
// mengetik ulang; angka di sini membaca data yang sama dengan harian.
export function LaporanBulanan({ childId }: { childId: string }) {
  const kini = new Date();
  const [bulan, setBulan] = useState(
    `${kini.getFullYear()}-${String(kini.getMonth() + 1).padStart(2, "0")}`
  );
  const [data, setData] = useState<Ringkasan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(
    async (b: string) => {
      setMemuat(true);
      setError(null);
      try {
        const res = await fetch(`/api/children/${childId}/bulanan?bulan=${b}`);
        const d = await res.json();
        if (d.ok) setData(d as Ringkasan);
        else setError(d.error || "Ringkasan bulanan tidak dapat dimuat.");
      } catch {
        setError("Tidak dapat menghubungi server.");
      } finally {
        setMemuat(false);
      }
    },
    [childId]
  );

  useEffect(() => {
    void muat(bulan);
  }, [bulan, muat]);

  const kosong =
    data &&
    data.kehadiran.hadir + data.kehadiran.izin + data.kehadiran.sakit + data.kehadiran.alpa === 0 &&
    data.laporan.terbit + data.laporan.draf + data.laporan.proses === 0 &&
    data.aktivitas.total === 0;

  return (
    <div style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
      <div className="row spread">
        <h3 style={{ margin: 0 }}>Laporan Bulanan</h3>
        <label className="row" style={{ gap: 8 }}>
          <span className="muted">Bulan</span>
          <input
            type="month"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            aria-label="Pilih bulan ringkasan"
          />
        </label>
      </div>
      {memuat ? (
        <p className="muted">Menghitung ringkasan {labelBulan(bulan)}…</p>
      ) : error ? (
        <p className="error" role="alert">{error}</p>
      ) : !data || kosong ? (
        <p className="muted">
          Belum ada kehadiran, laporan, atau penilaian tercatat pada {labelBulan(bulan)}.
          Ringkasan terisi otomatis dari laporan harian dan absensi bulan itu.
        </p>
      ) : (
        <div className="grid two">
          <div>
            <h4 style={{ marginBottom: 6 }}>Kehadiran &amp; Laporan</h4>
            <ul className="timeline">
              <li>
                <time>Kehadiran</time>
                <div>
                  Hadir {data.kehadiran.hadir} · Izin {data.kehadiran.izin} · Sakit{" "}
                  {data.kehadiran.sakit} · Tanpa keterangan {data.kehadiran.alpa}
                </div>
              </li>
              <li>
                <time>Laporan harian</time>
                <div>
                  Terbit {data.laporan.terbit} · Dalam proses {data.laporan.proses} · Draf guru{" "}
                  {data.laporan.draf}. Hari absen tidak dibuatkan laporan, sesuai aturan lembaga.
                </div>
              </li>
              {data.stppa.dinilai > 0 ? (
                <li>
                  <time>STPPA</time>
                  <div>
                    {data.stppa.tercapai} dari {data.stppa.dinilai} butir dinilai tercapai bulan ini.
                  </div>
                </li>
              ) : null}
              {data.milestone.length > 0 ? (
                <li>
                  <time>Milestone</time>
                  <div>
                    {data.milestone.map((m) => `${m.level}: ${m.jumlah}`).join(" · ")}
                  </div>
                </li>
              ) : null}
            </ul>
          </div>
          <div>
            <h4 style={{ marginBottom: 6 }}>Aktivitas &amp; Penilaian</h4>
            {data.aktivitas.total === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Belum ada aktivitas tercatat bulan ini.</p>
            ) : (
              <>
                <p style={{ marginTop: 0 }}>
                  {data.aktivitas.total} aktivitas tercatat.{" "}
                  {data.aktivitas.per_rating
                    .map((r) => `${kataSkor(r.rating) || `Skor ${r.rating}`}: ${r.jumlah}`)
                    .join(" · ")}
                </p>
                <p className="muted" style={{ margin: 0 }}>
                  Per area: {data.aktivitas.per_area.map((a) => `${a.area} ${a.jumlah}`).join(" · ")}
                </p>
              </>
            )}
            {data.perkembangan_terakhir ? (
              <p style={{ marginBottom: 0 }}>
                <strong>Catatan guru bulan ini:</strong>{" "}
                {String(data.perkembangan_terakhir.teacher_notes || "Penilaian berkala tercatat.")}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
