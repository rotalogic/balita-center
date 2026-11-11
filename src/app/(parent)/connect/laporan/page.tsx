"use client";

import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { LaporanWeb, type LaporanAktivitas } from "@/components/laporan-web";
import { useConnect } from "@/lib/use-connect";

export default function ConnectLaporanPage() {
  const { data, error } = useConnect();
  if (error) return (<><PageHead title="Detail Daily Report" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Detail Daily Report" /><LoadingState /></>);
  if (!data.child || !data.report) {
    return (
      <>
        <PageHead title="Detail Daily Report" subtitle="Lihat kegiatan, perkembangan, dan kondisi anak hari ini" />
        <EmptyState title="Belum ada laporan terbit" body="Daily report tampil di sini setelah guru membuatnya dan reviewer menerbitkannya. Laporan draft atau yang masih direview tidak dibuka untuk orang tua." />
      </>
    );
  }
  const r = data.report as Record<string, unknown>;
  // Hanya aktivitas milik laporan terbit terbaru ini yang ditampilkan:
  // daftar dari API bisa memuat aktivitas laporan lain anak yang sama.
  const activities = ((data.activities || []) as Array<Record<string, unknown>>)
    .filter((a) => String(a.report_id) === String(r.id)) as unknown as LaporanAktivitas[];
  const reporter = (r.teacher_name as string) || (r.facilitator_name as string) || null;

  return (
    <LaporanWeb
      report={r as never}
      activities={activities}
      segments={((data.segments || []) as Array<Record<string, unknown>>).map((s) => ({
        segmen: String(s.segmen),
        catatan: String(s.catatan ?? ""),
      }))}
      childName={String(data.child.full_name)}
      childPhoto={(data.child.photo_url as string) || null}
      folderUrl={(data.child.tautan_folder_dokumentasi as string) || null}
      reporterName={reporter}
      reporterPhoto={(r.teacher_photo as string) || null}
      reporterTtd={(r.teacher_ttd as string) || null}
      pdfUrl={`/api/dokumen/laporan/${String(r.id)}/pdf`}
    />
  );
}
