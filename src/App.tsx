import { useCallback, useEffect, useRef, useState } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import { DeveloperGuide } from './components/DeveloperGuide';
import { EmbedModal } from './components/EmbedModal';
import { Header } from './components/Header';
import { HorizontalGalleryViewer } from './components/HorizontalGalleryViewer';
import { StripConverter } from './components/StripConverter';
import { AVAILABLE_LOCALES, I18nProvider, useI18n } from './i18n';
import { loadPdfInfo, type ReadingDirection } from './lib/pdfTools';

interface RouteInfo {
  isEmbed: boolean;
  pdfId: string | null;
  initialDir: ReadingDirection | null;
}

function parseRoute(): RouteInfo {
  if (typeof window === 'undefined') {
    return { isEmbed: false, pdfId: null, initialDir: null };
  }
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const dirParam = params.get('dir');
  const initialDir: ReadingDirection | null =
    dirParam === 'rtl' || dirParam === 'ltr' ? dirParam : null;

  const embedMatch = path.match(/^\/embed\/([a-zA-Z0-9_-]+)/);
  if (embedMatch) {
    return {
      isEmbed: true,
      pdfId: embedMatch[1] === 'sample' ? null : embedMatch[1],
      initialDir,
    };
  }

  const viewMatch = path.match(/^\/view\/([a-zA-Z0-9_-]+)/);
  if (viewMatch) {
    return {
      isEmbed: false,
      pdfId: viewMatch[1] === 'sample' ? null : viewMatch[1],
      initialDir,
    };
  }

  return { isEmbed: false, pdfId: null, initialDir };
}

function WorkspaceApp() {
  const { t, locale, setLocale } = useI18n();
  const route = parseRoute();

  const [activeMode, setActiveMode] = useState<'viewer' | 'converter'>('viewer');
  const [direction, setDirection] = useState<ReadingDirection>(route.initialDir ?? 'ltr');

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [title, setTitle] = useState<string>('Horizon_Specimen.pdf');
  const [pageCount, setPageCount] = useState<number>(0);
  const [pageWidth, setPageWidth] = useState<number>(540);
  const [pageHeight, setPageHeight] = useState<number>(720);
  const [isSample, setIsSample] = useState<boolean>(true);
  const [hostedId, setHostedId] = useState<string | null>(route.pdfId);
  const [savingHost, setSavingHost] = useState<boolean>(false);

  const [loadingPdf, setLoadingPdf] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [embedModalOpen, setEmbedModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const applyPdfBytes = useCallback(
    async (bytes: Uint8Array, nextTitle: string, nextIsSample: boolean, nextHostedId: string | null) => {
      setLoadingPdf(true);
      setPdfError(null);

      try {
        const info = await loadPdfInfo(bytes);
        if (activeDocRef.current) {
          await activeDocRef.current.cleanup().catch(() => {});
        }
        activeDocRef.current = info.doc;
        setPdfBytes(bytes);
        setPdfDoc(info.doc);
        setPageCount(info.pageCount);
        setPageWidth(info.pageWidth);
        setPageHeight(info.pageHeight);
        setTitle(nextTitle);
        setIsSample(nextIsSample);
        setHostedId(nextHostedId);
      } catch {
        setPdfError(t.viewer.errorPdf);
      } finally {
        setLoadingPdf(false);
      }
    },
    [t.viewer.errorPdf]
  );

  // Initial document load (hosted /view/:id, /embed/:id, or specimen sample)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    async function loadInitial() {
      setLoadingPdf(true);
      setPdfError(null);
      try {
        if (route.pdfId) {
          const metaRes = await fetch(`/api/pdfs/${route.pdfId}`, {
            credentials: 'include',
            signal: controller.signal,
          });
          if (!metaRes.ok) throw new Error('Document not found');
          const meta = (await metaRes.json()) as {
            id: string;
            title: string;
            direction: ReadingDirection;
          };
          const fileRes = await fetch(`/api/pdfs/${route.pdfId}/file`, {
            credentials: 'include',
            signal: controller.signal,
          });
          if (!fileRes.ok) throw new Error('PDF stream failed');
          const buf = new Uint8Array(await fileRes.arrayBuffer());
          if (cancelled) return;
          if (!route.initialDir && meta.direction) {
            setDirection(meta.direction);
          }
          await applyPdfBytes(buf, meta.title, false, meta.id);
        } else {
          const sampleRes = await fetch('/api/sample-pdf', {
            credentials: 'include',
            signal: controller.signal,
          });
          if (!sampleRes.ok) throw new Error('Sample PDF failed');
          const buf = new Uint8Array(await sampleRes.arrayBuffer());
          if (cancelled) return;
          await applyPdfBytes(buf, 'Horizon_Specimen.pdf', true, null);
        }
      } catch {
        if (!cancelled) {
          setPdfError(t.viewer.errorPdf);
          setLoadingPdf(false);
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    loadInitial();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const uploadToServer = useCallback(
    async (bytes: Uint8Array, fileTitle: string, dir: ReadingDirection): Promise<string | null> => {
      setSavingHost(true);
      try {
        const res = await fetch('/api/pdfs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/pdf',
            'x-pdf-title': encodeURIComponent(fileTitle),
            'x-pdf-direction': dir,
          },
          body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { id: string };
        setHostedId(data.id);
        return data.id;
      } catch {
        return null;
      } finally {
        setSavingHost(false);
      }
    },
    []
  );

  const handleFileSelected = useCallback(
    async (file: File) => {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await applyPdfBytes(bytes, file.name, false, null);
      // Persist in background so Share & Embed is immediately ready
      void uploadToServer(bytes, file.name, direction);
    },
    [applyPdfBytes, direction, uploadToServer]
  );

  const handleDirectionChange = useCallback(
    (nextDir: ReadingDirection) => {
      setDirection(nextDir);
      if (hostedId) {
        void fetch(`/api/pdfs/${hostedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction: nextDir }),
        }).catch(() => {});
      }
    },
    [hostedId]
  );

  const handleOpenEmbed = useCallback(async () => {
    setEmbedModalOpen(true);
    if (!isSample && !hostedId && pdfBytes) {
      await uploadToServer(pdfBytes, title, direction);
    }
  }, [direction, hostedId, isSample, pdfBytes, title, uploadToServer]);

  const handleLoadSample = useCallback(async () => {
    setLoadingPdf(true);
    try {
      const sampleRes = await fetch('/api/sample-pdf');
      const buf = new Uint8Array(await sampleRes.arrayBuffer());
      await applyPdfBytes(buf, 'Horizon_Specimen.pdf', true, null);
    } catch {
      setPdfError(t.viewer.errorPdf);
      setLoadingPdf(false);
    }
  }, [applyPdfBytes, t.viewer.errorPdf]);

  // Chromeless Iframe Embed Mode
  if (route.isEmbed) {
    return (
      <HorizontalGalleryViewer
        doc={pdfDoc}
        pageCount={pageCount}
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        title={title}
        direction={direction}
        onChangeDirection={setDirection}
        loading={loadingPdf}
        error={pdfError}
        chromeless
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F4] text-[#141413]">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileSelected(file);
          e.target.value = '';
        }}
      />

      <Header
        activeMode={activeMode}
        onSelectMode={setActiveMode}
        onOpenEmbed={() => void handleOpenEmbed()}
        onTriggerUpload={() => fileInputRef.current?.click()}
      />

      <main id="workspace" className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-5">
        {/* Workspace Toolbar: Document metadata + Mode + Reading Direction + Language */}
        <section className="bg-white border border-[#E5E5E0] rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Document metadata (unboxed text with typographic separators) */}
          <div className="flex flex-wrap items-center gap-2 text-sm min-w-0">
            <span className="font-semibold text-[#141413] truncate max-w-[260px]">{title}</span>
            {pageCount > 0 && (
              <>
                <span className="text-[#B8B8B0]" aria-hidden="true">·</span>
                <span className="text-xs text-[#5C5C57] tabular-nums whitespace-nowrap">
                  {pageCount} {t.toolbar.pagesUnit}
                </span>
                <span className="text-[#B8B8B0]" aria-hidden="true">·</span>
                <span className="text-xs text-[#5C5C57] tabular-nums whitespace-nowrap">
                  {pageWidth} × {pageHeight} pt
                </span>
              </>
            )}
            <span className="text-[#B8B8B0]" aria-hidden="true">·</span>
            <span className="text-xs text-[#6B6B65] whitespace-nowrap">
              {isSample
                ? t.toolbar.sampleBadge
                : hostedId
                  ? t.toolbar.hostedBadge
                  : t.toolbar.localBadge}
            </span>
            {!isSample && (
              <>
                <span className="text-[#B8B8B0]" aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => void handleLoadSample()}
                  className="text-xs font-medium text-[#C83E2B] hover:underline whitespace-nowrap cursor-pointer"
                >
                  {t.actions.loadSample}
                </button>
              </>
            )}
          </div>

          {/* Controls: Mode Tabs, Direction (LTR/RTL), Multilingual Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Workspace Mode Switch */}
            <div className="flex items-center p-1 bg-[#F2F2EE] rounded-lg">
              <button
                type="button"
                onClick={() => setActiveMode('viewer')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeMode === 'viewer'
                    ? 'bg-white text-[#141413] shadow-xs'
                    : 'text-[#5C5C57] hover:text-[#141413]'
                }`}
              >
                {t.toolbar.modeViewer}
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('converter')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeMode === 'converter'
                    ? 'bg-white text-[#141413] shadow-xs'
                    : 'text-[#5C5C57] hover:text-[#141413]'
                }`}
              >
                {t.toolbar.modeConverter}
              </button>
            </div>

            {/* Reading Direction Switch */}
            <div className="flex items-center gap-2">
              <span className="hidden xl:inline text-xs text-[#6B6B65] whitespace-nowrap">
                {t.toolbar.readingDirection}
              </span>
              <div className="flex items-center p-1 bg-[#F2F2EE] rounded-lg">
                <button
                  type="button"
                  onClick={() => handleDirectionChange('ltr')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    direction === 'ltr'
                      ? 'bg-white text-[#141413] shadow-xs'
                      : 'text-[#5C5C57] hover:text-[#141413]'
                  }`}
                >
                  {t.toolbar.ltrLabel}
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectionChange('rtl')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    direction === 'rtl'
                      ? 'bg-white text-[#141413] shadow-xs'
                      : 'text-[#5C5C57] hover:text-[#141413]'
                  }`}
                >
                  {t.toolbar.rtlLabel}
                </button>
              </div>
            </div>

            {/* Language Switcher (English / Arabic / Japanese) */}
            <div className="flex items-center p-1 bg-[#F2F2EE] rounded-lg">
              {AVAILABLE_LOCALES.map((loc) => (
                <button
                  key={loc.code}
                  type="button"
                  onClick={() => setLocale(loc.code)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    locale === loc.code
                      ? 'bg-white text-[#141413] shadow-xs'
                      : 'text-[#5C5C57] hover:text-[#141413]'
                  }`}
                >
                  {loc.nativeName}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Primary Workspace Viewport */}
        {activeMode === 'viewer' ? (
          <HorizontalGalleryViewer
            doc={pdfDoc}
            pageCount={pageCount}
            pageWidth={pageWidth}
            pageHeight={pageHeight}
            title={title}
            direction={direction}
            loading={loadingPdf}
            error={pdfError}
            onOpenEmbed={() => void handleOpenEmbed()}
            onDropFile={(file) => void handleFileSelected(file)}
            onTriggerUpload={() => fileInputRef.current?.click()}
          />
        ) : (
          <StripConverter
            pdfBytes={pdfBytes}
            title={title}
            pageCount={pageCount}
            direction={direction}
            onChangeDirection={handleDirectionChange}
          />
        )}

        {/* Developer, Server Requirements, Embed & Translation Guide */}
        <DeveloperGuide direction={direction} hostedId={hostedId} />
      </main>

      <footer className="border-t border-[#E5E5E0] bg-white mt-12">
        <div className="max-w-[1440px] mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-[#6B6B65]">
          <span>{t.brandName} · Horizontal PDF Gallery & Strip Converter</span>
          <span>English · العربية · 日本語</span>
        </div>
      </footer>

      <EmbedModal
        isOpen={embedModalOpen}
        onClose={() => setEmbedModalOpen(false)}
        hostedId={hostedId}
        savingHost={savingHost}
        title={title}
        direction={direction}
        onChangeDirection={handleDirectionChange}
        pdfDoc={pdfDoc}
        pageCount={pageCount}
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        loadingPdf={loadingPdf}
        pdfError={pdfError}
      />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <WorkspaceApp />
    </I18nProvider>
  );
}
