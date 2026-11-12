import fs from "fs";
import os from "os";
import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { resolveProjectPath } from "./storage-paths";

/**
 * Armazenamento de arquivos do app.
 *   - `s3`    produção: Garage da infra (https://storage.treinavisa.com.br), bucket `pastavisa`.
 *             Referências gravadas no banco como `s3://<bucket>/storage/<pasta>/<arquivo>`.
 *   - `local` desenvolvimento: `./storage/<pasta>/<arquivo>` no disco.
 * Envs do s3: S3_ENDPOINT, S3_REGION (garage), S3_BUCKET (pastavisa), S3_ACCESS_KEY_ID,
 * S3_SECRET_ACCESS_KEY. Os arquivos sempre passam pelo servidor (upload multipart); não há
 * upload direto do navegador para o bucket.
 */

type StorageFolder = "uploads" | "templates" | "logos" | "output";
type StorageDriver = "local" | "s3";

export function storageDriver(): StorageDriver {
  const configured = (process.env.FILE_STORAGE_DRIVER || "").toLowerCase();
  if (configured === "s3") return "s3";
  if (configured === "local") return "local";
  return process.env.S3_ENDPOINT ? "s3" : "local";
}

export function isRemoteReference(ref?: string | null): boolean {
  if (!ref) return false;
  return /^s3:\/\//i.test(ref);
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

function storageKey(folder: StorageFolder, fileName: string): string {
  return `storage/${folder}/${fileName}`.replace(/\\/g, "/");
}

function storageBucket(): string {
  return process.env.S3_BUCKET || "pastavisa";
}

function remoteRef(bucket: string, key: string): string {
  return `s3://${bucket}/${key}`;
}

function parseRemoteRef(ref: string): { bucket: string; key: string } {
  const withoutScheme = ref.replace(/^s3:\/\//i, "");
  const slashIndex = withoutScheme.indexOf("/");
  if (slashIndex < 0) {
    throw new Error("Referencia de arquivo invalida");
  }
  return {
    bucket: withoutScheme.slice(0, slashIndex),
    key: withoutScheme.slice(slashIndex + 1),
  };
}

export function isManagedStorageReference(
  ref: string | null | undefined,
  folder: StorageFolder
): boolean {
  if (!ref || !isRemoteReference(ref)) return false;

  try {
    const { bucket, key } = parseRemoteRef(ref);
    return bucket === storageBucket() && key.startsWith(storageKey(folder, ""));
  } catch {
    return false;
  }
}

let s3ClientCache: S3Client | null = null;

function s3Client(): S3Client {
  if (s3ClientCache) return s3ClientCache;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Configure S3_ENDPOINT, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY para usar o storage S3");
  }
  s3ClientCache = new S3Client({
    endpoint,
    region: process.env.S3_REGION || "garage",
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  return s3ClientCache;
}

function isS3NotFound(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NotFound" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
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

  if (storageDriver() === "s3") {
    const bucket = storageBucket();
    const key = storageKey(folder, cleanFileName);
    try {
      await s3Client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
    } catch (error) {
      throw new Error(`Falha ao enviar arquivo ao storage: ${(error as Error).message}`);
    }
    return remoteRef(bucket, key);
  }

  const filePath = localStoragePath(folder, cleanFileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export async function readStorageBuffer(ref?: string | null): Promise<Buffer> {
  if (!ref) throw new Error("Referencia de arquivo ausente");

  if (isRemoteReference(ref)) {
    const { bucket, key } = parseRemoteRef(ref);
    try {
      const out = await s3Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return Buffer.from(await out.Body!.transformToByteArray());
    } catch (error) {
      throw new Error(`Arquivo nao encontrado no storage: ${(error as Error).message}`);
    }
  }

  return fs.readFileSync(resolveProjectPath(ref));
}

export async function storageFileExists(ref?: string | null): Promise<boolean> {
  if (!ref) return false;
  try {
    if (isRemoteReference(ref)) {
      const { bucket, key } = parseRemoteRef(ref);
      try {
        await s3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch (error) {
        if (isS3NotFound(error)) return false;
        throw error;
      }
    }
    return fs.existsSync(resolveProjectPath(ref));
  } catch {
    return false;
  }
}

/**
 * Remove um arquivo administrado, e só dele: a área é literal no código de quem
 * chama, nunca vem do pedido. Uma referência que aponte para fora da área — por
 * dado corrompido no banco ou por caminho forjado — faz a função lançar em vez
 * de apagar. É a mesma trava que o `deleteGeneratedDocx` já tinha desde o
 * PV-004, agora valendo para todas as áreas.
 */
async function deleteManagedStorageFile(ref: string | null | undefined, folder: StorageFolder): Promise<void> {
  if (!ref) return;

  if (isRemoteReference(ref)) {
    if (!isManagedStorageReference(ref, folder)) {
      throw new Error(`Referência de arquivo fora do armazenamento permitido (${folder})`);
    }
    const { bucket, key } = parseRemoteRef(ref);
    await s3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }

  const folderRoot = path.resolve(process.cwd(), "storage", folder);
  const localPath = path.resolve(resolveProjectPath(ref));
  if (localPath !== folderRoot && !localPath.startsWith(`${folderRoot}${path.sep}`)) {
    throw new Error(`Referência de arquivo fora do diretório permitido (${folder})`);
  }
  if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
}

/** Documento produzido pelo motor: vive em `storage/output`. */
export async function deleteGeneratedDocx(ref?: string | null): Promise<void> {
  return deleteManagedStorageFile(ref, "output");
}

/**
 * Documento que o cliente enviou: vive em `storage/uploads`. Sai junto com a
 * linha que aponta para ele — sem isto, o original sobrevive à exclusão da
 * pasta e ocupa cota para sempre, que é o que o PV-026 mediu em 19/08.
 */
export async function deleteUploadedFile(ref?: string | null): Promise<void> {
  return deleteManagedStorageFile(ref, "uploads");
}

/**
 * Logo do cliente: vive em `storage/logos`. Atenção ao chamar — `duplicar`
 * copia o `clienteLogoPath` para a pasta nova, então o mesmo arquivo pode ter
 * mais de um dono. Confira que ninguém mais aponta para ele antes de remover.
 */
export async function deleteLogoFile(ref?: string | null): Promise<void> {
  return deleteManagedStorageFile(ref, "logos");
}

export async function materializeStorageFile(ref?: string | null): Promise<string> {
  if (!ref) return "";
  const localPath = resolveProjectPath(ref);
  if (!isRemoteReference(ref) && fs.existsSync(localPath)) {
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

  if (storageDriver() === "s3") {
    const pastaId = path.basename(outputDir);
    return saveStorageBuffer("output", `${pastaId}/${fileNameForStorage}`, buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  }

  const outputPath = path.join(outputDir, fileNameForStorage);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}
