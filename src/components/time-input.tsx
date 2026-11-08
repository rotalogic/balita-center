"use client";

import { useEffect, useState } from "react";
import { normalisasiJam } from "@/lib/format";

// Input jam 24 jam yang bisa diketik langsung: "1200" -> "12:00", "0930" -> "09:30".
// Normalisasi HANYA dipicu saat 4 digit terkumpul atau saat blur. Sebelumnya
// dipicu pada 3 digit sehingga "1200" berubah jadi "01:20" di tengah pengetikan.
export function TimeInput({
  value,
  onChange,
  label,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  style?: React.CSSProperties;
}) {
  const [teks, setTeks] = useState(value || "");
  const [salah, setSalah] = useState(false);

  useEffect(() => {
    setTeks(value || "");
    setSalah(false);
  }, [value]);

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        aria-invalid={salah}
        placeholder="HH:MM"
        maxLength={5}
        value={teks}
        style={{ maxWidth: 96, ...style }}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const mentah = event.target.value;
          setSalah(false);
          if (mentah === "") {
            setTeks("");
            onChange("");
            return;
          }
          const digit = mentah.replace(/\D/g, "");
          // Jangan sentuh teks selagi pengguna masih mengetik (< 4 digit):
          // "1", "12", "120" harus tetap seperti yang diketik.
          if (digit.length === 4) {
            const hasil = normalisasiJam(digit);
            if (hasil) {
              setTeks(hasil);
              onChange(hasil);
              return;
            }
          }
          setTeks(mentah);
        }}
        onBlur={() => {
          if (teks.trim() === "") {
            setTeks("");
            onChange("");
            return;
          }
          const hasil = normalisasiJam(teks);
          if (hasil === null) {
            // Tolak dengan pesan, jangan ubah diam-diam.
            setSalah(true);
            setTeks(value || "");
            return;
          }
          setTeks(hasil);
          onChange(hasil);
        }}
      />
      {salah ? (
        <span role="alert" style={{ color: "#b3261e", fontSize: 11 }}>
          Jam tidak valid, pakai 00:00–23:59
        </span>
      ) : null}
    </span>
  );
}
