# HorizonPDF — Horizontal PDF Gallery Viewer & Continuous Strip Converter

HorizonPDF renders multi-page PDF documents horizontally side-by-side like a visual gallery instead of stacking pages vertically. It supports **on-the-fly PDF viewing with shareable embed links**, **converting multi-page PDFs into continuous PDF/JPG/HTML/ZIP strips** using the pages' existing uniform dimensions, **Right-to-Left (RTL)** and **Left-to-Right (LTR)** reading order, and a **multilingual interface** in **English**, **Arabic (`العربية`)**, and **Japanese (`日本語`)**.

---

## Key Features

1. **On-the-Fly Horizontal PDF Gallery Viewer**
   - Drag and drop or upload any unencrypted PDF and inspect pages side-by-side immediately in the browser (`pdfjs-dist`).
   - Mouse-wheel-to-horizontal scroll translation, Left/Right keyboard navigation, Fit/Zoom controls, customizable page spacing, and Light/Dark gallery backdrop.
   - Generates instant share links (`/view/:id`) and chromeless iframe embed endpoints (`/embed/:id?dir=rtl|ltr&lang=ar|ja|en`).

2. **Continuous Strip Converter & Web Bundle Export**
   - Places all pages edge-to-edge using the document's existing page dimensions (no complex aspect-ratio math required).
   - **Output Formats**:
     - **Single-Sheet PDF (`.pdf`)**: Vector pages stitched edge-to-edge on one continuous sheet via `pdf-lib`.
     - **Stitched JPG (`.jpg`)**: Panoramic raster image strip ready for lightweight static hosting.
     - **Standalone HTML (`.html`)**: Self-contained gallery page with embedded pages, keyboard navigation, and RTL/LTR scroll initialization.
     - **Complete Web Bundle (`.zip`)**: Archive containing the stitched `.pdf`, `.jpg`, `gallery-embed.html`, and ready-to-paste `embed-snippet.txt`.
   - Supports both **Horizontal (Side-by-Side)** and **Vertical (Continuous Stack)** stitching axes.

3. **Bidirectional Reading Support (`LTR` & `RTL`)**
   - **LTR**: Page 1 starts on the left and advances rightward (`1 → 2 → 3`).
   - **RTL**: Page 1 starts on the right and advances leftward (`3 ← 2 ← 1`)—ideal for Arabic books, Japanese manga, and right-bound publications.

4. **Multilingual Interface (`en`, `ar`, `ja`)**
   - Automatically switches HTML `lang` and `dir` (`rtl` for Arabic, `ltr` for English and Japanese).

---

## Server Requirements

### Runtime & System Dependencies
- **Node.js**: `>= 20.0.0` (Node 22 LTS recommended; ESM support required)
- **npm**: `>= 10.0.0`
- **Memory (RAM)**: `512 MB` minimum; `1 GB+` recommended if clients export high-DPI multi-page JPG strips
- **Disk Storage**: Writable `./uploads` directory (default `MAX_UPLOAD_MB=50` per PDF; mount a persistent volume in containerized deployments)
- **Native Binaries**: **None required.** All PDF rendering and vector stitching run in standard JavaScript/Canvas (`pdfjs-dist` + `pdf-lib`). You do **not** need Poppler, Ghostscript, or ImageMagick installed on the server.

### Environment Variables
Copy `.env.example` to `.env`:

```env
PORT="3000"
MAX_UPLOAD_MB="50"
APP_URL="https://your-domain.com"
```

### Build & Run

```bash
# Install dependencies
npm install

# Development (Express + Vite middleware on port 3000)
npm run dev

# Production build
npm run build
NODE_ENV=production npm start
```

### Reverse Proxy Configuration (Nginx Example)
To allow large PDF uploads and cross-origin `<iframe>` embeds on external websites:

```nginx
server {
    listen 443 ssl http2;
    server_name pdf.example.com;

    # Match MAX_UPLOAD_MB in .env
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Ensure /embed/:id can be framed by external sites
        proxy_hide_header X-Frame-Options;
    }
}
```

> **Note:** `server.ts` automatically sets `Content-Security-Policy: frame-ancestors *` on `/embed/*` and `/api/pdfs/*` routes.

---

## Embed Codes for Multiple Web Programming Languages

Replace `https://your-domain.com` with your hosted HorizonPDF origin and `<PDF_ID>` with the uploaded document ID (or `sample` for the built-in specimen). Query parameters:
- `dir`: `ltr` or `rtl`
- `lang`: `en`, `ar`, or `ja`

### 1. HTML5 (`<iframe>`)

**Live Uploaded PDF Viewer:**
```html
<iframe
  src="https://your-domain.com/embed/<PDF_ID>?dir=rtl&lang=ar"
  title="Horizontal PDF Gallery"
  width="100%"
  height="600"
  style="border: 1px solid #e5e5e0; border-radius: 8px;"
  loading="lazy"
  allowfullscreen
></iframe>
```

**Converted Stitched JPG Strip (Self-Hosted):**
```html
<div style="overflow-x: auto; overflow-y: hidden; direction: rtl; background: #efeeea; padding: 16px; border-radius: 8px;">
  <img
    src="/uploads/document-horizontal-rtl.jpg"
    alt="Converted PDF Strip"
    style="height: 580px; width: auto; max-width: none; display: block;"
    loading="lazy"
  />
</div>
```

### 2. JavaScript / React / Next.js

```tsx
interface PdfGalleryProps {
  pdfId: string;
  dir?: 'ltr' | 'rtl';
  lang?: 'en' | 'ar' | 'ja';
  height?: number;
}

export function HorizontalPdfGallery({
  pdfId,
  dir = 'ltr',
  lang = 'en',
  height = 600,
}: PdfGalleryProps) {
  const src = `https://your-domain.com/embed/${encodeURIComponent(pdfId)}?dir=${dir}&lang=${lang}`;

  return (
    <iframe
      src={src}
      title="Horizontal PDF Gallery"
      style={{
        width: '100%',
        height: `${height}px`,
        border: '1px solid #e5e5e0',
        borderRadius: '8px',
      }}
      loading="lazy"
      allowFullScreen
    />
  );
}
```

### 3. PHP (Vanilla / Laravel / WordPress)

```php
<?php
$pdfId = 'a1b2c3d4e5';
$dir = 'rtl'; // 'ltr' or 'rtl'
$lang = 'ar'; // 'en', 'ar', or 'ja'
$embedUrl = sprintf(
    'https://your-domain.com/embed/%s?dir=%s&lang=%s',
    rawurlencode($pdfId),
    rawurlencode($dir),
    rawurlencode($lang)
);
?>
<iframe
  src="<?= htmlspecialchars($embedUrl, ENT_QUOTES, 'UTF-8') ?>"
  title="Horizontal PDF Gallery"
  width="100%"
  height="600"
  style="border: 1px solid #e5e5e0; border-radius: 8px;"
  loading="lazy"
  allowfullscreen
></iframe>
```

### 4. Python (Flask / Django Jinja2)

**Backend / View Context:**
```python
from urllib.parse import urlencode

def gallery_context(pdf_id: str, direction: str = "ltr", lang: str = "en"):
    query = urlencode({"dir": direction, "lang": lang})
    return {
        "pdf_embed_url": f"https://your-domain.com/embed/{pdf_id}?{query}"
    }
```

**Template (`gallery.html`):**
```jinja2
<iframe
  src="{{ pdf_embed_url }}"
  title="Horizontal PDF Gallery"
  width="100%"
  height="600"
  style="border: 1px solid #e5e5e0; border-radius: 8px;"
  loading="lazy"
  allowfullscreen
></iframe>
```

### 5. Ruby on Rails (ERB)

```erb
<% embed_url = "https://your-domain.com/embed/#{ERB::Util.url_encode(@pdf_id)}?dir=#{@direction}&lang=#{@lang}" %>
<%= tag.iframe(
  nil,
  src: embed_url,
  title: "Horizontal PDF Gallery",
  width: "100%",
  height: 600,
  style: "border: 1px solid #e5e5e0; border-radius: 8px;",
  loading: "lazy",
  allowfullscreen: true
) %>
```

### 6. Node.js / Express (EJS)

```ejs
<% const embedUrl = `https://your-domain.com/embed/${encodeURIComponent(pdfId)}?dir=${dir}&lang=${lang}`; %>
<iframe
  src="<%= embedUrl %>"
  title="Horizontal PDF Gallery"
  width="100%"
  height="600"
  style="border: 1px solid #e5e5e0; border-radius: 8px;"
  loading="lazy"
  allowfullscreen
></iframe>
```

### 7. ASP.NET Core (C# Razor)

```cshtml
@{
    var pdfId = Uri.EscapeDataString(Model.PdfId);
    var dir = Model.Direction == "rtl" ? "rtl" : "ltr";
    var lang = Model.Lang ?? "en";
    var embedUrl = $"https://your-domain.com/embed/{pdfId}?dir={dir}&lang={lang}";
}
<iframe
  src="@embedUrl"
  title="Horizontal PDF Gallery"
  width="100%"
  height="600"
  style="border: 1px solid #e5e5e0; border-radius: 8px;"
  loading="lazy"
  allowfullscreen
></iframe>
```

---

## Translation & Internationalization (i18n) Guide

All translations live in `src/i18n/` and are strongly typed against `TranslationDictionary` in `src/i18n/types.ts`.

### Directory Structure

```text
src/i18n/
├── types.ts        # TypeScript interface defining every translation key
├── index.tsx       # Locale registry (LOCALES), I18nProvider, and useI18n() hook
└── locales/
    ├── en.ts       # English (dir: 'ltr')
    ├── ar.ts       # Arabic  (dir: 'rtl')
    └── ja.ts       # Japanese (dir: 'ltr')
```

### How to Modify Existing Translations

1. Open the target language file:
   - English: `src/i18n/locales/en.ts`
   - Arabic: `src/i18n/locales/ar.ts`
   - Japanese: `src/i18n/locales/ja.ts`
2. Edit any string value inside the `t` object (for example, `t.actions.uploadPdf` or `t.viewer.dropTitle`).
3. Do **not** rename the property keys unless you also update `src/i18n/types.ts` and every other locale file.
4. Run `npm run lint` to verify there are no missing or mismatched keys.

### How to Add a New Language (Example: French `fr` or Persian `fa`)

1. **Duplicate the English template**:
   Copy `src/i18n/locales/en.ts` to `src/i18n/locales/fr.ts` (or `fa.ts`).
2. **Update `meta` and translate every key in `t`**:
   ```ts
   import type { LocaleBundle } from '../types';

   export const fr: LocaleBundle = {
     meta: {
       code: 'fr',
       nativeName: 'Français',
       englishName: 'French',
       dir: 'ltr', // Use 'rtl' for right-to-left UI languages such as Persian/Hebrew/Urdu
     },
     t: {
       brandName: 'HorizonPDF',
       // ...translate all remaining keys
     },
   };
   ```
3. **Register the locale in `src/i18n/index.tsx`**:
   ```ts
   import { ar } from './locales/ar';
   import { en } from './locales/en';
   import { fr } from './locales/fr';
   import { ja } from './locales/ja';

   export const LOCALES: Record<string, LocaleBundle> = {
     en,
     ar,
     ja,
     fr,
   };
   ```
   The UI language switcher in the workspace toolbar reads `AVAILABLE_LOCALES` automatically from `LOCALES`, so your new language appears immediately with zero extra component changes.
4. **(Optional) Add Web Font Support**:
   If your new script requires a dedicated font (for example, Korean or Devanagari), include it in `index.html` and add it to `--font-sans` in `src/index.css`.
5. **Verify Type Safety**:
   ```bash
   npm run lint
   npm run build
   ```
