// Penanda alergi yang menonjol untuk peserta insidentil & event.
export default function LencanaAlergi({ tidakAda, jenis }: { tidakAda: boolean; jenis: string | null }) {
  if (tidakAda) return <span className="muted">Tidak ada alergi yang diketahui</span>;
  return (
    <span className="badge danger" title="Alergi — buka detail untuk pemicu, reaksi, dan tindakan">
      ⚠ ALERGI: {jenis || "ada"}
    </span>
  );
}
