"use client";

import { useEffect, useState } from "react";

export type ConnectData = {
  child: Record<string, string | null> | null;
  report: Record<string, string | null> | null;
  activities: Array<Record<string, string | null>>;
  segments?: Array<Record<string, string | null>>;
  health: Array<Record<string, string | null>>;
  development: Array<Record<string, string | null>>;
  events: Array<Record<string, string | null>>;
  messages: Array<Record<string, string | null>>;
  photos: Array<Record<string, string | null>>;
  invoices: Array<Record<string, string | number | null>>;
  preview?: boolean;
  guardian_name?: string | null;
  gateway?: { aktif: boolean; client_key: string | null; sandbox: boolean };
};

const KUNCI = "bc-konteks-preview";

// Konteks Connect: anak mana + mode pratinjau atau bukan.
// Disimpan di sessionStorage supaya pindah halaman di dalam portal tetap pada
// anak yang sama (tautan sidebar tidak membawa query string).
export function konteksConnect(): { childId: string; preview: boolean; qs: string } {
  if (typeof window === "undefined") return { childId: "", preview: false, qs: "" };
  const p = new URLSearchParams(window.location.search);
  const childId = p.get("child_id") || "";
  const preview = p.get("preview") === "1";
  if (childId || preview) {
    sessionStorage.setItem(KUNCI, JSON.stringify({ childId, preview }));
  }
  if (p.get("preview") === "0") sessionStorage.removeItem(KUNCI);

  const tersimpan = sessionStorage.getItem(KUNCI);
  const simpan = tersimpan ? (JSON.parse(tersimpan) as { childId?: string; preview?: boolean }) : {};
  const akhirChild = childId || simpan.childId || "";
  const akhirPreview = preview || Boolean(simpan.preview);

  const qs = new URLSearchParams();
  if (akhirChild) qs.set("child_id", akhirChild);
  if (akhirPreview) qs.set("preview", "1");
  return { childId: akhirChild, preview: akhirPreview, qs: qs.toString() };
}

export function keluarPratinjau() {
  if (typeof window !== "undefined") sessionStorage.removeItem(KUNCI);
}

// Mengambil data Balita Connect satu anak dari /api/connect.
export function useConnect() {
  const [data, setData] = useState<ConnectData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    const { qs } = konteksConnect();
    fetch(`/api/connect${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.preview && d.child) {
          sessionStorage.setItem("bc-preview-nama", String(d.child.full_name || ""));
        }
        return d.ok ? setData(d) : setError(d.error);
      })
      .catch(() => setError("Tidak dapat menghubungi server."));
  };

  useEffect(reload, []);
  return { data, error, reload };
}

export function childAgeLabel(birth: string | null | undefined): string {
  if (!birth) return "-";
  const born = new Date(birth);
  const now = new Date();
  let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return years > 0 ? `${years} tahun ${rest} bulan` : `${rest} bulan`;
}
