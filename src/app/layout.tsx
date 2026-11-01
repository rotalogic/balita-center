import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Balita Center",
  description: "ERP PAUD/Montessori multi-cabang: anak didik, laporan harian, keuangan, SDM, dan portal orang tua Balita Connect.",
};

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
