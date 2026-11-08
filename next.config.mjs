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
  // Header keamanan dasar untuk semua halaman & API. CSP sengaja belum
  // dipasang: aplikasi memakai banyak gaya sebaris (inline style) warisan,
  // CSP ketat akan mematahkannya — kerjakan terpisah sesudah gaya dibersihkan.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default nextConfig;
