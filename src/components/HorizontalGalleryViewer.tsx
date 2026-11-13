import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Moon,
  Share2,
  Sun,
  Upload,
} from 'lucide-react';
import type * as pdfjsLib from 'pdfjs-dist';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { renderPageToCanvas, type ReadingDirection } from '../lib/pdfTools';

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
}

interface GalleryPageTileProps {
  doc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  displayWidth: number;
  displayHeight: number;
  pageLabel: string;
  darkStage: boolean;
}

function GalleryPageTile({
  doc,
  pageNumber,
  scale,
  displayWidth,
  displayHeight,
  pageLabel,
  darkStage,
}: GalleryPageTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderedKey, setRenderedKey] = useState<string>('');
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

  useEffect(() => {
    if (!isVisible || !canvasRef.current) return;
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
  }, [doc, pageNumber, scale, isVisible, renderedKey]);

  return (
    <figure
      ref={containerRef}
      data-page={pageNumber}
      className="shrink-0 flex flex-col items-center select-none"
    >
      <div
        className={`relative overflow-hidden transition-shadow duration-200 ${
          darkStage
            ? 'bg-white shadow-[0_14px_38px_rgba(0,0,0,0.45)] ring-1 ring-white/10'
            : 'bg-white shadow-[0_8px_28px_rgba(20,20,19,0.08)] ring-1 ring-[#D9D9D3]'
        }`}
        style={{
          width: `${Math.floor(displayWidth)}px`,
          height: `${Math.floor(displayHeight)}px`,
        }}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
      <figcaption
        className={`mt-2.5 text-xs tabular-nums ${
          darkStage ? 'text-neutral-400' : 'text-[#6B6B65]'
        }`}
      >
        {pageLabel} {String(pageNumber).padStart(2, '0')}
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
}: HorizontalGalleryViewerProps) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [stageHeight, setStageHeight] = useState<number>(560);
  const [gapPx, setGapPx] = useState<number>(20);
  const [darkStage, setDarkStage] = useState<boolean>(false);
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

  // Ordered physical array left-to-right:
  // LTR -> [1, 2, ..., N]
  // RTL -> [N, ..., 2, 1] so Page 1 sits on the right edge
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

  // Update active page indicator on scroll
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
        tileEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        setCurrentPage(clamped);
      }
    },
    [pageCount]
  );

  const stepPage = useCallback(
    (delta: 1 | -1) => {
      scrollToPage(currentPage + delta);
    },
    [currentPage, scrollToPage]
  );

  // Convert vertical wheel motion into smooth horizontal scroll inside the gallery stage
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        track.scrollLeft += e.deltaY;
      }
    };

    track.addEventListener('wheel', onWheel, { passive: false });
    return () => track.removeEventListener('wheel', onWheel);
  }, []);

  // Keyboard arrow navigation respecting reading direction
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepPage(direction === 'rtl' ? -1 : 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepPage(direction === 'rtl' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [direction, stepPage]);

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
            <span className="text-[#6B6B65] tabular-nums whitespace-nowrap shrink-0">
              {pageCount} {t.toolbar.pagesUnit}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onChangeDirection && (
              <div className="flex items-center p-0.5 bg-[#F2F2EE] rounded-md">
                <button
                  type="button"
                  onClick={() => onChangeDirection('ltr')}
                  className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                    direction === 'ltr' ? 'bg-white text-[#141413] shadow-xs' : 'text-[#5C5C57]'
                  }`}
                >
                  LTR
                </button>
                <button
                  type="button"
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
        className={`relative flex-1 overflow-hidden transition-colors duration-200 ${
          darkStage ? 'bg-[#161615]' : 'bg-[#EFEFED]'
        }`}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-inherit">
            <p className={`text-sm font-medium ${darkStage ? 'text-neutral-300' : 'text-[#5C5C57]'}`}>
              {t.viewer.loadingPdf}
            </p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center z-10">
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
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 bg-white border-t border-[#E5E5E0]">
        {/* Directional Prev / Next + Page Jump */}
        <div className="flex items-center gap-2" dir="ltr">
          <button
            type="button"
            onClick={() => stepPage(direction === 'rtl' ? 1 : -1)}
            disabled={direction === 'rtl' ? currentPage >= pageCount : currentPage <= 1}
            aria-label={direction === 'rtl' ? t.viewer.nextPage : t.viewer.prevPage}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#E5E5E0] text-[#141413] hover:bg-[#F5F5F2] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-2 text-xs font-medium text-[#141413] tabular-nums">
            <span>{String(currentPage).padStart(2, '0')}</span>
            <span className="text-[#8E8E87]">/</span>
            <span className="text-[#5C5C57]">{String(pageCount).padStart(2, '0')}</span>
          </div>

          <button
            type="button"
            onClick={() => stepPage(direction === 'rtl' ? -1 : 1)}
            disabled={direction === 'rtl' ? currentPage <= 1 : currentPage >= pageCount}
            aria-label={direction === 'rtl' ? t.viewer.prevPage : t.viewer.nextPage}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#E5E5E0] text-[#141413] hover:bg-[#F5F5F2] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="hidden lg:inline-block text-xs text-[#6B6B65] ms-2">
            {direction === 'rtl' ? t.viewer.scrollHintRtl : t.viewer.scrollHintLtr}
          </span>
        </div>

        {/* Zoom, Spacing, Stage Backdrop, Share */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Zoom segmented buttons */}
          <div className="flex items-center p-0.5 bg-[#F2F2EE] rounded-lg">
            {(['fit', 0.75, 1, 1.35] as const).map((z) => {
              const active = zoomMode === z;
              const label = z === 'fit' ? t.viewer.zoomFit : `${Math.round(z * 100)}%`;
              return (
                <button
                  key={String(z)}
                  type="button"
                  onClick={() => setZoomMode(z)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                    active ? 'bg-white text-[#141413] shadow-xs' : 'text-[#5C5C57] hover:text-[#141413]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Gap spacing selector */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#5C5C57]">
            <span className="whitespace-nowrap">{t.viewer.gapLabel}</span>
            <div className="flex items-center p-0.5 bg-[#F2F2EE] rounded-lg">
              {[0, 20, 40].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGapPx(g)}
                  className={`px-2 py-1 text-xs font-medium rounded-md tabular-nums cursor-pointer ${
                    gapPx === g ? 'bg-white text-[#141413] shadow-xs' : 'text-[#5C5C57] hover:text-[#141413]'
                  }`}
                >
                  {g}px
                </button>
              ))}
            </div>
          </div>

          {/* Stage Backdrop Toggle */}
          <button
            type="button"
            onClick={() => setDarkStage((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E5E5E0] text-[#141413] hover:bg-[#F5F5F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {darkStage ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{darkStage ? t.viewer.stageLight : t.viewer.stageDark}</span>
          </button>

          {!chromeless && onOpenEmbed && (
            <button
              type="button"
              onClick={onOpenEmbed}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[#141413] text-white hover:bg-[#2C2C2A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
