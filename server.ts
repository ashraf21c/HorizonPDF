import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 50);
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const DIST_DIR = path.resolve(__dirname, 'dist');
const IS_PROD = process.env.NODE_ENV === 'production';

interface StoredPdfMeta {
  id: string;
  title: string;
  direction: 'ltr' | 'rtl';
  pageCount: number;
  sizeBytes: number;
  createdAt: string;
}

let cachedSamplePdf: Uint8Array | null = null;

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

async function generateSamplePdf(): Promise<Uint8Array> {
  if (cachedSamplePdf) return cachedSamplePdf;

  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const plates = [
    {
      num: '01',
      title: 'Horizon Gallery Specimen',
      subtitle: 'Architectural Monograph & Layout Study',
      caption: 'Pages sit side-by-side along a continuous horizontal track, preserving book spreads and panoramic sequences.',
      accent: rgb(0.78, 0.24, 0.17),
      tone: rgb(0.97, 0.96, 0.94),
    },
    {
      num: '02',
      title: 'Bidirectional Reading',
      subtitle: 'LTR & RTL Gallery Flow',
      caption: 'Switch seamlessly between Left-to-Right editorial decks and Right-to-Left Arabic or Manga reading order.',
      accent: rgb(0.12, 0.25, 0.69),
      tone: rgb(0.95, 0.96, 0.98),
    },
    {
      num: '03',
      title: 'Zero-Calc Stitching',
      subtitle: 'Uniform Dimension Alignment',
      caption: 'Pages share matching dimensions, allowing direct edge-to-edge placement in PDF or JPG without distortion.',
      accent: rgb(0.11, 0.36, 0.31),
      tone: rgb(0.94, 0.97, 0.96),
    },
    {
      num: '04',
      title: 'Embeddable On The Fly',
      subtitle: 'Iframe & Multi-Language Snippets',
      caption: 'Share live uploaded documents or export standalone HTML and JPG strips ready for any web stack.',
      accent: rgb(0.68, 0.35, 0.10),
      tone: rgb(0.98, 0.96, 0.93),
    },
    {
      num: '05',
      title: 'Vector & Raster Export',
      subtitle: 'Single-Sheet PDF, JPG & HTML',
      caption: 'Choose vector PDF for crisp typography at any zoom, or raster JPG strips for universal browser compatibility.',
      accent: rgb(0.32, 0.22, 0.56),
      tone: rgb(0.96, 0.95, 0.98),
    },
    {
      num: '06',
      title: 'Multilingual Workspace',
      subtitle: 'English, Arabic & Japanese Ready',
      caption: 'Interface localized across three scripts with a modular translation registry for adding future languages.',
      accent: rgb(0.16, 0.16, 0.15),
      tone: rgb(0.96, 0.96, 0.95),
    },
  ];

  const pageWidth = 540;
  const pageHeight = 720;

  for (const plate of plates) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Paper background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(1, 1, 1),
    });

    // Top gallery frame
    page.drawRectangle({
      x: 36,
      y: 260,
      width: pageWidth - 72,
      height: 360,
      color: plate.tone,
      borderColor: rgb(0.88, 0.88, 0.86),
      borderWidth: 1,
    });

    // Architectural grid accent inside frame
    page.drawRectangle({
      x: 64,
      y: 296,
      width: 180,
      height: 288,
      color: plate.accent,
    });

    page.drawRectangle({
      x: 268,
      y: 440,
      width: 208,
      height: 144,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.85, 0.85, 0.83),
      borderWidth: 1,
    });

    page.drawRectangle({
      x: 268,
      y: 296,
      width: 208,
      height: 120,
      color: rgb(0.91, 0.91, 0.89),
    });

    // Plate index inside color block
    page.drawText(plate.num, {
      x: 82,
      y: 520,
      size: 56,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    // Header metadata line
    page.drawText(`PLATE ${plate.num}  /  06`, {
      x: 36,
      y: 660,
      size: 11,
      font: fontBold,
      color: rgb(0.35, 0.35, 0.33),
    });

    page.drawText('SPECIMEN FOLIO', {
      x: pageWidth - 134,
      y: 660,
      size: 10,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.48),
    });

    // Divider line
    page.drawLine({
      start: { x: 36, y: 642 },
      end: { x: pageWidth - 36, y: 642 },
      thickness: 1,
      color: rgb(0.88, 0.88, 0.86),
    });

    // Editorial title & caption below frame
    page.drawText(plate.title, {
      x: 36,
      y: 210,
      size: 24,
      font: fontBold,
      color: rgb(0.08, 0.08, 0.07),
    });

    page.drawText(plate.subtitle, {
      x: 36,
      y: 184,
      size: 13,
      font: fontRegular,
      color: plate.accent,
    });

    // Simple line-wrapping for caption
    const words = plate.caption.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (candidate.length > 66) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }
    if (currentLine) lines.push(currentLine);

    lines.forEach((line, idx) => {
      page.drawText(line, {
        x: 36,
        y: 144 - idx * 18,
        size: 11,
        font: fontRegular,
        color: rgb(0.32, 0.32, 0.3),
      });
    });

    // Footer ruler
    page.drawLine({
      start: { x: 36, y: 62 },
      end: { x: pageWidth - 36, y: 62 },
      thickness: 1,
      color: rgb(0.88, 0.88, 0.86),
    });

    page.drawText(`Page ${plate.num}`, {
      x: 36,
      y: 42,
      size: 10,
      font: fontRegular,
      color: rgb(0.45, 0.45, 0.43),
    });

    page.drawText('540 x 720 pt', {
      x: pageWidth - 98,
      y: 42,
      size: 10,
      font: fontRegular,
      color: rgb(0.45, 0.45, 0.43),
    });
  }

  cachedSamplePdf = await pdfDoc.save();
  return cachedSamplePdf;
}

function sanitizeId(raw: string): string | null {
  return /^[a-zA-Z0-9_-]{4,32}$/.test(raw) ? raw : null;
}

async function startServer() {
  await ensureUploadsDir();

  const app = express();

  // Allow iframe embedding for /embed/* and PDF file routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/embed/') || req.path.startsWith('/api/pdfs/')) {
      res.removeHeader('X-Frame-Options');
      res.setHeader('Content-Security-Policy', 'frame-ancestors *');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/sample-pdf', async (_req: Request, res: Response) => {
    try {
      const bytes = await generateSamplePdf();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="Horizon_Specimen.pdf"');
      res.send(Buffer.from(bytes));
    } catch (err) {
      console.error('Failed to generate sample PDF:', err);
      res.status(500).json({ error: 'Failed to generate sample PDF' });
    }
  });

  app.post(
    '/api/pdfs',
    express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: `${MAX_UPLOAD_MB}mb` }),
    async (req: Request, res: Response) => {
      try {
        const body = req.body;
        if (!Buffer.isBuffer(body) || body.length === 0) {
          res.status(400).json({ error: 'Missing PDF binary payload' });
          return;
        }

        // Verify valid PDF
        const parsed = await PDFDocument.load(body, { ignoreEncryption: true });
        const pageCount = parsed.getPageCount();

        const id = crypto.randomBytes(5).toString('hex');
        const rawTitleHeader = req.headers['x-pdf-title'];
        const title =
          typeof rawTitleHeader === 'string' && rawTitleHeader.trim()
            ? decodeURIComponent(rawTitleHeader).slice(0, 140)
            : `document-${id}.pdf`;

        const rawDirHeader = req.headers['x-pdf-direction'];
        const direction: 'ltr' | 'rtl' = rawDirHeader === 'rtl' ? 'rtl' : 'ltr';

        const meta: StoredPdfMeta = {
          id,
          title,
          direction,
          pageCount,
          sizeBytes: body.length,
          createdAt: new Date().toISOString(),
        };

        await fs.writeFile(path.join(UPLOADS_DIR, `${id}.pdf`), body);
        await fs.writeFile(path.join(UPLOADS_DIR, `${id}.json`), JSON.stringify(meta, null, 2));

        res.status(201).json({
          ...meta,
          viewUrl: `/view/${id}`,
          embedUrl: `/embed/${id}?dir=${direction}`,
          fileUrl: `/api/pdfs/${id}/file`,
        });
      } catch (err) {
        console.error('Upload error:', err);
        res.status(400).json({ error: 'Invalid or unreadable PDF file' });
      }
    }
  );

  app.get('/api/pdfs/:id', async (req: Request, res: Response) => {
    const id = sanitizeId(String(req.params.id || ''));
    if (!id) {
      res.status(400).json({ error: 'Invalid PDF id' });
      return;
    }

    try {
      const metaRaw = await fs.readFile(path.join(UPLOADS_DIR, `${id}.json`), 'utf8');
      const meta = JSON.parse(metaRaw) as StoredPdfMeta;
      res.json({
        ...meta,
        viewUrl: `/view/${id}`,
        embedUrl: `/embed/${id}?dir=${meta.direction}`,
        fileUrl: `/api/pdfs/${id}/file`,
      });
    } catch {
      res.status(404).json({ error: 'PDF not found' });
    }
  });

  app.patch('/api/pdfs/:id', express.json(), async (req: Request, res: Response) => {
    const id = sanitizeId(String(req.params.id || ''));
    if (!id) {
      res.status(400).json({ error: 'Invalid PDF id' });
      return;
    }

    try {
      const metaPath = path.join(UPLOADS_DIR, `${id}.json`);
      const metaRaw = await fs.readFile(metaPath, 'utf8');
      const meta = JSON.parse(metaRaw) as StoredPdfMeta;

      if (req.body?.direction === 'ltr' || req.body?.direction === 'rtl') {
        meta.direction = req.body.direction;
      }
      if (typeof req.body?.title === 'string' && req.body.title.trim()) {
        meta.title = req.body.title.trim().slice(0, 140);
      }

      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
      res.json({
        ...meta,
        viewUrl: `/view/${id}`,
        embedUrl: `/embed/${id}?dir=${meta.direction}`,
        fileUrl: `/api/pdfs/${id}/file`,
      });
    } catch {
      res.status(404).json({ error: 'PDF not found' });
    }
  });

  app.get('/api/pdfs/:id/file', async (req: Request, res: Response) => {
    const id = sanitizeId(String(req.params.id || ''));
    if (!id) {
      res.status(400).json({ error: 'Invalid PDF id' });
      return;
    }

    try {
      const pdfPath = path.join(UPLOADS_DIR, `${id}.pdf`);
      const metaPath = path.join(UPLOADS_DIR, `${id}.json`);
      const metaRaw = await fs.readFile(metaPath, 'utf8').catch(() => '');
      const meta = metaRaw ? (JSON.parse(metaRaw) as StoredPdfMeta) : null;
      const safeName = (meta?.title || `${id}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');

      const data = await fs.readFile(pdfPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
      res.send(data);
    } catch {
      res.status(404).json({ error: 'PDF file not found' });
    }
  });

  if (IS_PROD) {
    app.use(express.static(DIST_DIR));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HorizonPDF server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
