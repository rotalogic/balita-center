#!/usr/bin/env node
// Smoke test Balita Center — uji asap alur inti lewat HTTP, tanpa dependensi.
//
// Pakai:
//   SMOKE_EMAIL=admin@... SMOKE_PASSWORD=... node scripts/smoke-test.mjs
//   BASE_URL=https://balita.rotalogic.id SMOKE_EMAIL=... SMOKE_PASSWORD=... npm run smoke
//
// Hanya MEMBACA dan satu penolakan webhook yang memang harus ditolak —
// tidak membuat, mengubah, atau menghapus data apa pun. Keluar dengan
// kode 1 bila ada langkah yang gagal.

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.SMOKE_EMAIL;
const PASSWORD = process.env.SMOKE_PASSWORD;

let kuki = "";
let lulus = 0;
let gagal = 0;

function catat(nama, ok, detail = "") {
  if (ok) { lulus += 1; console.log(`  ✓ ${nama}`); }
  else { gagal += 1; console.log(`  ✗ ${nama}${detail ? ` — ${detail}` : ""}`); }
}

async function minta(path, opsi = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opsi,
    headers: { "Content-Type": "application/json", ...(kuki ? { Cookie: kuki } : {}), ...(opsi.headers || {}) },
    redirect: "manual",
  });
  const setKuki = res.headers.get("set-cookie");
  if (setKuki) kuki = setKuki.split(";")[0];
  const teks = await res.text();
  let json = null;
  try { json = JSON.parse(teks); } catch { /* bukan JSON */ }
  return { status: res.status, json, teks };
}

async function main() {
  console.log(`Smoke test → ${BASE}`);
  if (!EMAIL || !PASSWORD) {
    console.error("SMOKE_EMAIL dan SMOKE_PASSWORD wajib diisi (akun staf uji).");
    process.exit(2);
  }

  // 1. Kesehatan server + database
  const health = await minta("/api/health");
  catat("Server & database sehat", health.status === 200 && health.json?.db === "ok", `HTTP ${health.status}`);

  // 2. API tanpa sesi harus ditolak
  const tolak = await minta("/api/children");
  catat("API menolak tanpa sesi", tolak.status === 401, `HTTP ${tolak.status}`);

  // 3. Login
  const login = await minta("/api/auth/login", { method: "POST", body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  catat("Login staf", login.status === 200 && login.json?.ok !== false, `HTTP ${login.status}`);

  // 4. Meta: katalog material & milestone termuat
  const meta = await minta("/api/meta");
  catat("Katalog material termuat", meta.status === 200 && (meta.json?.materials?.length ?? 0) > 0, `HTTP ${meta.status}`);
  catat("Katalog milestone termuat", (meta.json?.milestones?.length ?? 0) > 0);

  // 5. Daftar anak terbaca
  const anak = await minta("/api/children");
  catat("Daftar anak terbaca", anak.status === 200 && Array.isArray(anak.json?.children), `HTTP ${anak.status}`);
  const anakPertama = anak.json?.children?.[0];

  // 6. Akademik: siklus + katalog + kegiatan
  const akad = await minta("/api/academic");
  catat("Akademik termuat (termasuk kegiatan)", akad.status === 200 && Array.isArray(akad.json?.events), `HTTP ${akad.status}`);

  // 7. Setelan gateway terbaca & tidak membocorkan kunci
  const gw = await minta("/api/keuangan/gateway");
  const gwTeks = JSON.stringify(gw.json || {});
  catat("Setelan gateway terbaca", gw.status === 200 && typeof gw.json?.siap === "boolean", `HTTP ${gw.status}`);
  catat("Kunci gateway tidak bocor di respons", !/Mid-server-[A-Za-z0-9]/.test(gwTeks) || gwTeks.includes("••••"));

  // 8. Webhook tanpa tanda tangan sah harus ditolak 403
  const wh = await minta("/api/payments/webhook", {
    method: "POST",
    body: JSON.stringify({ order_id: "SMOKE", status_code: "200", gross_amount: "1.00", signature_key: "0".repeat(128), transaction_status: "settlement" }),
  });
  catat("Webhook menolak tanda tangan palsu", wh.status === 403, `HTTP ${wh.status}`);

  // 9. Job tagihan menolak token yang salah
  const job = await fetch(`${BASE}/api/jobs/tagihan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-job-token": "token-sengaja-salah" },
    body: JSON.stringify({ action: "pengingat" }),
  });
  catat("Job tagihan menolak token salah", job.status === 401 || job.status === 403, `HTTP ${job.status}`);

  // 10. Konteks Connect orang tua (pratinjau staf) untuk anak pertama
  if (anakPertama?.id) {
    const conn = await minta(`/api/connect?child_id=${anakPertama.id}&preview=1`);
    catat("Connect termuat (tagihan + gateway)", conn.status === 200 && Array.isArray(conn.json?.invoices) && typeof conn.json?.gateway === "object", `HTTP ${conn.status}`);
    const rapor = await minta(`/api/connect/rapor?child_id=${anakPertama.id}&preview=1`);
    catat("Connect rapor menjawab", rapor.status === 200, `HTTP ${rapor.status}`);
  } else {
    catat("Connect termuat (tagihan + gateway)", false, "tidak ada anak untuk diuji");
  }

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal.`);
  process.exit(gagal > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Smoke test berhenti:", e.message);
  process.exit(1);
});
