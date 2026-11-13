import { Check, Copy, Download, FileCode2, FileImage, FileText, FolderArchive } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import {
  EMBED_LANG_LABELS,
  getConvertedFileEmbedSnippet,
  type EmbedLang,
} from '../lib/embedCodes';
import {
  convertPdfToSingleSheetPdf,
  convertPdfToStandaloneHtml,
  convertPdfToStitchedJpg,
  convertPdfToZipBundle,
  formatBytes,
  loadPdfInfo,
  renderPageToCanvas,
  type ConvertedOutput,
  type ExportFormat,
  type ReadingDirection,
  type StripOrientation,
} from '../lib/pdfTools';

interface StripConverterProps {
  pdfBytes: Uint8Array | null;
  title: string;
  pageCount: number;
  direction: ReadingDirection;
  onChangeDirection: (dir: ReadingDirection) => void;
  onAnnounce?: (message: string) => void;
}

function PdfStripPreview({
  pdfBytes,
  orientation,
  direction,
}: {
  pdfBytes: Uint8Array;
  orientation: StripOrientation;
  direction: ReadingDirection;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadedDoc: Awaited<ReturnType<typeof loadPdfInfo>>['doc'] | null = null;

    async function renderPreview() {
      if (!canvasRef.current) return;
      setRendering(true);
      setRenderError(null);

      try {
        const info = await loadPdfInfo(pdfBytes);
        loadedDoc = info.doc;
        if (cancelled || !canvasRef.current) return;

        // Fit preview cleanly while clamping within safe browser canvas pixel limits
        const targetScale =
          orientation === 'horizontal'
            ? 260 / Math.max(1, info.pageHeight)
            : 420 / Math.max(1, info.pageWidth);
        const maxDim = 14000;
        const maxScaleByDim = Math.min(
          maxDim / Math.max(1, info.pageWidth),
          maxDim / Math.max(1, info.pageHeight)
        );
        const safeScale = Math.max(0.1, Math.min(targetScale, maxScaleByDim, 2));
        const dpr = Math.min(
          typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
          maxDim / Math.max(1, info.pageWidth * safeScale, info.pageHeight * safeScale)
        );

        await renderPageToCanvas(info.doc, 1, canvasRef.current, safeScale, Math.max(1, dpr));
        if (cancelled) return;

        if (containerRef.current && orientation === 'horizontal') {
          requestAnimationFrame(() => {
            if (!containerRef.current) return;
            containerRef.current.scrollLeft =
              direction === 'rtl' ? containerRef.current.scrollWidth : 0;
          });
        }
      } catch {
        if (!cancelled) {
          setRenderError(t.viewer.errorPdf);
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    void renderPreview();

    return () => {
      cancelled = true;
      if (loadedDoc) {
        void loadedDoc.cleanup().catch(() => {});
      }
    };
  }, [pdfBytes, orientation, direction, t.viewer.errorPdf]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || orientation !== 'horizontal') return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [orientation]);

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className="relative gallery-scroll rounded-lg bg-[#EFEFED] border border-[#E5E5E0] p-4 overflow-auto max-h-[340px]"
    >
      {rendering && (
        <div className="py-12 text-center text-xs text-[#5C5C57]">{t.viewer.loadingPdf}</div>
      )}
      {renderError && (
        <div className="py-12 text-center text-xs text-[#B91C1C]">{renderError}</div>
      )}
      <canvas
        ref={canvasRef}
        className={`block shadow-sm bg-white ${
          orientation === 'vertical' ? 'mx-auto' : ''
        } ${rendering || renderError ? 'hidden' : ''}`}
      />
    </div>
  );
}

export function StripConverter({
  pdfBytes,
  title,
  pageCount,
  direction,
  onChangeDirection,
  onAnnounce,
}: StripConverterProps) {
  const { t } = useI18n();

  const [format, setFormat] = useState<ExportFormat>('jpg');
  const [orientation, setOrientation] = useState<StripOrientation>('horizontal');
  const [gapPx, setGapPx] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.5);
  const [converting, setConverting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<ConvertedOutput | null>(null);

  const [embedLang, setEmbedLang] = useState<EmbedLang>('html');
  const [embedHeight, setEmbedHeight] = useState<number>(580);
  const [copied, setCopied] = useState<boolean>(false);

  // Revoke object URL on cleanup or replacement
  useEffect(() => {
    return () => {
      if (output?.previewUrl) {
        URL.revokeObjectURL(output.previewUrl);
      }
    };
  }, [output]);

  const handleConvert = async () => {
    if (!pdfBytes) return;
    setConverting(true);
    setError(null);

    try {
      if (output?.previewUrl) {
        URL.revokeObjectURL(output.previewUrl);
      }

      let result: ConvertedOutput;
      if (format === 'pdf') {
        result = await convertPdfToSingleSheetPdf(pdfBytes, {
          baseName: title,
          orientation,
          direction,
          gapPt: gapPx,
        });
      } else if (format === 'jpg') {
        result = await convertPdfToStitchedJpg(pdfBytes, {
          baseName: title,
          orientation,
          direction,
          gapPx,
          scale,
        });
      } else if (format === 'html') {
        result = await convertPdfToStandaloneHtml(pdfBytes, {
          baseName: title,
          orientation,
          direction,
          gapPx,
          scale,
        });
      } else {
        result = await convertPdfToZipBundle(pdfBytes, {
          baseName: title,
          orientation,
          direction,
          gapPx,
          scale,
        });
      }

      setOutput(result);
      onAnnounce?.(
        t.a11y.announcedConverted.replace('{filename}', result.filename)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  const handleDownload = () => {
    if (!output) return;
    const downloadUrl = URL.createObjectURL(output.blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = output.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  };

  const activeFilename =
    output?.filename ??
    `${title.replace(/\.pdf$/i, '')}-${orientation}-${direction}.${format === 'zip' ? 'zip' : format}`;

  const embedCode = getConvertedFileEmbedSnippet({
    lang: embedLang,
    filename: activeFilename,
    format,
    orientation,
    direction,
    height: embedHeight,
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const formatOptions: { id: ExportFormat; label: string; desc: string; icon: typeof FileImage }[] = [
    { id: 'jpg', label: t.converter.formatJpg, desc: t.converter.formatJpgDesc, icon: FileImage },
    { id: 'pdf', label: t.converter.formatPdf, desc: t.converter.formatPdfDesc, icon: FileText },
    { id: 'html', label: t.converter.formatHtml, desc: t.converter.formatHtmlDesc, icon: FileCode2 },
    { id: 'zip', label: t.converter.formatZip, desc: t.converter.formatZipDesc, icon: FolderArchive },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Configuration Column */}
      <div className="lg:col-span-5 bg-white border border-[#E5E5E0] rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[#141413]">{t.converter.title}</h2>
          <p className="text-sm text-[#5C5C57] mt-1 leading-relaxed">{t.converter.subtitle}</p>
        </div>

        {/* Output Format */}
        <div className="space-y-2.5">
          <label className="block text-xs font-semibold text-[#141413]">
            {t.converter.formatLabel}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {formatOptions.map((opt) => {
              const Icon = opt.icon;
              const selected = format === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFormat(opt.id)}
                  className={`text-start p-3 rounded-lg border transition-colors cursor-pointer ${
                    selected
                      ? 'border-[#C83E2B] bg-[#C83E2B]/[0.04]'
                      : 'border-[#E5E5E0] hover:border-[#C5C5BE] bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-[#141413]">
                    <Icon className={`w-4 h-4 shrink-0 ${selected ? 'text-[#C83E2B]' : 'text-[#5C5C57]'}`} />
                    <span className="truncate">{opt.label}</span>
                  </div>
                  <p className="text-xs text-[#6B6B65] mt-1 leading-snug">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stitching Axis */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-[#141413]">
            {t.converter.orientationLabel}
          </label>
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#F2F2EE] rounded-lg">
            {(['horizontal', 'vertical'] as const).map((axis) => (
              <button
                key={axis}
                type="button"
                onClick={() => setOrientation(axis)}
                className={`px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
                  orientation === axis
                    ? 'bg-white text-[#141413] shadow-xs'
                    : 'text-[#5C5C57] hover:text-[#141413]'
                }`}
              >
                {axis === 'horizontal'
                  ? t.converter.orientationHorizontal
                  : t.converter.orientationVertical}
              </button>
            ))}
          </div>
        </div>

        {/* Direction */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-[#141413]">
            {t.converter.directionLabel}
          </label>
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#F2F2EE] rounded-lg">
            {(['ltr', 'rtl'] as const).map((dirOption) => (
              <button
                key={dirOption}
                type="button"
                onClick={() => onChangeDirection(dirOption)}
                className={`px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap truncate ${
                  direction === dirOption
                    ? 'bg-white text-[#141413] shadow-xs'
                    : 'text-[#5C5C57] hover:text-[#141413]'
                }`}
              >
                {dirOption === 'ltr' ? t.toolbar.ltrLabel : t.toolbar.rtlLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Gap & Scale */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#141413]">
              {t.converter.gapLabel}
            </label>
            <div className="flex items-center p-1 bg-[#F2F2EE] rounded-lg">
              {[0, 12, 24].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGapPx(g)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md tabular-nums cursor-pointer ${
                    gapPx === g ? 'bg-white text-[#141413] shadow-xs' : 'text-[#5C5C57]'
                  }`}
                >
                  {g}px
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#141413]">
              {t.converter.scaleLabel}
            </label>
            <div className="flex items-center p-1 bg-[#F2F2EE] rounded-lg">
              {[1, 1.5, 2].map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={format === 'pdf'}
                  onClick={() => setScale(s)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md tabular-nums cursor-pointer disabled:opacity-40 ${
                    scale === s ? 'bg-white text-[#141413] shadow-xs' : 'text-[#5C5C57]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-xs font-medium text-[#B91C1C]">{error}</p>}

        <button
          type="button"
          disabled={!pdfBytes || converting}
          onClick={handleConvert}
          className="w-full py-2.5 px-4 text-sm font-medium text-white bg-[#C83E2B] hover:bg-[#B23322] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
        >
          {converting ? t.converter.generating : t.actions.convertNow}
        </button>
      </div>

      {/* Right Preview + Bundled Embed Code Column */}
      <div className="lg:col-span-7 space-y-6">
        {/* Output Preview & Download */}
        <div className="bg-white border border-[#E5E5E0] rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#141413]">
                {output ? t.converter.readyTitle : t.converter.previewLabel}
              </h3>
              {output && (
                <p className="text-xs text-[#6B6B65] mt-0.5 tabular-nums">
                  {output.filename} · {output.width} × {output.height} px · {formatBytes(output.blob.size)}
                </p>
              )}
            </div>

            {output && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#141413] hover:bg-[#2A2A28] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>{t.actions.download}</span>
              </button>
            )}
          </div>

          {output?.scaledDown && (
            <p className="text-xs text-[#92400E] bg-[#FEF3C7]/60 border border-[#F59E0B]/30 px-3 py-2 rounded-lg">
              {t.converter.canvasLimitNote}
            </p>
          )}

          {!output ? (
            <div className="h-64 rounded-lg bg-[#F7F7F4] border border-dashed border-[#D6D6D0] flex flex-col items-center justify-center p-6 text-center">
              <p className="text-sm text-[#5C5C57] max-w-md leading-relaxed">
                {t.converter.emptyPreview}
              </p>
              <p className="text-xs text-[#8E8E87] mt-2 tabular-nums">
                {title} · {pageCount} {t.toolbar.pagesUnit} · {orientation} · {direction.toUpperCase()}
              </p>
            </div>
          ) : output.previewType === 'image' ? (
            <div className="gallery-scroll rounded-lg bg-[#EFEFED] border border-[#E5E5E0] p-4 overflow-auto max-h-[340px]">
              <img
                src={output.previewUrl}
                alt={output.filename}
                className={
                  orientation === 'horizontal'
                    ? 'h-[260px] w-auto max-w-none block shadow-sm'
                    : 'w-full max-w-[420px] h-auto mx-auto block shadow-sm'
                }
              />
            </div>
          ) : output.previewType === 'pdf' && output.pdfBytes ? (
            <PdfStripPreview
              pdfBytes={output.pdfBytes}
              orientation={orientation}
              direction={direction}
            />
          ) : (
            <iframe
              srcDoc={output.htmlString}
              title={output.filename}
              className="w-full h-[340px] rounded-lg border border-[#E5E5E0] bg-[#EFEFED]"
            />
          )}
        </div>

        {/* Bundled Online Embed Code */}
        <div className="bg-white border border-[#E5E5E0] rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#141413]">
                {t.converter.bundledEmbedTitle}
              </h3>
              <p className="text-xs text-[#5C5C57] mt-0.5">
                {t.converter.bundledEmbedSubtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E5E5E0] text-[#141413] hover:bg-[#F5F5F2] cursor-pointer whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t.actions.copied : t.actions.copyCode}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F2F2EE] rounded-lg">
              {(Object.keys(EMBED_LANG_LABELS) as EmbedLang[]).map((langKey) => (
                <button
                  key={langKey}
                  type="button"
                  onClick={() => setEmbedLang(langKey)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    embedLang === langKey
                      ? 'bg-white text-[#141413] shadow-xs'
                      : 'text-[#5C5C57] hover:text-[#141413]'
                  }`}
                >
                  {EMBED_LANG_LABELS[langKey]}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs text-[#5C5C57]">
              <span>{t.embed.heightLabel}</span>
              <input
                type="number"
                min={280}
                max={1400}
                step={20}
                value={embedHeight}
                onChange={(e) => setEmbedHeight(Number(e.target.value) || 580)}
                className="w-20 px-2 py-1 text-xs font-mono tabular-nums border border-[#E5E5E0] rounded-md bg-white text-[#141413]"
              />
            </label>
          </div>

          <pre
            dir="ltr"
            className="p-4 rounded-lg bg-[#161615] text-[#EDEDEA] text-xs font-mono overflow-x-auto leading-relaxed"
          >
            <code>{embedCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
