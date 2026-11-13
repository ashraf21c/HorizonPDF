import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => closeBtnRef.current?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        className="w-full max-w-lg bg-white border border-[#E5E5E0] rounded-xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#E5E5E0]">
          <div>
            <h2 id="shortcuts-modal-title" className="text-lg font-semibold text-[#141413]">
              {t.a11y.shortcutsTitle}
            </h2>
            <p className="text-xs text-[#5C5C57] mt-0.5">{t.a11y.shortcutsSubtitle}</p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={t.actions.close}
            className="p-2 rounded-lg text-[#5C5C57] hover:text-[#141413] hover:bg-[#F2F2EE] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {t.a11y.shortcuts.map((item) => (
                <tr key={item.keys} className="border-b border-[#EFEFEA] last:border-b-0">
                  <td className="py-2.5 pe-4 whitespace-nowrap align-top">
                    <kbd
                      dir="ltr"
                      className="inline-block px-2 py-1 text-xs font-mono bg-[#F2F2EE] border border-[#D6D6D0] rounded text-[#141413]"
                    >
                      {item.keys}
                    </kbd>
                  </td>
                  <td className="py-2.5 text-[#333330] leading-snug">{item.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
