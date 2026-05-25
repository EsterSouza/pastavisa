import fs from "fs";
import os from "os";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { resolveProjectPath } from "./storage-paths";

type StorageFolder = "uploads" | "templates" | "logos" | "output";
type StorageDriver = "local" | "supabase";

export interface SignedStorageUpload {
  bucket: string;
  path: string;
  token: string;
  ref: string;
}

export function storageDriver(): StorageDriver {
  const configured = (process.env.FILE_STORAGE_DRIVER || "").toLowerCase();
  if (configured === "supabase") return "supabase";

  const hasSupabaseStorage =
    !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (process.env.VERCEL && hasSupabaseStorage) return "supabase";

  return "local";
}

export function isSupabaseReference(ref?: string | null): boolean {
  if (!ref) return false;
  return /^supabase:\/\//i.test(ref);
}

export function safeStorageFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function safeStoragePathName(fileName: string): string {
  return fileName
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(safeStorageFileName)
    .join("/");
}

function localStoragePath(folder: StorageFolder, fileName: string): string {
  return path.join(process.cwd(), "storage", folder, fileName);
}

function storagePath(folder: StorageFolder, fileName: string): string {
  return `storage/${folder}/${fileName}`.replace(/\\/g, "/");
}

function supabaseBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || "pasta-visa";
}

function supabasePath(folder: StorageFolder, fileName: string): string {
  return storagePath(folder, fileName);
}

function supabaseRef(bucket: string, filePath: string): string {
  return `supabase://${bucket}/${filePath}`;
}

function parseSupabaseRef(ref: string): { bucket: string; filePath: string } {
  const withoutScheme = ref.replace(/^supabase:\/\//i, "");
  const slashIndex = withoutScheme.indexOf("/");
  if (slashIndex < 0) {
    throw new Error("Referencia Supabase invalida");
  }
  return {
    bucket: withoutScheme.slice(0, slashIndex),
    filePath: withoutScheme.slice(slashIndex + 1),
  };
}

export function isManagedStorageReference(
  ref: string | null | undefined,
  folder: StorageFolder
): boolean {
  if (!ref || !isSupabaseReference(ref)) return false;

  try {
    const { bucket, filePath } = parseSupabaseRef(ref);
    return bucket === supabaseBucket() && filePath.startsWith(storagePath(folder, ""));
  } catch {
    return false;
  }
}

function supabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para usar Supabase Storage");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function fileNameFromStorageRef(ref: string): string {
  try {
    const url = new URL(ref);
    return path.basename(url.pathname);
  } catch {
    return path.basename(ref);
  }
}

export async function saveStorageBuffer(
  folder: StorageFolder,
  fileName: string,
  buffer: Buffer,
  contentType?: string
): Promise<string> {
  const cleanFileName = safeStoragePathName(fileName);

  if (storageDriver() === "supabase") {
    const bucket = supabaseBucket();
    const filePath = supabasePath(folder, cleanFileName);
    const supabase = supabaseAdminClient();
    const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, {
      contentType,
      upsert: true,
    });
    if (error) throw new Error(`Falha ao enviar arquivo ao Supabase Storage: ${error.message}`);
    return supabaseRef(bucket, filePath);
  }

  const filePath = localStoragePath(folder, cleanFileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export async function createSignedStorageUpload(
  folder: StorageFolder,
  fileName: string
): Promise<SignedStorageUpload> {
  if (storageDriver() !== "supabase") {
    throw new Error("Upload direto disponivel apenas com Supabase Storage");
  }

  const cleanFileName = safeStoragePathName(fileName);
  const bucket = supabaseBucket();
  const filePath = supabasePath(folder, cleanFileName);
  const supabase = supabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(filePath);

  if (error || !data?.token) {
    throw new Error(`Falha ao preparar upload no Supabase Storage: ${error?.message || "token ausente"}`);
  }

  return {
    bucket,
    path: filePath,
    token: data.token,
    ref: supabaseRef(bucket, filePath),
  };
}

export async function readStorageBuffer(ref?: string | null): Promise<Buffer> {
  if (!ref) throw new Error("Referencia de arquivo ausente");

  const localPath = resolveProjectPath(ref);
  if (!isSupabaseReference(ref) && fs.existsSync(localPath)) {
    return fs.readFileSync(localPath);
  }

  if (isSupabaseReference(ref)) {
    const { bucket, filePath } = parseSupabaseRef(ref);
    const supabase = supabaseAdminClient();
    const { data, error } = await supabase.storage.from(bucket).download(filePath);
    if (error) throw new Error(`Arquivo nao encontrado no Supabase Storage: ${error.message}`);
    return Buffer.from(await data.arrayBuffer());
  }

  return fs.readFileSync(localPath);
}

export async function storageFileExists(ref?: string | null): Promise<boolean> {
  if (!ref) return false;
  try {
    const localPath = resolveProjectPath(ref);
    if (!isSupabaseReference(ref) && fs.existsSync(localPath)) {
      return true;
    }

    if (isSupabaseReference(ref)) {
      const { bucket, filePath } = parseSupabaseRef(ref);
      const supabase = supabaseAdminClient();
      const { data, error } = await supabase.storage.from(bucket).list(path.dirname(filePath), {
        search: path.basename(filePath),
        limit: 1,
      });
      return !error && !!data?.some((item) => item.name === path.basename(filePath));
    }

    return false;
  } catch {
    return false;
  }
}

export async function materializeStorageFile(ref?: string | null): Promise<string> {
  if (!ref) return "";
  const localPath = resolveProjectPath(ref);
  if (!isSupabaseReference(ref) && fs.existsSync(localPath)) {
    return localPath;
  }

  const buffer = await readStorageBuffer(ref);
  const fileName = fileNameFromStorageRef(ref) || `storage-file-${Date.now()}`;
  const filePath = path.join(os.tmpdir(), "pastavirus", fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export async function saveGeneratedDocx(
  outputDir: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  if (storageDriver() === "supabase") {
    const pastaId = path.basename(outputDir);
    return saveStorageBuffer("output", `${pastaId}/${fileName}`, buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  }

  const outputPath = path.join(outputDir, fileName);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}
