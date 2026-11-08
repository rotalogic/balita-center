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
};
export default nextConfig;
