import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

// Lapisan storage: dua driver, dipilih dari env.
// - S3/R2  : aktif bila STORAGE_BUCKET + kunci terisi (produksi).
// - lokal  : cadangan pengembangan, berkas di volume container.
// Berkas selalu disimpan dengan nama UUID + ekstensi, tidak pernah nama asli
// pengguna (cegah path traversal dan tabrakan nama).
export type StorageMode = "s3" | "lokal";

export const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_BYTES = 5 * 1024 * 1024;
const DIR = process.env.UPLOAD_DIR || "/app/uploads";

export function storageMode(): StorageMode {
  return process.env.STORAGE_BUCKET && process.env.STORAGE_ACCESS_KEY_ID ? "s3" : "lokal";
}

function namaBerkas(mime: string): string {
  return `${randomUUID()}.${EXT[mime]}`;
}

async function simpanS3(name: string, buffer: Buffer, mime: string): Promise<void> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: process.env.STORAGE_REGION || "auto",
    endpoint: process.env.STORAGE_ENDPOINT,
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "1",
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY as string,
    },
  });
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.STORAGE_BUCKET,
      Key: name,
      Body: buffer,
      ContentType: mime,
    })
  );
}

export async function simpan(mime: string, buffer: Buffer): Promise<string> {
  const name = namaBerkas(mime);
  if (storageMode() === "s3") {
    await simpanS3(name, buffer, mime);
    const base = (process.env.STORAGE_PUBLIC_URL || "").replace(/\/$/, "");
    return base ? `${base}/${name}` : `/api/files/${name}`;
  }
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, name), buffer);
  return `/api/files/${name}`;
}

// Baca berkas lokal. Untuk mode S3, berkas diambil lewat URL publiknya oleh
// browser, jadi route ini hanya dipakai mode lokal.
export async function baca(name: string): Promise<Buffer> {
  return readFile(path.join(DIR, name));
}

export function namaSah(name: string): boolean {
  return /^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(name);
}

export const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
