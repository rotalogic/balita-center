// Konfigurasi halaman modul generik. Angka pada setiap modul dihitung dari
// tabel database yang tercantum di sini lewat /api/stats (mode modul),
// bukan angka contoh.
export type ModuleConfig = {
  title: string;
  subtitle: string;
  description: string;
  tables: Array<{ table: string; label: string }>;
  links: Array<{ href: string; label: string }>;
  note?: string;
};

export const MODULES: Record<string, ModuleConfig> = {
  akademik: {
    title: "Akademik",
    subtitle: "Program, kelas, siklus belajar, dan checklist STPPA",
    description:
      "Modul akademik menampung program dan kelas (dibuat lewat Data Awal), siklus pembelajaran, serta penilaian STPPA per anak per siklus.",
    tables: [
      { table: "programs", label: "Program" },
      { table: "classes", label: "Kelas" },
      { table: "learning_cycles", label: "Siklus Belajar" },
      { table: "stppa_assessments", label: "Penilaian STPPA" },
    ],
    links: [
      { href: "/anak/tambah", label: "Kelola Data Awal" },
      { href: "/anak", label: "Data Anak Didik" },
    ],
  },
  admission: {
    title: "Admission",
    subtitle: "Penerimaan murid, Bot WhatsApp Ailsa, screening, dan konversi pendaftaran",
    description:
      "Lead dari Bot Ailsa masuk sebagai calon murid, diteruskan ke admin, lalu menjadi pendaftaran dan anak didik. Follow-up lead terjadwal tersimpan di lead_followups, dan jawaban bot hanya aktif setelah disetujui di bot_knowledge_entries.",
    tables: [
      { table: "leads", label: "Lead Ailsa" },
      { table: "bot_conversations", label: "Percakapan Bot" },
      { table: "registrations", label: "Pendaftaran" },
      { table: "lead_followups", label: "Follow-up Terjadwal" },
    ],
    links: [{ href: "/anak/tambah", label: "Daftarkan Anak Baru" }],
    note: "Integrasi WhatsApp sungguhan belum tersambung di paket ini; tabel dan alur datanya sudah siap.",
  },
  keuangan: {
    title: "Keuangan",
    subtitle: "Buku Kas, tagihan SPP, pembayaran, nota, dan payroll",
    description:
      "Keuangan berpusat pada Buku Kas: setiap pemasukan dan pengeluaran tercatat, dan koreksi hanya lewat entri reversal, tidak pernah hapus. Slip gaji terbit dari payroll_runs dan payslips.",
    tables: [
      { table: "cash_book_entries", label: "Entri Buku Kas" },
      { table: "invoices", label: "Tagihan" },
      { table: "payments", label: "Pembayaran" },
      { table: "payroll_runs", label: "Periode Payroll" },
    ],
    links: [{ href: "/", label: "Lihat Ringkasan Dashboard" }],
    note: "Payment gateway belum tersambung di paket ini; pembayaran dicatat dan dikonfirmasi staf.",
  },
  sdm: {
    title: "SDM",
    subtitle: "Data staf, kehadiran, cuti, KPI, rekrutmen, dan onboarding",
    description:
      "SDM mengelola staf dan guru, permohonan cuti/izin/lembur dengan persetujuan, kehadiran staf, skor KPI, pipeline rekrutmen, dan tugas onboarding.",
    tables: [
      { table: "staff", label: "Staf & Guru" },
      { table: "leave_requests", label: "Permintaan Cuti" },
      { table: "staff_attendance", label: "Kehadiran Staf" },
      { table: "candidates", label: "Kandidat Rekrutmen" },
    ],
    links: [{ href: "/anak/tambah", label: "Tambah Staf (Data Awal)" }],
  },
  cabang: {
    title: "Cabang",
    subtitle: "Cabang, modal investor per cabang, dan kinerja cabang",
    description:
      "Setiap data operasional terikat branch_id. Halaman ini merangkum cabang yang terdaftar beserta modal dan bagi hasil yang tercatat sebagai data, bukan konstanta.",
    tables: [
      { table: "branches", label: "Cabang" },
      { table: "branch_capital", label: "Modal Cabang" },
      { table: "children", label: "Anak Semua Cabang" },
      { table: "staff", label: "Staf Semua Cabang" },
    ],
    links: [{ href: "/anak/tambah", label: "Tambah Cabang (Data Awal)" }],
  },
  laporan: {
    title: "Laporan",
    subtitle: "Laporan eksekutif, akademik, kehadiran, keuangan, dan SDM",
    description:
      "Laporan dibaca dari tabel operasional yang sama, tanpa salinan data kedua. Laporan investor bersifat agregat dan tidak memuat data anak teridentifikasi.",
    tables: [
      { table: "daily_reports", label: "Laporan Harian" },
      { table: "cycle_reports", label: "Laporan Siklus" },
      { table: "child_attendance", label: "Kehadiran Anak" },
      { table: "audit_logs", label: "Jejak Audit" },
    ],
    links: [
      { href: "/daily-reports", label: "Daily Reports" },
      { href: "/investor", label: "Dashboard Investor" },
    ],
  },
  investor: {
    title: "Investor",
    subtitle: "Kinerja agregat lintas cabang untuk investor",
    description:
      "Tampilan investor hanya membaca agregat: jumlah cabang, anak, staf, dan arus kas. Tidak ada nama anak, orang tua, atau data kesehatan yang dibuka di sini, sesuai batasan PRD.",
    tables: [
      { table: "branches", label: "Cabang" },
      { table: "branch_capital", label: "Modal Tercatat" },
      { table: "cash_book_entries", label: "Entri Arus Kas" },
      { table: "children", label: "Total Anak (agregat)" },
    ],
    links: [{ href: "/laporan", label: "Laporan Eksekutif" }],
    note: "Angka di halaman ini selalu agregat hitungan baris, tidak pernah identitas anak.",
  },
  komunikasi: {
    title: "Komunikasi",
    subtitle: "Pesan orang tua, pengumuman, ulasan, dan notifikasi",
    description:
      "Komunikasi sekolah dan orang tua tercatat di parent_messages dan announcements, ulasan orang tua di parent_reviews, dan notifikasi per pengguna di notifications.",
    tables: [
      { table: "parent_messages", label: "Pesan Orang Tua" },
      { table: "announcements", label: "Pengumuman" },
      { table: "parent_reviews", label: "Ulasan Orang Tua" },
      { table: "notifications", label: "Notifikasi" },
    ],
    links: [{ href: "/connect/pesan", label: "Lihat Sisi Orang Tua" }],
  },
  pengaturan: {
    title: "Pengaturan",
    subtitle: "Pengguna, peran & izin RBAC, cabang, dan jejak audit",
    description:
      "Akses dikendalikan RBAC: 10 peran dan 23 izin yang di-seed oleh file SQL, dipetakan di role_permissions, dan ditetapkan per pengguna di user_roles serta per cabang di user_branches.",
    tables: [
      { table: "users", label: "Pengguna" },
      { table: "roles", label: "Peran" },
      { table: "permissions", label: "Izin" },
      { table: "audit_logs", label: "Jejak Audit" },
    ],
    links: [{ href: "/", label: "Kembali ke Dashboard" }],
    note: "Login kata sandi sungguhan belum diaktifkan di paket ini; peran tampil sebagai konteks kerja berlabel, sama seperti batas yang dinyatakan pada aplikasi hosted-nya.",
  },
};
