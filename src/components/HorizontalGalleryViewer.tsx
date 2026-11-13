import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Moon,
  Share2,
  Sun,
  Upload,
} from 'lucide-react';
import type * as pdfjsLib from 'pdfjs-dist';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import {
  extractPageText,
  renderPageToCanvas,
  type ReadingDirection,
} from '../lib/pdfTools';

interface HorizontalGalleryViewerProps {
  doc: pdfjsLib.PDFDocumentProxy | null;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  title: string;
  direction: ReadingDirection;
  onChangeDirection?: (dir: ReadingDirection) => void;
  loading: boolean;
  error: string | null;
  chromeless?: boolean;
  embeddedPreview?: boolean;
  openViewerUrl?: string;
  onOpenEmbed?: () => void;
  onDropFile?: (file: File) => void;
  onTriggerUpload?: () => void;
  onAnnounce?: (message: string) => void;
}

interface GalleryPageTileProps {
  doc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  displayWidth: number;
  displayHeight: number;
  pageLabel: string;
  darkStage: boolean;
  textMode: boolean;
  textFontSize: number;
  noTextFallback: string;
}

function GalleryPageTile({
  doc,
  pageNumber,
  scale,
  displayWidth,
  displayHeight,
  pageLabel,
  darkStage,
  textMode,
  textFontSize,
  noTextFallback,
}: GalleryPageTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderedKey, setRenderedKey] = useState<string>('');
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(pageNumber <= 12);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible]);

  // Extract screen-reader & accessible text layer for each visible page
  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    extractPageText(doc, pageNumber)
      .then((text) => {
        if (!cancelled) setExtractedText(text);
      })
      .catch(() => {
        if (!cancelled) setExtractedText('');
      });

    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, isVisible]);

  // Render canvas when in visual page view
  useEffect(() => {
    if (textMode || !isVisible || !canvasRef.current) return;
    const targetKey = `${pageNumber}-${scale.toFixed(3)}`;
    if (renderedKey === targetKey) return;

    let cancelled = false;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    renderPageToCanvas(doc, pageNumber, canvasRef.current, scale, dpr)
      .then(() => {
        if (!cancelled) setRenderedKey(targetKey);
      })
      .catch(() => {
        // Ignore cancelled renders during rapid zoom/file change
      });

    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, scale, isVisible, renderedKey, textMode]);

  const pageHeading = `${pageLabel} ${String(pageNumber).padStart(2, '0')}`;

  return (
    <figure
      ref={containerRef}
      data-page={pageNumber}
      aria-label={pageHeading}
      className="shrink-0 flex flex-col items-center"
    >
      {textMode ? (
        <article
          aria-label={pageHeading}
          className={`overflow-y-auto p-5 text-start leading-relaxed transition-shadow duration-200 select-text ${
            darkStage
              ? 'bg-[#1F1F1D] text-[#F5F5F2] ring-1 ring-white/15 shadow-[0_14px_38px_rgba(0,0,0,0.45)]'
              : 'bg-white text-[#141413] ring-1 ring-[#D9D9D3] shadow-[0_8px_28px_rgba(20,20,19,0.08)]'
          }`}
          style={{
            width: `${Math.max(260, Math.floor(displayWidth))}px`,
            height: `${Math.floor(displayHeight)}px`,
            fontSize: `${textFontSize}px`,
          }}
        >
          <p className="text-xs font-semibold text-[#C83E2B] mb-2 pb-1.5 border-b border-current/15 tabular-nums">
            {pageHeading}
          </p>
          <div className="whitespace-pre-wrap break-words">
            {extractedText && extractedText.length > 0 ? extractedText : noTextFallback}
          </div>
        </article>
      ) : (
        <div
          className={`relative overflow-hidden transition-shadow duration-200 select-none ${
            darkStage
              ? 'bg-white shadow-[0_14px_38px_rgba(0,0,0,0.45)] ring-1 ring-white/10'
              : 'bg-white shadow-[0_8px_28px_rgba(20,20,19,0.08)] ring-1 ring-[#D9D9D3]'
          }`}
          style={{
            width: `${Math.floor(displayWidth)}px`,
            height: `${Math.floor(displayHeight)}px`,
          }}
        >
          <canvas ref={canvasRef} aria-hidden="true" className="block w-full h-full" />
          {/* Screen-reader accessible text equivalent for canvas pages */}
          <div className="sr-only">
            <h4>{pageHeading}</h4>
            <p>{extractedText && extractedText.length > 0 ? extractedText : noTextFallback}</p>
          </div>
        </div>
      )}

      <figcaption
        className={`mt-2.5 text-xs tabular-nums ${
          darkStage ? 'text-neutral-300' : 'text-[#5C5C57]'
        }`}
      >
        {pageHeading}
      </figcaption>
    </figure>
  );
}

export function HorizontalGalleryViewer({
  doc,
  pageCount,
  pageWidth,
  pageHeight,
  title,
  direction,
  onChangeDirection,
  loading,
  error,
  chromeless = false,
  embeddedPreview = false,
  openViewerUrl,
  onOpenEmbed,
  onDropFile,
  onTriggerUpload,
  onAnnounce,
}: HorizontalGalleryViewerProps) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [stageHeight, setStageHeight] = useState<number>(560);
  const [gapPx, setGapPx] = useState<number>(20);
  const [darkStage, setDarkStage] = useState<boolean>(false);
  const [textMode, setTextMode] = useState<boolean>(false);
  const [textFontSize, setTextFontSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  // Track stage height for "Fit" zoom calculation
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const updateHeight = () => {
      const h = el.clientHeight;
      if (h > 120) setStageHeight(h);
    };
    updateHeight();

    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const effectiveScale = useMemo(() => {
    if (!pageHeight) return 1;
    if (zoomMode === 'fit') {
      const paddingY = embeddedPreview ? 56 : 88;
      const availableH = Math.max(110, stageHeight - paddingY);
      return Math.min(2, Math.max(0.18, availableH / pageHeight));
    }
    return zoomMode;
  }, [zoomMode, stageHeight, pageHeight, embeddedPreview]);

  const tileWidth = Math.max(90, pageWidth * effectiveScale);
  const tileHeight = Math.max(120, pageHeight * effectiveScale);

  const orderedPages = useMemo(() => {
    const arr = Array.from({ length: pageCount }, (_, i) => i + 1);
    return direction === 'rtl' ? arr.reverse() : arr;
  }, [pageCount, direction]);

  // Reset initial scroll position to Page 1 whenever doc or direction changes
  useEffect(() => {
    const track = trackRef.current;
    if (!track || pageCount === 0) return;

    requestAnimationFrame(() => {
      if (direction === 'rtl') {
        track.scrollLeft = track.scrollWidth;
      } else {
        track.scrollLeft = 0;
      }
      setCurrentPage(1);
    });
  }, [doc, direction, pageCount, tileWidth]);

  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || pageCount === 0) return;

    const centerX = track.scrollLeft + track.clientWidth / 2;
    const step = tileWidth + gapPx;
    const paddingStart = 32;
    const rawSlot = Math.floor((centerX - paddingStart) / step);
    const clampedSlot = Math.max(0, Math.min(pageCount - 1, rawSlot));
    const pageNum = orderedPages[clampedSlot] ?? 1;
    setCurrentPage(pageNum);
  }, [pageCount, tileWidth, gapPx, orderedPages]);

  const scrollToPage = useCallback(
    (targetPage: number) => {
      const track = trackRef.current;
      if (!track) return;
      const clamped = Math.max(1, Math.min(pageCount, targetPage));
      const tileEl = track.querySelector<HTMLElement>(`[data-page="${clamped}"]`);
      if (tileEl) {
        const prefersReduced =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        tileEl.scrollIntoView({
          behavior: prefersReduced ? 'auto' : 'smooth',
          inline: 'center',
          block: 'nearest',
        });
        setCurrentPage(clamped);
        onAnnounce?.(
          t.a11y.announcedPage
            .replace('{current}', String(clamped))
            .replace('{total}', String(pageCount))
        );
      }
    },
    [pageCount, onAnnounce, t.a11y.announcedPage]
  );

  const stepPage = useCallback(
    (delta: 1 | -1) => {
      scrollToPage(currentPage + delta);
    },
    [currentPage, scrollToPage]
  );

  const toggleTextMode = useCallback(() => {
    setTextMode((prev) => {
      const next = !prev;
      onAnnounce?.(next ? t.a11y.announcedTextViewOn : t.a11y.announcedTextViewOff);
      return next;
    });
  }, [onAnnounce, t.a11y.announcedTextViewOff, t.a11y.announcedTextViewOn]);

  // Convert vertical wheel motion into smooth horizontal scroll inside the gallery stage
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onWheel = (e: WheelEvent) => {
      if (textMode) return; // Allow vertical reading scroll inside text cards
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        track.scrollLeft += e.deltaY;
      }
    };

    track.addEventListener('wheel', onWheel, { passive: false });
    return () => track.removeEventListener('wheel', onWheel);
  }, [textMode]);

  // Keyboard shortcuts for gallery navigation, zoom, and accessible text view
  useEffect(() => {
    if (embeddedPreview) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepPage(direction === 'rtl' ? -1 : 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepPage(direction === 'rtl' ? 1 : -1);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        stepPage(1);
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        stepPage(-1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        scrollToPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        scrollToPage(pageCount);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoomMode((prev) => {
          const base = prev === 'fit' ? 1 : prev;
          return Math.min(1.75, Number((base + 0.2).toFixed(2)));
        });
      } else if (e.key === '-') {
        e.preventDefault();
        setZoomMode((prev) => {
          const base = prev === 'fit' ? 1 : prev;
          return Math.max(0.5, Number((base - 0.2).toFixed(2)));
        });
      } else if (e.key === '0') {
        e.preventDefault();
        setZoomMode('fit');
      } else if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleTextMode();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [direction, stepPage, scrollToPage, pageCount, embeddedPreview, toggleTextMode]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (!onDropFile) return;
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      onDropFile(file);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        if (!onDropFile) return;
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleDrop}
      className={`relative flex flex-col border border-[#E5E5E0] bg-white overflow-hidden ${
        embeddedPreview
          ? 'h-[310px] rounded-lg'
          : chromeless
            ? 'h-screen rounded-none border-0'
            : 'rounded-xl h-[70vh] min-h-[540px]'
      }`}
    >
      {/* Top minimal bar in chromeless embed mode */}
      {chromeless && (
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-white border-b border-[#E5E5E0] text-xs">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-semibold text-[#141413] truncate">{title}</span>
            <span className="text-[#5C5C57] tabular-nums whitespace-nowrap shrink-0">
              {pageCount} {t.toolbar.pagesUnit}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onChangeDirection && (
              <div className="flex items-center p-0.5 bg-[#F2F2EE] rounded-md">
                <button
                  type="button"
                  aria-pressed={direction === 'ltr'}
                  onClick={() => onChangeDirection('ltr')}
                  className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                    direction === 'ltr' ? 'bg-white text-[#141413] shadow-xs' : 'text-[#5C5C57]'
                  }`}
                >
                  LTR
                </button>
                <button
                  type="button"
                  aria-pressed={direction === 'rtl'}
                  onClick={() => onChangeDirection('rtl')}
                  className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                    direction === 'rtl' ? 'bg-white text-[#141413] shadow-xs' : 'text-[#5C5C57]'
                  }`}
                >
                  RTL
                </button>
              </div>
            )}
            <a
              href={openViewerUrl || window.location.href.replace('/embed/', '/view/')}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[#141413] hover:text-[#C83E2B] whitespace-nowrap"
            >
              <span>{t.actions.openFullscreen}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Main Horizontal Gallery Stage */}
      <div
        ref={stageRef}
        role="region"
        aria-label={t.a11y.galleryRegionLabel}
        className={`relative flex-1 overflow-hidden transition-colors duration-200 ${
          darkStage ? 'bg-[#161615]' : 'bg-[#EFEFED]'
        }`}
      >
        {loading && (
          <div role="status" className="absolute inset-0 flex items-center justify-center z-10 bg-inherit">
            <p className={`text-sm font-medium ${darkStage ? 'text-neutral-200' : 'text-[#3D3D3A]'}`}>
              {t.viewer.loadingPdf}
            </p>
          </div>
        )}

        {error && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center z-10">
            <p className="text-sm font-medium text-[#B91C1C] max-w-md">{error}</p>
            {onTriggerUpload && (
              <button
                type="button"
                onClick={onTriggerUpload}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#C83E2B] rounded-lg cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{t.actions.uploadPdf}</span>
              </button>
            )}
          </div>
        )}

        {!loading && !error && doc && (
          <div
            ref={trackRef}
            dir="ltr"
            tabIndex={0}
            aria-label={t.a11y.galleryRegionLabel}
            onScroll={handleScroll}
            className="gallery-scroll w-full h-full overflow-x-auto overflow-y-hidden flex items-center px-8 py-6"
            style={{ gap: `${gapPx}px` }}
          >
            {orderedPages.map((pageNum) => (
              <GalleryPageTile
                key={`${pageNum}-${direction}`}
                doc={doc}
                pageNumber={pageNum}
                scale={effectiveScale}
                displayWidth={tileWidth}
                displayHeight={tileHeight}
                pageLabel={t.viewer.pagePrefix}
                darkStage={darkStage}
                textMode={textMode}
                textFontSize={textFontSize}
                noTextFallback={t.a11y.noExtractableText}
              />
            ))}
          </div>
        )}

        {/* Drag-and-drop overlay */}
        {isDraggingFile && (
          <div className="absolute inset-0 z-20 bg-[#FFFFFF]/92 backdrop-blur-xs border-2 border-dashed border-[#C83E2B] m-3 rounded-lg flex flex-col items-center justify-center text-center p-6 pointer-events-none">
            <Upload className="w-8 h-8 text-[#C83E2B] mb-2" />
            <p className="text-base font-semibold text-[#141413]">{t.viewer.dropTitle}</p>
            <p className="text-sm text-[#5C5C57] mt-1">{t.viewer.dropSubtitle}</p>
          </div>
        )}
      </div>

      {/* Gallery Control Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white border-t border-[#E5E5E0]">
        {/* Directional Prev / Next + Direct Page Jump */}
        <div className="flex items-center gap-2" dir="ltr">
          <button
            type="button"
            onClick={() => stepPage(direction === 'rtl' ? 1 : -1)}
            disabled={direction === 'rtl' ? currentPage >= pageCount : currentPage <= 1}
            aria-label={direction === 'rtl' ? t.viewer.nextPage : t.viewer.prevPage}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-[#E5E5E0] text-[#141413] hover:bg-[#F5F5F2] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <select
            aria-label={t.a11y.pageJumpLabel}
            value={currentPage}
            onChange={(e) => scrollToPage(Number(e.target.value))}
            disabled={pageCount === 0}
            className="h-10 px-2.5 text-xs font-medium text-[#141413] bg-[#F7F7F4] border border-[#E5E5E0] rounded-lg tabular-nums cursor-pointer"
          >
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                {String(p).padStart(2, '0')} / {String(pageCount).padStart(2, '0')}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => stepPage(direction === 'rtl' ? -1 : 1)}
            disabled={direction === 'rtl' ? currentPage <= 1 : currentPage >= pageCount}
            aria-label={direction === 'rtl' ? t.viewer.prevPage : t.viewer.nextPage}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-[#E5E5E0] text-[#141413] hover:bg-[#F5F5F2] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="hidden xl:inline-block text-xs text-[#5C5C57] ms-2">
            {direction === 'rtl' ? t.viewer.scrollHintRtl : t.viewer.scrollHintLtr}
          </span>
        </div>

        {/* Zoom, Text View, Spacing, Stage Backdrop, Share */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Accessible Text View Toggle */}
          <button
            type="button"
            aria-pressed={textMode}
            onClick={toggleTextMode}
            className={`inline-flex items-center gap-1.5 px-3 h-10 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              textMode
                ? 'bg-[#141413] text-white border-[#141413]'
                : 'border-[#E5E5E0] text-[#141413] hover:bg-[#F5F5F2]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{textMode ? t.a11y.canvasViewToggle : t.a11y.textViewToggle}</span>
          </button>

          {/* Text size controls when Text View is active */}
          {textMode && (
            <div className="flex items-center p-1 bg-[#F2F2EE] rounded-lg">
              <button
                type="button"
                aria-label={t.a11y.textScaleDecrease}
                onClick={() => setTextFontSize((s) => Math.max(12, s - 2))}
                className="px-2.5 py-1 text-xs font-medium rounded-md text-[#141413] hover:bg-white cursor-pointer"
              >
                A-
              </button>
              <button
                type="button"
                aria-label={t.a11y.textScaleIncrease}
                onClick={() => setTextFontSize((s) => Math.min(24, s + 2))}
                className="px-2.5 py-1 text-xs font-medium rounded-md text-[#141413] hover:bg-white cursor-pointer"
              >
                A+
              </button>
            </div>
          )}

          {/* Zoom segmented buttons */}
          <div className="flex items-center p-1 bg-[#F2F2EE] rounded-lg">
            {(['fit', 0.75, 1, 1.35] as const).map((z) => {
              const active = zoomMode === z;
              const label = z === 'fit' ? t.viewer.zoomFit : `${Math.round(z * 100)}%`;
              return (
                <button
                  key={String(z)}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setZoomMode(z)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                    active ? 'bg-white text-[#141413] shadow-xs' : 'text-[#5C5C57] hover:text-[#141413]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Gap spacing selector */}
          {!embeddedPreview && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#5C5C57]">
              <span className="whitespace-nowrap">{t.viewer.gapLabel}</span>
              <div className="flex items-center p-1 bg-[#F2F2EE] rounded-lg">
                {[0, 20, 40].map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={gapPx === g}
                    onClick={() => setGapPx(g)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md tabular-nums cursor-pointer ${
                      gapPx === g ? 'bg-white text-[#141413] shadow-xs' : 'text-[#5C5C57] hover:text-[#141413]'
                    }`}
                  >
                    {g}px
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stage Backdrop Toggle */}
          <button
            type="button"
            aria-pressed={darkStage}
            onClick={() => setDarkStage((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 h-10 text-xs font-medium rounded-lg border border-[#E5E5E0] text-[#141413] hover:bg-[#F5F5F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {darkStage ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{darkStage ? t.viewer.stageLight : t.viewer.stageDark}</span>
          </button>

          {!chromeless && onOpenEmbed && (
            <button
              type="button"
              onClick={onOpenEmbed}
              className="inline-flex items-center gap-1.5 px-3.5 h-10 text-xs font-medium rounded-lg bg-[#141413] text-white hover:bg-[#2C2C2A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{t.actions.shareAndEmbed}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
