"use client";

import { useState } from "react";

export type HasilUnggah = { url: string; media_type: "image" | "video"; mime_type: string };

const GAMBAR = ["image/jpeg", "image/png", "image/webp"];
const VIDEO = ["video/mp4", "video/webm"];

// Unggah media ke /api/upload (driver dipilih server: S3/R2 atau lokal).
// Mengembalikan URL internal + jenis media yang bisa dibuka lagi dari UI.
export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unggah(file: File): Promise<HasilUnggah | null> {
    setError(null);
    const video = VIDEO.includes(file.type);
    if (!video && !GAMBAR.includes(file.type)) {
      setError("Format harus JPG, PNG, WEBP, MP4, atau WebM.");
      return null;
    }
    const batas = video ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > batas) {
      setError(video ? `Video ${file.name} lebih dari 50 MB.` : `Ukuran ${file.name} lebih dari 5 MB.`);
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
      return { url: data.url as string, media_type: video ? "video" : "image", mime_type: file.type };
    } catch {
      setError("Koneksi terputus saat mengunggah.");
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { unggah, uploading, error, setError };
}

// Gambar sampul (poster) dari berkas video, diambil dari frame awal memakai
// elemen video + canvas di peramban — tanpa perlu ffmpeg di server. Dipakai
// untuk daftar galeri dan sampul video di PDF. Null bila peramban gagal.
export async function buatPosterVideo(file: File): Promise<File | null> {
  try {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video tidak terbaca"));
    });
    video.currentTime = Math.min(0.6, (video.duration || 1) / 2);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      setTimeout(resolve, 2500);
    });
    // Beri waktu peramban benar-benar menggambar frame hasil seek; tanpa jeda
    // ini canvas kerap menangkap frame hitam.
    await new Promise((r) => setTimeout(r, 200));
    const skala = Math.min(1, 640 / (video.videoWidth || 640));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((video.videoWidth || 640) * skala);
    canvas.height = Math.round((video.videoHeight || 480) * skala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return null;
    return new File([blob], "poster-video.jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}
