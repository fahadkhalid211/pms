import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/session";
import { saveSecureUpload, UploadValidationError } from "@/lib/uploads";

export async function POST(request: Request) {
  try {
    await requireAuthContext();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: { message: "File is required in 'file' form field." } },
        { status: 400 },
      );
    }

    const blob = file as Blob;
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalName = (file as any).name || "attachment";
    const mimeType = blob.type || "application/octet-stream";

    const saved = await saveSecureUpload(buffer, originalName, mimeType);

    return NextResponse.json(
      {
        success: true,
        data: {
          storedFilename: saved.storedFilename,
          originalFilename: saved.originalFilename,
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes,
          urlPath: saved.urlPath,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json(
        { success: false, error: { code: "UPLOAD_VALIDATION_ERROR", message: error.message } },
        { status: 400 },
      );
    }
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to upload file." } },
      { status },
    );
  }
}
