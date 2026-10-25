import fs from "fs";
import path from "path";
import crypto from "crypto";

export const ALLOWED_MIME_TYPES = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["application/pdf", ".pdf"],
  ["text/plain", ".txt"],
]);

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export function getUploadDirectory(): string {
  const dir = path.join(process.cwd(), "storage", "uploads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export interface SaveUploadResult {
  storedFilename: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  filePath: string;
  urlPath: string;
}

export async function saveSecureUpload(
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string,
): Promise<SaveUploadResult> {
  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    throw new UploadValidationError(`File exceeds maximum permitted size of 10 MB (received ${Math.round(fileBuffer.length / 1024 / 1024)} MB).`);
  }

  const normalizedMime = mimeType.toLowerCase();
  const allowedExt = ALLOWED_MIME_TYPES.get(normalizedMime);
  if (!allowedExt) {
    throw new UploadValidationError(`Unsupported MIME type '${mimeType}'. Allowed formats: JPEG, PNG, WEBP, GIF, PDF, TXT.`);
  }

  // Generate cryptographic UUID filename
  const randomName = `${crypto.randomUUID()}${allowedExt}`;
  const uploadDir = getUploadDirectory();
  const targetPath = path.join(uploadDir, randomName);

  await fs.promises.writeFile(targetPath, fileBuffer);

  return {
    storedFilename: randomName,
    originalFilename: path.basename(originalFilename),
    mimeType: normalizedMime,
    sizeBytes: fileBuffer.length,
    filePath: targetPath,
    urlPath: `/api/uploads/${randomName}`,
  };
}

export async function readSecureUpload(
  filename: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  // Sanitize filename to prevent directory traversal
  const safeFilename = path.basename(filename);
  const uploadDir = getUploadDirectory();
  const targetPath = path.join(uploadDir, safeFilename);

  if (!fs.existsSync(targetPath)) {
    return null;
  }

  const ext = path.extname(safeFilename).toLowerCase();
  let mimeType = "application/octet-stream";
  for (const [mime, allowedExt] of ALLOWED_MIME_TYPES.entries()) {
    if (allowedExt === ext) {
      mimeType = mime;
      break;
    }
  }

  const buffer = await fs.promises.readFile(targetPath);
  return { buffer, mimeType };
}
