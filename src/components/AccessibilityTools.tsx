import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Accessibility, Eye, MousePointer2, RotateCcw, Type, X } from 'lucide-react';
import { useHealthCenter } from '../context/HealthCenterContext';
import { useAccessibility } from '../context/AccessibilityContext';
import type { AccessibilityProfile } from '../context/AccessibilityContext';

const labels = {
  en: {
    title: 'Accessibility settings',
    close: 'Close accessibility settings',
    language: 'Language',
    english: 'English',
    filipino: 'Filipino',
    profiles: 'Accessibility profiles',
    senior: 'Senior citizen',
    visual: 'Visual impairment',
    cognitive: 'Cognitive accessibility',
    motor: 'Motor accessibility',
    default: 'Default settings',
    textSize: 'Text size',
    contrast: 'Contrast',
    normal: 'Normal',
    high: 'High contrast',
    smart: 'Smart contrast',
    highlight: 'Highlight links and controls',
    spacing: 'Increase text spacing',
    dyslexia: 'Dyslexia-friendly font',
    cursor: 'Larger cursor',
    targets: 'Larger touch targets',
    reduceMotion: 'Reduce animations',
    support: 'Screen reader and keyboard support',
    supportInfo: 'Keyboard navigation and visible focus are supported. Device screen readers can read semantic page content; this panel does not replace your device assistive technology.',
    reset: 'Reset all accessibility settings',
  },
  fil: {
    title: 'Mga setting ng accessibility',
    close: 'Isara ang mga setting ng accessibility',
    language: 'Wika',
    english: 'English',
    filipino: 'Filipino',
    profiles: 'Mga profile ng accessibility',
    senior: 'Para sa nakatatanda',
    visual: 'Para sa kapansanan sa paningin',
    cognitive: 'Mas madaling unawain',
    motor: 'Mas madaling galawin',
    default: 'Mga default na setting',
    textSize: 'Laki ng teksto',
    contrast: 'Contrast',
    normal: 'Normal',
    high: 'Mataas na contrast',
    smart: 'Matalinong contrast',
    highlight: 'I-highlight ang mga link at control',
    spacing: 'Dagdagan ang pagitan ng teksto',
    dyslexia: 'Font na mas madaling basahin',
    cursor: 'Palakihin ang cursor',
    targets: 'Palakihin ang mga touch target',
    reduceMotion: 'Bawasan ang animation',
    support: 'Suporta sa screen reader at keyboard',
    supportInfo: 'May keyboard navigation at nakikitang focus. Mababasa ng screen reader ang semantic na nilalaman; hindi pinapalitan ng panel na ito ang assistive technology ng device.',
    reset: 'I-reset ang lahat ng accessibility setting',
  },
} as const;

const profileOptions: Array<{
  id: Exclude<AccessibilityProfile, 'default' | 'custom'>;
  icon: typeof Accessibility;
  label: 'senior' | 'visual' | 'cognitive' | 'motor';
}> = [
  { id: 'senior', icon: Accessibility, label: 'senior' },
  { id: 'visual', icon: Eye, label: 'visual' },
  { id: 'cognitive', icon: Type, label: 'cognitive' },
  { id: 'motor', icon: MousePointer2, label: 'motor' },
];

const settingOptions = [
  ['highlightLinks', 'highlight'],
  ['textSpacing', 'spacing'],
  ['dyslexiaFont', 'dyslexia'],
  ['largeCursor', 'cursor'],
  ['largeTouchTargets', 'targets'],
  ['reduceMotion', 'reduceMotion'],
] as const;

export const AccessibilityTools: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { language, setLanguage } = useHealthCenter();
  const { settings, updateSettings, applyProfile, resetSettings } = useAccessibility();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const t = labels[language];

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 sm:items-center sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      data-accessibility-ui
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="accessibility-panel-title"
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-[#cbd8d0] bg-white shadow-2xl sm:rounded-xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#dce7e1] bg-[#0f4d3c] px-4 py-3 text-white sm:px-5">
          <h2 id="accessibility-panel-title" className="text-base font-bold sm:text-lg">{t.title}</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label={t.close} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/15">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
          <section aria-labelledby="accessibility-language-title">
            <h3 id="accessibility-language-title" className="mb-2 text-sm font-bold">{t.language}</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['en', 'fil'] as const).map((option) => (
                <button key={option} type="button" aria-pressed={language === option} onClick={() => setLanguage(option)} className={`min-h-12 rounded-md border px-3 text-sm font-semibold ${language === option ? 'border-[#17645c] bg-[#eaf3ee] text-[#0f4d3c]' : 'border-[#dce7e1] text-[#4b5563]'}`}>
                  {option === 'en' ? t.english : t.filipino}
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="accessibility-profiles-title">
            <h3 id="accessibility-profiles-title" className="mb-2 text-sm font-bold">{t.profiles}</h3>
            <div className="grid grid-cols-2 gap-2">
              {profileOptions.map(({ id, icon: Icon, label }) => (
                <button key={id} type="button" aria-pressed={settings.profile === id} onClick={() => applyProfile(id)} className={`flex min-h-12 items-center gap-2 rounded-md border px-3 text-left text-xs font-semibold sm:text-sm ${settings.profile === id ? 'border-[#17645c] bg-[#eaf3ee] text-[#0f4d3c]' : 'border-[#dce7e1] text-[#374151]'}`}>
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />{t[label]}
                </button>
              ))}
              <button type="button" aria-pressed={settings.profile === 'default'} onClick={() => applyProfile('default')} className={`col-span-2 min-h-11 rounded-md border px-3 text-sm font-semibold ${settings.profile === 'default' ? 'border-[#17645c] bg-[#eaf3ee] text-[#0f4d3c]' : 'border-[#dce7e1] text-[#4b5563]'}`}>
                {t.default}
              </button>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="accessibility-text-size" className="text-sm font-bold">{t.textSize}</label>
              <span className="text-xs font-semibold text-[#66736f]">{Math.round(settings.textScale * 100)}%</span>
            </div>
            <input id="accessibility-text-size" aria-label={t.textSize} type="range" min="0.9" max="1.6" step="0.1" value={settings.textScale} onChange={(event) => updateSettings({ textScale: Number(event.target.value) })} className="w-full accent-[#17645c]" />
          </section>

          <fieldset>
            <legend className="mb-2 text-sm font-bold">{t.contrast}</legend>
            <div className="grid grid-cols-3 gap-2">
              {(['normal', 'high', 'smart'] as const).map((contrast) => (
                <button key={contrast} type="button" aria-pressed={settings.contrast === contrast} onClick={() => updateSettings({ contrast })} className={`min-h-12 rounded-md border px-2 text-xs font-semibold sm:text-sm ${settings.contrast === contrast ? 'border-[#17645c] bg-[#eaf3ee] text-[#0f4d3c]' : 'border-[#dce7e1] text-[#4b5563]'}`}>
                  {t[contrast]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="divide-y divide-[#edf1ee] rounded-md border border-[#dce7e1] px-3">
            <legend className="sr-only">{t.profiles}</legend>
            {settingOptions.map(([key, label]) => (
              <label key={key} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-2 text-sm">
                <span>{t[label]}</span>
                <input type="checkbox" checked={settings[key]} onChange={(event) => updateSettings({ [key]: event.target.checked })} className="h-5 w-5 shrink-0 accent-[#17645c]" />
              </label>
            ))}
          </fieldset>

          <section className="rounded-md border border-sky-200 bg-sky-50 p-3">
            <h3 className="text-sm font-bold text-sky-950">{t.support}</h3>
            <p className="mt-1 text-xs leading-relaxed text-sky-900">{t.supportInfo}</p>
          </section>
          <button type="button" onClick={resetSettings} className="min-h-12 w-full rounded-md border border-rose-200 px-4 text-sm font-bold text-rose-800 hover:bg-rose-50">{t.reset}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
};
