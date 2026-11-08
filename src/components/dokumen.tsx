// Gaya bersama untuk dokumen cetak (laporan anak, kwitansi, rapor).
// Dipakai lewat <GayaDokumen /> di halaman cetak; PDF dihasilkan dialog cetak peramban.
export function GayaDokumen() {
  return (
    <style>{`
      .dokumen-wrap { background:#eef1f6; min-height:100vh; padding:24px 12px; font-family: ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif; color:#16202e; }
      .lembar { max-width:780px; margin:0 auto; background:#fff; border-radius:12px; padding:32px 36px; box-shadow:0 10px 30px rgba(16,24,40,.08); }
      .baris { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; }
      .merek { font-size:13px; letter-spacing:.14em; font-weight:700; color:#3c5a8a; }
      .cabang { font-size:12px; color:#5b6b82; margin-top:2px; }
      .judul { font-size:24px; font-weight:800; margin:0 0 2px; letter-spacing:.02em; }
      .sub { font-size:12px; color:#5b6b82; }
      .kotak { display:grid; gap:14px; margin:20px 0 6px; padding:16px 0; border-top:1px solid #e6eaf1; border-bottom:1px solid #e6eaf1; }
      .kotak div span { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#7a8798; margin-bottom:4px; }
      .kotak div strong { font-size:13px; font-weight:600; }
      h3 { font-size:12px; margin:22px 0 10px; text-transform:uppercase; letter-spacing:.08em; color:#3c5a8a; }
      table { width:100%; border-collapse:collapse; font-size:12.5px; }
      th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#7a8798; border-bottom:1px solid #e6eaf1; padding:8px 0; }
      td { padding:9px 0; border-bottom:1px solid #f1f4f9; vertical-align:top; }
      td.kanan, th.kanan { text-align:right; }
      .catatan { font-size:12.5px; color:#3f4f63; line-height:1.6; }
      .total { display:flex; justify-content:space-between; padding:14px 0; font-size:15px; font-weight:800; }
      .pil { display:inline-block; font-size:11px; font-weight:700; letter-spacing:.06em; padding:4px 10px; border-radius:999px; background:#e8f6ee; color:#027a48; border:1px solid #b7e4c7; }
      .tanda { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:34px; }
      .tanda .nama { margin-top:44px; font-size:13px; font-weight:600; border-top:1px solid #c9d3e0; padding-top:6px; }
      .kaki { margin-top:26px; padding-top:14px; border-top:1px dashed #dfe5ee; font-size:11px; color:#7a8798; line-height:1.6; }
      .aksi { max-width:780px; margin:0 auto 14px; display:flex; gap:8px; justify-content:flex-end; }
      .aksi button, .aksi a { font:inherit; font-size:13px; padding:8px 14px; border-radius:8px; border:1px solid #c9d3e0; background:#fff; cursor:pointer; text-decoration:none; color:#16202e; }
      .aksi button.utama { background:#2f5d9e; border-color:#2f5d9e; color:#fff; }
      .cap { position:relative; }
      .cap-dibatalkan { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
      .cap-dibatalkan span { font-size:56px; font-weight:900; letter-spacing:.12em; color:rgba(180,35,24,.16); border:6px solid rgba(180,35,24,.16); padding:12px 28px; transform:rotate(-12deg); border-radius:12px; }
      @media print {
        @page { size:A4; margin:16mm; }
        .dokumen-wrap { background:#fff; padding:0; }
        .lembar { box-shadow:none; border-radius:0; padding:0; max-width:none; }
        .aksi { display:none; }
        .lembar, .cap { position:relative; }
      }
    `}</style>
  );
}
