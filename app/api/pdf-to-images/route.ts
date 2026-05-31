import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

export async function POST(request: NextRequest) {
  try {
    console.log("[PDF-to-Images] Starting PDF conversion");
    const { pdfBase64 } = await request.json();

    if (!pdfBase64) {
      console.error("[PDF-to-Images] No PDF base64 provided");
      return NextResponse.json(
        { error: "PDF base64 is required" },
        { status: 400 }
      );
    }

    console.log("[PDF-to-Images] Received PDF base64, length:", pdfBase64.length);

    // Remove data URL prefix if present
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    const pdfBuffer = Buffer.from(base64Data, "base64");
    console.log("[PDF-to-Images] Converted to buffer, size:", pdfBuffer.length);

    // Load PDF document to get page count
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    console.log("[PDF-to-Images] PDF loaded, page count:", pageCount);

    const images: string[] = [];

    // Convert each page to an image using pdf-to-img
    const pdfToImgModule = await import("pdf-to-img");
    console.log("[PDF-to-Images] pdf-to-img module keys:", Object.keys(pdfToImgModule));
    
    // Try to find the correct export
    const pdfToImg = (pdfToImgModule as any).default || (pdfToImgModule as any).pdfToImg || pdfToImgModule;
    
    if (typeof pdfToImg !== 'function') {
      console.error("[PDF-to-Images] pdfToImg is not a function, type:", typeof pdfToImg);
      throw new Error("pdf-to-img library not correctly imported");
    }
    
    const imageBuffers = await pdfToImg(pdfBuffer, {
      scale: 2,
      quality: 90,
    });
    console.log("[PDF-to-Images] Converted all pages, count:", imageBuffers.length);

    for (const buffer of imageBuffers) {
      const base64Image = `data:image/jpeg;base64,${buffer.toString("base64")}`;
      images.push(base64Image);
    }

    console.log("[PDF-to-Images] Conversion complete, images generated:", images.length);
    return NextResponse.json({ images });
  } catch (error) {
    console.error("[PDF-to-Images] Error converting PDF to images:", error);
    if (error instanceof Error) {
      console.error("[PDF-to-Images] Error message:", error.message);
      console.error("[PDF-to-Images] Error stack:", error.stack);
    }
    return NextResponse.json(
      { error: "Failed to convert PDF to images", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
