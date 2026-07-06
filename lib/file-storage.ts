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

function supabaseStorageErrorMessage(prefix: string, error: unknown): string {
  if (!error || typeof error !== "object") return prefix;

  const details = error as {
    message?: string;
    statusCode?: string | number;
    status?: string | number;
    code?: string;
    name?: string;
    error?: string;
  };
  const extras = [
    details.statusCode || details.status ? `status ${details.statusCode || details.status}` : "",
    details.code ? `code ${details.code}` : "",
    details.error && details.error !== details.message ? details.error : "",
  ].filter(Boolean);
  const suffix = extras.length > 0 ? ` (${extras.join(", ")})` : "";

  return `${prefix}: ${details.message || details.name || "erro desconhecido"}${suffix}`;
}

/**
 * Builds a safe `Content-Disposition` header value for a download response.
 * Raw HTTP header values must be Latin-1/ByteString — filenames with
 * characters outside that range (accents are fine, but an em dash "—",
 * curly quotes, etc. are not) throw when the runtime tries to set the header,
 * turning the whole download into a 500. The ASCII fallback keeps older
 * clients working, while `filename*=UTF-8''...` gives modern browsers the
 * real, accented name.
 */
export function contentDispositionHeader(fileName: string): string {
  // eslint-disable-next-line no-control-regex
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
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
    if (error) throw new Error(supabaseStorageErrorMessage("Falha ao enviar arquivo ao Supabase Storage", error));
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
    throw new Error(
      error
        ? supabaseStorageErrorMessage("Falha ao preparar upload no Supabase Storage", error)
        : "Falha ao preparar upload no Supabase Storage: token ausente"
    );
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

export async function deleteGeneratedDocx(ref?: string | null): Promise<void> {
  if (!ref) return;

  if (isSupabaseReference(ref)) {
    if (!isManagedStorageReference(ref, "output")) {
      throw new Error("Referência de arquivo gerado fora do armazenamento permitido");
    }
    const { bucket, filePath } = parseSupabaseRef(ref);
    const supabase = supabaseAdminClient();
    const { error } = await supabase.storage.from(bucket).remove([filePath]);
    if (error) throw new Error(supabaseStorageErrorMessage("Falha ao remover arquivo do Supabase Storage", error));
    return;
  }

  const outputRoot = path.resolve(process.cwd(), "storage", "output");
  const localPath = path.resolve(resolveProjectPath(ref));
  if (localPath !== outputRoot && !localPath.startsWith(`${outputRoot}${path.sep}`)) {
    throw new Error("Referência de arquivo gerado fora do diretório permitido");
  }
  if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
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
  buffer: Buffer,
  versionId?: string
): Promise<string> {
  const ext = path.extname(fileName);
  const fileNameForStorage = versionId
    ? `${path.basename(fileName, ext)}_${safeStorageFileName(versionId)}${ext}`
    : fileName;

  if (storageDriver() === "supabase") {
    const pastaId = path.basename(outputDir);
    return saveStorageBuffer("output", `${pastaId}/${fileNameForStorage}`, buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  }

  const outputPath = path.join(outputDir, fileNameForStorage);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}
