"use client";

// Checklist Syarat Terbit versi hidup di editor. Aturannya SAMA dengan
// src/lib/syarat-terbit.ts (dan trigger database): satu sumber kebenaran.
export type SyaratState = {
  fasilitator: boolean;
  aktivitas: boolean;
  foto: boolean;
};

export function cekSyaratLokal(input: {
  lead_facilitator_id?: string;
  activities: Array<{ title: string; apparatus?: string; rating?: string | number; photo_url?: string }>;
  photoUrls: string[];
}): { ok: boolean; kurang: string[]; state: SyaratState } {
  const aktivitas = input.activities.filter((a) => a.title);
  const berbintang = aktivitas.some(
    (a) => Number(a.rating || 0) > 0 && (a.apparatus || "").trim() !== ""
  );
  const adaFoto = input.photoUrls.filter(Boolean).length > 0 || aktivitas.some((a) => (a.photo_url || "").trim() !== "");

  const state: SyaratState = {
    fasilitator: Boolean(input.lead_facilitator_id),
    aktivitas: berbintang,
    foto: adaFoto,
  };
  const kurang: string[] = [];
  if (!state.fasilitator) kurang.push("Fasilitator utama belum dipilih.");
  if (!state.aktivitas) kurang.push("Belum ada aktivitas dengan rating bintang dan aparatus terisi.");
  if (!state.foto) kurang.push("Belum ada foto — unggah minimal 1 foto dokumentasi.");
  return { ok: kurang.length === 0, kurang, state };
}

export function SyaratChecklist({ state }: { state: SyaratState }) {
  const baris: Array<[keyof SyaratState, string, string]> = [
    ["fasilitator", "Fasilitator utama dipilih", "Pilih Fasilitator Utama di panel kanan"],
    ["aktivitas", "Aktivitas berbintang + aparatus terisi", "Isi judul, aparatus, dan rating 1–4"],
    ["foto", "Minimal 1 foto dokumentasi", "Unggah foto di bagian Foto & Video"],
  ];
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>Syarat Terbit</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {baris.map(([key, label, hint]) => (
          <li key={key} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0" }}>
            <span aria-hidden="true" style={{ color: state[key] ? "#2e7d4f" : "#b3261e", fontWeight: 700 }}>
              {state[key] ? "✓" : "○"}
            </span>
            <span>
              <span style={{ display: "block" }}>{label}</span>
              {!state[key] ? <span className="muted" style={{ fontSize: 12 }}>{hint}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>
        {Object.values(state).every(Boolean)
          ? "Semua syarat lengkap — laporan siap dikirim untuk review."
          : "Laporan tetap bisa disimpan sebagai draft walau syarat belum lengkap."}
      </p>
    </div>
  );
}
