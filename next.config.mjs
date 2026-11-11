/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // pdfkit membaca berkas font .afm saat runtime; tanpa ini, build standalone
  // tidak menyertakannya dan PDF gagal dengan ENOENT Helvetica.afm.
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },
  outputFileTracingIncludes: {
    "/api/dokumen/laporan/**": ["./node_modules/pdfkit/js/data/*.afm"],
  },
  // Header keamanan dasar untuk semua halaman & API. CSP berjalan dalam
  // mode pemantauan (Report-Only) sejak 9 Nov 2026: pelanggaran hanya
  // dilaporkan ke /api/csp-report, tidak ada yang diblokir — aplikasi
  // memakai banyak gaya sebaris warisan, jadi enforcement ketat menunggu
  // gaya dibersihkan dan laporan pelanggaran ditinjau dulu.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https:",
              "connect-src 'self' https://api.deepseek.com https://api.midtrans.com https://api.sandbox.midtrans.com https://app.midtrans.com https://app.sandbox.midtrans.com",
              "frame-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "report-uri /api/csp-report",
            ].join("; "),
          },
        ],
      },
    ];
  },
};
export default nextConfig;
