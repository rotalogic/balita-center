"use client";

import { useState } from "react";

// Unggah foto ke /api/upload (driver dipilih server: S3/R2 atau lokal).
// Mengembalikan URL internal yang bisa dibuka lagi dari UI.
export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unggah(file: File): Promise<string | null> {
    setError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Format harus JPG, PNG, atau WEBP.");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(`Ukuran ${file.name} lebih dari 5 MB.`);
      return null;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Gagal mengunggah.");
        return null;
      }
      return data.url as string;
    } catch {
      setError("Koneksi terputus saat mengunggah.");
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { unggah, uploading, error, setError };
}
