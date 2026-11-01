"use client";

import { useEffect, useState } from "react";

export type ConnectData = {
  child: Record<string, string | null> | null;
  report: Record<string, string | null> | null;
  activities: Array<Record<string, string | null>>;
  health: Array<Record<string, string | null>>;
  development: Array<Record<string, string | null>>;
  events: Array<Record<string, string | null>>;
  messages: Array<Record<string, string | null>>;
  photos: Array<Record<string, string | null>>;
  invoices: Array<Record<string, string | number | null>>;
};

// Mengambil data Balita Connect satu anak dari /api/connect.
export function useConnect() {
  const [data, setData] = useState<ConnectData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    fetch("/api/connect")
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setError(d.error)))
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
