import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { getIdentitas } from "@/lib/sekolah";

// Judul tab mengikuti identitas lembaga yang terpasang (Pengaturan), bukan
// nama produk — sesuai identitas resmi lembaga pada kop tiga baris.
export async function generateMetadata(): Promise<Metadata> {
  const identitas = await getIdentitas();
  return {
    title: identitas.nama_gabungan,
    description: identitas.tagline_gabungan,
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
