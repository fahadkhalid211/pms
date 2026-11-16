import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/session";
import { readSecureUpload } from "@/lib/uploads";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;
    const fileData = await readSecureUpload(filename);
    if (!fileData) {
      return NextResponse.json(
        { success: false, error: { message: "Attachment not found." } },
        { status: 404 },
      );
    }

    // Require authentication for non-image assets (PDFs, documents, etc.)
    if (!fileData.mimeType.startsWith("image/")) {
      await requireAuthContext();
    }

    return new Response(new Uint8Array(fileData.buffer), {
      status: 200,
      headers: {
        "Content-Type": fileData.mimeType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    const status = error?.status ?? (error?.message === "Unauthorized" ? 401 : 500);
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to read attachment." } },
      { status },
    );
  }
}
