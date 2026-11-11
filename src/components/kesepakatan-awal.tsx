"use client";

import { KESEPAKATAN } from "@/lib/kesepakatan";

// Bacaan Kesepakatan Awal Keluarga (dapat dilipat) dengan daftar butir umum,
// khusus SAM, dan khusus ZKC. Dipakai di Formulir Trial, profil anak,
// dan Portal Orang Tua.
export default function KesepakatanAwal({ terbuka = false }: { terbuka?: boolean }) {
  return (
    <details open={terbuka || undefined}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Baca {KESEPAKATAN.judul}
      </summary>
      <div style={{ marginTop: 10 }}>
        <p>{KESEPAKATAN.pembuka}</p>
        <h4>Kesepakatan bersama</h4>
        <ul>
          {KESEPAKATAN.umum.map((butir) => (<li key={butir}>{butir}</li>))}
        </ul>
        <h4>Untuk keluarga Sekolah Alam Montessori</h4>
        <ul>
          {KESEPAKATAN.sam.map((butir) => (<li key={butir}>{butir}</li>))}
        </ul>
        <h4>Untuk keluarga Ziel Kids Club</h4>
        <ul>
          {KESEPAKATAN.zkc.map((butir) => (<li key={butir}>{butir}</li>))}
        </ul>
      </div>
    </details>
  );
}
