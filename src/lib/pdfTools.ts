import JSZip from 'jszip';
import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export type ReadingDirection = 'ltr' | 'rtl';
export type StripOrientation = 'horizontal' | 'vertical';
export type ExportFormat = 'pdf' | 'jpg' | 'html' | 'zip';

export interface LoadedPdfInfo {
  doc: pdfjsLib.PDFDocumentProxy;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
}

export interface ConvertedOutput {
  format: ExportFormat;
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  scaledDown: boolean;
  previewUrl: string;
  previewType: 'image' | 'pdf' | 'html';
  htmlString?: string;
  pdfBytes?: Uint8Array;
}

export async function loadPdfInfo(bytes: Uint8Array): Promise<LoadedPdfInfo> {
  const copy = bytes.slice();
  const doc = await pdfjsLib.getDocument({ data: copy }).promise;
  const firstPage = await doc.getPage(1);
  const viewport = firstPage.getViewport({ scale: 1 });
  return {
    doc,
    pageCount: doc.numPages,
    pageWidth: Math.round(viewport.width),
    pageHeight: Math.round(viewport.height),
  };
}

export async function renderPageToCanvas(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
  dpr = 1
): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const outputScale = Math.min(dpr, 2);

  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
  }).promise;

  return {
    width: Math.floor(viewport.width),
    height: Math.floor(viewport.height),
  };
}

export async function extractPageText(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  let lastY: number | null = null;
  const lines: string[] = [];
  let currentLine = '';

  for (const item of content.items) {
    if (!('str' in item)) continue;
    const textItem = item as { str: string; transform?: number[]; hasEOL?: boolean };
    const y = textItem.transform?.[5] ?? null;

    if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
      if (currentLine.trim()) lines.push(currentLine.trim());
      currentLine = textItem.str;
    } else {
      currentLine += (currentLine && textItem.str && !currentLine.endsWith(' ') ? ' ' : '') + textItem.str;
    }

    if (textItem.hasEOL && currentLine.trim()) {
      lines.push(currentLine.trim());
      currentLine = '';
    }
    lastY = y;
  }

  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines.join('\n').trim();
}

function getOrderedIndices(count: number, direction: ReadingDirection): number[] {
  const indices = Array.from({ length: count }, (_, i) => i);
  return direction === 'rtl' ? indices.reverse() : indices;
}

export async function convertPdfToSingleSheetPdf(
  bytes: Uint8Array,
  options: {
    baseName: string;
    orientation: StripOrientation;
    direction: ReadingDirection;
    gapPt: number;
  }
): Promise<ConvertedOutput> {
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const srcPages = srcDoc.getPages();
  if (srcPages.length === 0) {
    throw new Error('PDF contains no pages');
  }

  // Pages share uniform dimensions; read directly from page 0 without complex fitting math
  const { width: pageW, height: pageH } = srcPages[0].getSize();
  const count = srcPages.length;
  const gap = Math.max(0, options.gapPt);

  const totalWidth =
    options.orientation === 'horizontal' ? pageW * count + gap * (count - 1) : pageW;
  const totalHeight =
    options.orientation === 'vertical' ? pageH * count + gap * (count - 1) : pageH;

  const outDoc = await PDFDocument.create();
  const sheet = outDoc.addPage([totalWidth, totalHeight]);

  // Subtle neutral mat when a gap is selected
  if (gap > 0) {
    sheet.drawRectangle({
      x: 0,
      y: 0,
      width: totalWidth,
      height: totalHeight,
      color: rgb(0.95, 0.95, 0.94),
    });
  }

  const orderedIndices = getOrderedIndices(count, options.direction);
  const embeddedPages = await outDoc.embedPages(srcPages);

  orderedIndices.forEach((srcIdx, slotIdx) => {
    const embedded = embeddedPages[srcIdx];
    const x = options.orientation === 'horizontal' ? slotIdx * (pageW + gap) : 0;
    const y =
      options.orientation === 'vertical'
        ? totalHeight - (slotIdx + 1) * pageH - slotIdx * gap
        : 0;

    sheet.drawPage(embedded, {
      x,
      y,
      width: pageW,
      height: pageH,
    });
  });

  const outBytes = await outDoc.save();
  const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const previewUrl = URL.createObjectURL(blob);
  const cleanName = options.baseName.replace(/\.pdf$/i, '');

  return {
    format: 'pdf',
    blob,
    filename: `${cleanName}-${options.orientation}-${options.direction}.pdf`,
    width: Math.round(totalWidth),
    height: Math.round(totalHeight),
    scaledDown: false,
    previewUrl,
    previewType: 'pdf',
    pdfBytes: outBytes,
  };
}

export async function renderPagesAsJpgDataUrls(
  bytes: Uint8Array,
  scale: number
): Promise<{ dataUrls: string[]; pageWidth: number; pageHeight: number }> {
  const { doc } = await loadPdfInfo(bytes);
  const dataUrls: string[] = [];
  let pageWidth = 0;
  let pageHeight = 0;

  const tempCanvas = document.createElement('canvas');
  for (let i = 1; i <= doc.numPages; i++) {
    const dims = await renderPageToCanvas(doc, i, tempCanvas, scale, 1);
    if (i === 1) {
      pageWidth = dims.width;
      pageHeight = dims.height;
    }
    dataUrls.push(tempCanvas.toDataURL('image/jpeg', 0.9));
  }

  await doc.cleanup();
  return { dataUrls, pageWidth, pageHeight };
}

export async function convertPdfToStitchedJpg(
  bytes: Uint8Array,
  options: {
    baseName: string;
    orientation: StripOrientation;
    direction: ReadingDirection;
    gapPx: number;
    scale: number;
  }
): Promise<ConvertedOutput> {
  const { doc, pageCount, pageWidth, pageHeight } = await loadPdfInfo(bytes);
  const MAX_CANVAS_DIM = 16000;

  let effectiveScale = options.scale;
  const rawW =
    options.orientation === 'horizontal'
      ? pageWidth * effectiveScale * pageCount + options.gapPx * (pageCount - 1)
      : pageWidth * effectiveScale;
  const rawH =
    options.orientation === 'vertical'
      ? pageHeight * effectiveScale * pageCount + options.gapPx * (pageCount - 1)
      : pageHeight * effectiveScale;

  let scaledDown = false;
  if (rawW > MAX_CANVAS_DIM || rawH > MAX_CANVAS_DIM) {
    const ratio = Math.min(MAX_CANVAS_DIM / rawW, MAX_CANVAS_DIM / rawH);
    effectiveScale = Math.max(0.25, effectiveScale * ratio);
    scaledDown = true;
  }

  const firstPage = await doc.getPage(1);
  const vp = firstPage.getViewport({ scale: effectiveScale });
  const pW = Math.floor(vp.width);
  const pH = Math.floor(vp.height);
  const gap = Math.max(0, options.gapPx);

  const totalW =
    options.orientation === 'horizontal' ? pW * pageCount + gap * (pageCount - 1) : pW;
  const totalH =
    options.orientation === 'vertical' ? pH * pageCount + gap * (pageCount - 1) : pH;

  const masterCanvas = document.createElement('canvas');
  masterCanvas.width = totalW;
  masterCanvas.height = totalH;
  const masterCtx = masterCanvas.getContext('2d');
  if (!masterCtx) throw new Error('Master canvas 2D context unavailable');

  masterCtx.fillStyle = gap > 0 ? '#ECECE8' : '#FFFFFF';
  masterCtx.fillRect(0, 0, totalW, totalH);

  const orderedIndices = getOrderedIndices(pageCount, options.direction);
  const pageCanvas = document.createElement('canvas');

  for (let slotIdx = 0; slotIdx < orderedIndices.length; slotIdx++) {
    const pageNumber = orderedIndices[slotIdx] + 1;
    await renderPageToCanvas(doc, pageNumber, pageCanvas, effectiveScale, 1);

    const x = options.orientation === 'horizontal' ? slotIdx * (pW + gap) : 0;
    const y = options.orientation === 'vertical' ? slotIdx * (pH + gap) : 0;
    masterCtx.drawImage(pageCanvas, x, y, pW, pH);
  }

  await doc.cleanup();

  const blob = await new Promise<Blob>((resolve, reject) => {
    masterCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode JPG strip'))),
      'image/jpeg',
      0.92
    );
  });

  const previewUrl = URL.createObjectURL(blob);
  const cleanName = options.baseName.replace(/\.pdf$/i, '');

  return {
    format: 'jpg',
    blob,
    filename: `${cleanName}-${options.orientation}-${options.direction}.jpg`,
    width: totalW,
    height: totalH,
    scaledDown,
    previewUrl,
    previewType: 'image',
  };
}

export function buildStandaloneHtmlGallery(options: {
  title: string;
  pageDataUrls: string[];
  pageWidth: number;
  pageHeight: number;
  orientation: StripOrientation;
  direction: ReadingDirection;
  gapPx: number;
}): string {
  const ordered =
    options.direction === 'rtl' ? [...options.pageDataUrls].reverse() : options.pageDataUrls;

  const isHoriz = options.orientation === 'horizontal';
  const safeTitle = options.title.replace(/[<>&"]/g, '');

  const pagesMarkup = ordered
    .map(
      (src, idx) =>
        `<figure class="page"><img src="${src}" alt="${safeTitle} - ${idx + 1}" loading="lazy" /></figure>`
    )
    .join('\n      ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} — HorizonPDF Strip</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #EFEFED;
      color: #141413;
      font-family: system-ui, -apple-system, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: #FFFFFF;
      border-bottom: 1px solid #E2E2DC;
      font-size: 13px;
    }
    .bar strong { font-weight: 600; }
    .controls { display: flex; gap: 8px; align-items: center; }
    .controls button {
      border: 1px solid #D6D6D0;
      background: #FFFFFF;
      padding: 5px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
    }
    .controls button:hover { background: #F5F5F2; }
    .controls button:focus-visible { outline: 2px solid #C83E2B; outline-offset: 2px; }
    .strip {
      flex: 1;
      display: flex;
      flex-direction: ${isHoriz ? 'row' : 'column'};
      align-items: center;
      gap: ${options.gapPx}px;
      padding: 24px;
      overflow-${isHoriz ? 'x' : 'y'}: auto;
      overflow-${isHoriz ? 'y' : 'x'}: hidden;
      scroll-behavior: smooth;
    }
    .strip:focus-visible { outline: 2px solid #C83E2B; outline-offset: -2px; }
    @media (prefers-reduced-motion: reduce) {
      .strip { scroll-behavior: auto; }
    }
    .page {
      flex: 0 0 auto;
      background: #FFFFFF;
      box-shadow: 0 4px 18px rgba(0,0,0,0.08);
    }
    .page img {
      display: block;
      ${isHoriz ? 'height: calc(100vh - 110px); width: auto;' : 'width: min(92vw, 900px); height: auto;'}
    }
  </style>
</head>
<body>
  <header class="bar">
    <strong>${safeTitle}</strong>
    <div class="controls">
      <span>${ordered.length} pages · ${options.direction.toUpperCase()}</span>
      ${
        isHoriz
          ? '<button type="button" aria-label="Scroll left" onclick="scrollStrip(-1)">&larr;</button><button type="button" aria-label="Scroll right" onclick="scrollStrip(1)">&rarr;</button>'
          : ''
      }
    </div>
  </header>
  <main id="strip" class="strip" tabindex="0" role="region" aria-label="${safeTitle} gallery">
      ${pagesMarkup}
  </main>
  <script>
    var strip = document.getElementById('strip');
    var isRtl = ${options.direction === 'rtl' ? 'true' : 'false'};
    var isHoriz = ${isHoriz ? 'true' : 'false'};
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isHoriz && isRtl) {
      strip.scrollLeft = strip.scrollWidth;
    }
    function scrollStrip(step) {
      var delta = Math.max(320, strip.clientWidth * 0.72) * step;
      strip.scrollBy({ left: delta, behavior: prefersReduced ? 'auto' : 'smooth' });
    }
    if (isHoriz) {
      strip.addEventListener('wheel', function(e) {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          strip.scrollLeft += e.deltaY;
        }
      }, { passive: false });
      window.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); scrollStrip(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); scrollStrip(1); }
        else if (e.key === 'Home') { e.preventDefault(); strip.scrollTo({ left: isRtl ? strip.scrollWidth : 0, behavior: prefersReduced ? 'auto' : 'smooth' }); }
        else if (e.key === 'End') { e.preventDefault(); strip.scrollTo({ left: isRtl ? 0 : strip.scrollWidth, behavior: prefersReduced ? 'auto' : 'smooth' }); }
      });
    }
  </script>
</body>
</html>`;
}

export async function convertPdfToStandaloneHtml(
  bytes: Uint8Array,
  options: {
    baseName: string;
    orientation: StripOrientation;
    direction: ReadingDirection;
    gapPx: number;
    scale: number;
  }
): Promise<ConvertedOutput> {
  const { dataUrls, pageWidth, pageHeight } = await renderPagesAsJpgDataUrls(bytes, options.scale);
  const cleanName = options.baseName.replace(/\.pdf$/i, '');
  const htmlString = buildStandaloneHtmlGallery({
    title: cleanName,
    pageDataUrls: dataUrls,
    pageWidth,
    pageHeight,
    orientation: options.orientation,
    direction: options.direction,
    gapPx: options.gapPx,
  });

  const blob = new Blob([htmlString], { type: 'text/html;charset=utf-8' });
  const previewUrl = URL.createObjectURL(blob);

  return {
    format: 'html',
    blob,
    filename: `${cleanName}-${options.orientation}-${options.direction}.html`,
    width:
      options.orientation === 'horizontal'
        ? pageWidth * dataUrls.length + options.gapPx * (dataUrls.length - 1)
        : pageWidth,
    height:
      options.orientation === 'vertical'
        ? pageHeight * dataUrls.length + options.gapPx * (dataUrls.length - 1)
        : pageHeight,
    scaledDown: false,
    previewUrl,
    previewType: 'html',
    htmlString,
  };
}

export async function convertPdfToZipBundle(
  bytes: Uint8Array,
  options: {
    baseName: string;
    orientation: StripOrientation;
    direction: ReadingDirection;
    gapPx: number;
    scale: number;
  }
): Promise<ConvertedOutput> {
  const cleanName = options.baseName.replace(/\.pdf$/i, '');
  const jpgOut = await convertPdfToStitchedJpg(bytes, options);
  const pdfOut = await convertPdfToSingleSheetPdf(bytes, {
    baseName: options.baseName,
    orientation: options.orientation,
    direction: options.direction,
    gapPt: options.gapPx,
  });
  const htmlOut = await convertPdfToStandaloneHtml(bytes, options);

  const zip = new JSZip();
  zip.file(jpgOut.filename, await jpgOut.blob.arrayBuffer());
  zip.file(pdfOut.filename, pdfOut.pdfBytes ?? (await pdfOut.blob.arrayBuffer()));
  zip.file('gallery-embed.html', htmlOut.htmlString || '');
  zip.file(
    'embed-snippet.txt',
    `<!-- Option 1: Embed Standalone HTML Gallery -->\n<iframe src="./gallery-embed.html" width="100%" height="640" style="border:1px solid #e5e5e0;border-radius:8px;" loading="lazy"></iframe>\n\n<!-- Option 2: Direct Horizontal Strip Image -->\n<div style="overflow-x:auto;direction:${options.direction};"><img src="./${jpgOut.filename}" alt="${cleanName}" style="height:600px;width:auto;max-width:none;display:block;" /></div>\n`
  );

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  URL.revokeObjectURL(pdfOut.previewUrl);
  URL.revokeObjectURL(htmlOut.previewUrl);

  return {
    format: 'zip',
    blob: zipBlob,
    filename: `${cleanName}-web-bundle-${options.direction}.zip`,
    width: jpgOut.width,
    height: jpgOut.height,
    scaledDown: jpgOut.scaledDown,
    previewUrl: jpgOut.previewUrl,
    previewType: 'image',
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
