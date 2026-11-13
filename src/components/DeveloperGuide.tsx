import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n';
import {
  EMBED_LANG_LABELS,
  getLiveViewerEmbedSnippet,
  type EmbedLang,
} from '../lib/embedCodes';
import type { ReadingDirection } from '../lib/pdfTools';

interface DeveloperGuideProps {
  direction: ReadingDirection;
  hostedId: string | null;
}

export function DeveloperGuide({ direction, hostedId }: DeveloperGuideProps) {
  const { t, locale } = useI18n();
  const [lang, setLang] = useState<EmbedLang>('html');
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
  const embedUrl = `${origin}/embed/${hostedId || 'sample'}?dir=${direction}&lang=${locale}`;
  const code = getLiveViewerEmbedSnippet({
    lang,
    embedUrl,
    title: 'HorizonPDF Gallery',
    direction,
    locale,
    height: 620,
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section id="guide" className="pt-12 mt-12 border-t border-[#E5E5E0] space-y-8">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight text-[#141413]">
          {t.guide.sectionTitle}
        </h2>
        <p className="text-sm text-[#5C5C57] mt-1.5 leading-relaxed">
          {t.guide.sectionSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Server Requirements + i18n Guide */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#E5E5E0] rounded-xl p-6 space-y-3">
            <h3 className="text-base font-semibold text-[#141413]">
              {t.guide.serverReqTitle}
            </h3>
            <ul className="space-y-2.5 text-sm text-[#4A4A45] leading-relaxed">
              {t.guide.serverReqItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="text-xs font-mono tabular-nums text-[#C83E2B] mt-1 shrink-0">
                    0{idx + 1}.
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-[#E5E5E0] rounded-xl p-6 space-y-3">
            <h3 className="text-base font-semibold text-[#141413]">
              {t.guide.i18nTitle}
            </h3>
            <ol className="space-y-2.5 text-sm text-[#4A4A45] leading-relaxed">
              {t.guide.i18nSteps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="text-xs font-mono tabular-nums text-[#C83E2B] mt-1 shrink-0">
                    0{idx + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-[#6B6B65] pt-2 border-t border-[#ECECE6]">
              {t.guide.readmeNote}
            </p>
          </div>
        </div>

        {/* Multi-Language Embed Snippets */}
        <div className="lg:col-span-7 bg-white border border-[#E5E5E0] rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-[#141413]">
              {t.guide.multiLangEmbedTitle}
            </h3>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E5E5E0] text-[#141413] hover:bg-[#F5F5F2] cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t.actions.copied : t.actions.copyCode}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F2F2EE] rounded-lg w-fit">
            {(Object.keys(EMBED_LANG_LABELS) as EmbedLang[]).map((langKey) => (
              <button
                key={langKey}
                type="button"
                onClick={() => setLang(langKey)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  lang === langKey
                    ? 'bg-white text-[#141413] shadow-xs'
                    : 'text-[#5C5C57] hover:text-[#141413]'
                }`}
              >
                {EMBED_LANG_LABELS[langKey]}
              </button>
            ))}
          </div>

          <pre
            dir="ltr"
            className="p-4 rounded-lg bg-[#161615] text-[#EDEDEA] text-xs font-mono overflow-x-auto leading-relaxed"
          >
            <code>{code}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
