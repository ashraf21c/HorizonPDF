import { Check, Copy, ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import {
  EMBED_LANG_LABELS,
  getLiveViewerEmbedSnippet,
  type EmbedLang,
} from '../lib/embedCodes';
import type { ReadingDirection } from '../lib/pdfTools';

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  hostedId: string | null;
  savingHost: boolean;
  title: string;
  direction: ReadingDirection;
}

export function EmbedModal({
  isOpen,
  onClose,
  hostedId,
  savingHost,
  title,
  direction,
}: EmbedModalProps) {
  const { t, locale } = useI18n();
  const [embedLang, setEmbedLang] = useState<EmbedLang>('html');
  const [height, setHeight] = useState<number>(600);
  const [copiedKey, setCopiedKey] = useState<'share' | 'embed' | 'code' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const targetId = hostedId || 'sample';
  const shareUrl = `${origin}/view/${targetId}?dir=${direction}&lang=${locale}`;
  const embedUrl = `${origin}/embed/${targetId}?dir=${direction}&lang=${locale}`;

  const snippet = getLiveViewerEmbedSnippet({
    lang: embedLang,
    embedUrl,
    title,
    direction,
    locale,
    height,
  });

  const copyText = async (key: 'share' | 'embed' | 'code', text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white border border-[#E5E5E0] rounded-xl shadow-xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#E5E5E0]">
          <div>
            <h2 className="text-lg font-semibold text-[#141413]">{t.embed.modalTitle}</h2>
            <p className="text-xs text-[#5C5C57] mt-0.5">{t.embed.modalSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.actions.close}
            className="p-1.5 rounded-lg text-[#5C5C57] hover:text-[#141413] hover:bg-[#F2F2EE] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {savingHost ? (
            <div className="p-4 rounded-lg bg-[#F7F7F4] border border-[#E5E5E0] text-sm text-[#5C5C57]">
              {t.embed.uploadingToHost}
            </div>
          ) : (
            <>
              {/* Direct Share URL & Iframe URL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#141413]">
                    {t.embed.shareUrlLabel}
                  </label>
                  <div className="flex items-center gap-1.5" dir="ltr">
                    <input
                      readOnly
                      value={shareUrl}
                      className="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-[#F7F7F4] border border-[#E5E5E0] rounded-lg text-[#141413]"
                    />
                    <button
                      type="button"
                      onClick={() => copyText('share', shareUrl)}
                      className="p-2 rounded-lg border border-[#E5E5E0] hover:bg-[#F2F2EE] cursor-pointer shrink-0"
                      title={t.actions.copyCode}
                    >
                      {copiedKey === 'share' ? (
                        <Check className="w-4 h-4 text-[#16A34A]" />
                      ) : (
                        <Copy className="w-4 h-4 text-[#141413]" />
                      )}
                    </button>
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg border border-[#E5E5E0] hover:bg-[#F2F2EE] shrink-0"
                      title={t.actions.openFullscreen}
                    >
                      <ExternalLink className="w-4 h-4 text-[#141413]" />
                    </a>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#141413]">
                    {t.embed.embedUrlLabel}
                  </label>
                  <div className="flex items-center gap-1.5" dir="ltr">
                    <input
                      readOnly
                      value={embedUrl}
                      className="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-[#F7F7F4] border border-[#E5E5E0] rounded-lg text-[#141413]"
                    />
                    <button
                      type="button"
                      onClick={() => copyText('embed', embedUrl)}
                      className="p-2 rounded-lg border border-[#E5E5E0] hover:bg-[#F2F2EE] cursor-pointer shrink-0"
                      title={t.actions.copyCode}
                    >
                      {copiedKey === 'embed' ? (
                        <Check className="w-4 h-4 text-[#16A34A]" />
                      ) : (
                        <Copy className="w-4 h-4 text-[#141413]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Language selector + Height + Code */}
              <div className="space-y-3">
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

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-[#5C5C57]">
                      <span>{t.embed.heightLabel}</span>
                      <input
                        type="number"
                        min={280}
                        max={1200}
                        step={20}
                        value={height}
                        onChange={(e) => setHeight(Number(e.target.value) || 600)}
                        className="w-20 px-2 py-1 text-xs font-mono tabular-nums border border-[#E5E5E0] rounded-md"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => copyText('code', snippet)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#141413] text-white hover:bg-[#2A2A28] cursor-pointer whitespace-nowrap"
                    >
                      {copiedKey === 'code' ? (
                        <Check className="w-3.5 h-3.5 text-[#4ADE80]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'code' ? t.actions.copied : t.actions.copyCode}</span>
                    </button>
                  </div>
                </div>

                <pre
                  dir="ltr"
                  className="p-4 rounded-lg bg-[#161615] text-[#EDEDEA] text-xs font-mono overflow-x-auto leading-relaxed"
                >
                  <code>{snippet}</code>
                </pre>
              </div>

              {/* Live Iframe Preview */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#141413]">{t.embed.previewTitle}</p>
                <iframe
                  src={embedUrl}
                  title={title}
                  className="w-full h-[260px] rounded-lg border border-[#E5E5E0] bg-[#EFEFED]"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
