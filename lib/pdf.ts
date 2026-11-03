import { createCanvas } from "@napi-rs/canvas";
import type { PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * OpenRouter solo acepta adjuntos PDF (plugin `file-parser`) con saldo de pago,
 * así que rasterizamos las páginas aquí y se las pasamos al modelo como
 * imágenes. De paso funciona igual con PDFs escaneados: el OCR lo hace la
 * visión del propio modelo.
 */
export const MAX_PDF_PAGES = 8;

// Escala sobre el tamaño nominal del PDF: a 1x el texto pequeño se pierde.
const RENDER_SCALE = 2;

export type RenderedPdf = {
  pages: Buffer[];
  /** Capa de texto de las mismas páginas; vacía o casi en un PDF escaneado. */
  text: string;
  totalPages: number;
  /** true si el documento tiene más páginas de las que se han renderizado. */
  truncated: boolean;
};

export async function renderPdfToImages(data: Buffer): Promise<RenderedPdf> {
  // Import dinámico: pdfjs es ESM y solo hace falta en la ruta de PDF.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const task = pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true });
  const doc = await task.promise;

  try {
    const totalPages = doc.numPages;
    const count = Math.min(totalPages, MAX_PDF_PAGES);
    const pages: Buffer[] = [];
    const texts: string[] = [];

    for (let number = 1; number <= count; number += 1) {
      const page = await doc.getPage(number);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");

      // Los PDF no traen fondo: sin esto las zonas vacías salen transparentes
      // y el modelo recibe una imagen en negro.
      context.fillStyle = "white";
      context.fillRect(0, 0, viewport.width, viewport.height);

      await page.render({
        // El canvas nativo no es un HTMLCanvasElement, pero expone la parte de
        // la API que pdfjs usa para pintar.
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;

      pages.push(canvas.toBuffer("image/png"));
      texts.push(await pageText(page));
      page.cleanup();
    }

    return {
      pages,
      text: texts.join("\n\n"),
      totalPages,
      truncated: totalPages > count,
    };
  } finally {
    await task.destroy();
  }
}

async function pageText(page: PDFPageProxy) {
  const content = await page.getTextContent();
  let text = "";
  for (const item of content.items) {
    // Los TextMarkedContent no llevan texto, solo delimitan bloques.
    if (!("str" in item)) continue;
    text += item.str + (item.hasEOL ? "\n" : " ");
  }
  return text.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
}
