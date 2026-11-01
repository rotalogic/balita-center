"use client";

import { EmptyState, ErrorState, LoadingState, PageHead } from "@/components/chrome";
import { useConnect } from "@/lib/use-connect";

export default function ConnectPesanPage() {
  const { data, error } = useConnect();
  if (error) return (<><PageHead title="Pesan" /><ErrorState message={error} /></>);
  if (!data) return (<><PageHead title="Pesan" /><LoadingState /></>);
  return (
    <>
      <PageHead title="Pesan" subtitle="Komunikasi langsung dengan guru, kepala sekolah, dan pihak sekolah" />
      {data.messages.length === 0 ? (
        <EmptyState title="Belum ada pesan" body="Pesan dari guru dan sekolah untuk anak ini tampil di sini. Pengiriman pesan dua arah memerlukan akun pengguna orang tua yang terhubung; di paket ini pesan dibaca dari tabel parent_messages." />
      ) : (
        <div className="grid">
          {data.messages.map((m) => (
            <article className="card" key={String(m.id)}>
              <div className="row spread">
                <strong>{m.sender_name}</strong>
                <span className="muted">{new Date(String(m.sent_at)).toLocaleString("id-ID")}</span>
              </div>
              {m.subject ? <h3 style={{ marginTop: 6 }}>{m.subject}</h3> : null}
              <p>{m.body}</p>
              {m.attachment_url ? <p className="muted">Lampiran: {m.attachment_url}</p> : null}
              <span className="muted">{m.is_read ? "Sudah dibaca" : "Belum dibaca"}{m.is_pinned ? " · Tersemat" : ""}</span>
            </article>
          ))}
        </div>
      )}
      <article className="card">
        <h2>Butuh bantuan?</h2>
        <p className="muted">Hubungi kami melalui WhatsApp sekolah bila ada hal mendesak tentang anak Anda.</p>
      </article>
    </>
  );
}
