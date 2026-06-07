// ─────────────────────────────────────────────────────────────────────────────
// imageUtils – Bildaufbereitung für die KI-Analyse (läuft nur im Browser).
// Skaliert große Handy-Fotos auf das Optimum der Vision-API herunter:
//  • spart Upload-Volumen (wichtig bei mobilen Daten)
//  • verhindert zu große Request-Bodies bei mehreren Seiten
//  • Qualität bleibt erhalten (die API skaliert ohnehin auf ~diese Größe)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_EDGE = 2048; // Maximale Kantenlänge für die Vision-API – höher = bessere OCR bei Lieferscheinen

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Liest eine Bilddatei und gibt ein optimiertes JPEG als Data-URL zurück.
 * Nicht-Bilder werden unverändert als Data-URL zurückgegeben.
 */
export async function optimizeImageFile(file: File, maxEdge = MAX_EDGE, quality = 0.95): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  if (!file.type.startsWith("image/")) return dataUrl;

  try {
    const img = await loadImage(dataUrl);
    const longest = Math.max(img.width, img.height);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    // Bei Problemen lieber das Originalbild senden als zu scheitern
    return dataUrl;
  }
}

/**
 * Wandelt ein PDF in optimierte JPEG-Data-URLs um (eine pro Seite).
 * pdfjs wird dynamisch geladen (vermeidet SSR-Fehler).
 */
export async function pdfToImages(file: File, maxEdge = MAX_EDGE, quality = 0.95): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const longest = Math.max(baseViewport.width, baseViewport.height);
    // Scale erhöht auf 3.0 max für bessere OCR-Qualität bei gedruckten Dokumenten
    const scale = Math.min(3, (maxEdge / longest) * 1.5) || 2.0;
    const viewport = page.getViewport({ scale: scale > 0 ? scale : 1.5 });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context!, viewport, canvas }).promise;
    images.push(canvas.toDataURL("image/jpeg", quality));
  }

  return images;
}
