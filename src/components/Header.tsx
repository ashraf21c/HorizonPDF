import { Upload } from 'lucide-react';
import { useI18n } from '../i18n';

interface HeaderProps {
  activeMode: 'viewer' | 'converter';
  onSelectMode: (mode: 'viewer' | 'converter') => void;
  onOpenEmbed: () => void;
  onTriggerUpload: () => void;
}

export function Header({
  activeMode,
  onSelectMode,
  onOpenEmbed,
  onTriggerUpload,
}: HeaderProps) {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 bg-[#FFFFFF]/95 backdrop-blur-sm border-b border-[#E5E5E0]">
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element brand wordmark */}
        <a
          href="#viewer"
          onClick={(e) => {
            e.preventDefault();
            onSelectMode('viewer');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="text-lg font-bold tracking-tight text-[#141413] whitespace-nowrap shrink-0"
        >
          {t.brandName}
        </a>

        {/* Zone 2: Concise single-line text navigation links */}
        <nav
          aria-label={t.a11y.mainNavLabel}
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#5C5C57]"
        >
          <a
            href="#viewer"
            aria-current={activeMode === 'viewer' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              onSelectMode('viewer');
              document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#141413] ${
              activeMode === 'viewer' ? 'text-[#141413] underline underline-offset-8 decoration-[#C83E2B] decoration-2' : ''
            }`}
          >
            {t.nav.viewer}
          </a>
          <a
            href="#converter"
            aria-current={activeMode === 'converter' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              onSelectMode('converter');
              document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#141413] ${
              activeMode === 'converter' ? 'text-[#141413] underline underline-offset-8 decoration-[#C83E2B] decoration-2' : ''
            }`}
          >
            {t.nav.converter}
          </a>
          <button
            type="button"
            onClick={onOpenEmbed}
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#141413] cursor-pointer"
          >
            {t.nav.embed}
          </button>
          <a
            href="#guide"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-[#141413]"
          >
            {t.nav.guide}
          </a>
        </nav>

        {/* Zone 3: Primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onTriggerUpload}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#C83E2B] hover:bg-[#B23322] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C83E2B]"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>{t.actions.uploadPdf}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
