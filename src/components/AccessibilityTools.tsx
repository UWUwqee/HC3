import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Accessibility, Eye, Minus, MousePointer2, Plus, RotateCcw, Type, X } from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';
import type { AccessibilityProfile } from '../context/AccessibilityContext';
import { useHealthCenter } from '../context/HealthCenterContext';

const profiles: Array<{ id: AccessibilityProfile; label: string; icon: typeof Accessibility }> = [
  { id: 'senior', label: 'Senior citizen', icon: Accessibility },
  { id: 'visual', label: 'Visual support', icon: Eye },
  { id: 'cognitive', label: 'Cognitive support', icon: Type },
  { id: 'motor', label: 'Motor support', icon: MousePointer2 },
];

export const AccessibilityTools: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { language, setLanguage } = useHealthCenter();
  const { settings, updateSettings, applyProfile, resetSettings } = useAccessibility();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isFilipino = language === 'fil';

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
      ));
      if (focusable.length === 0) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (key: 'highlightLinks' | 'textSpacing' | 'dyslexiaFont' | 'largeCursor' | 'largeTouchTargets' | 'reduceMotion') => {
    updateSettings({ [key]: !settings[key] });
  };
  const reset = () => {
    resetSettings();
    setLanguage('en');
  };
  const t = isFilipino
    ? {
      title: 'Mga setting ng accessibility',
      textSize: 'Laki ng teksto',
      contrast: 'Contrast',
      normal: 'Normal',
      high: 'Mataas',
      smart: 'Pinahusay',
      profiles: 'Mga profile',
      options: 'Iba pang opsyon',
      language: 'Wika',
      close: 'Isara',
      reset: 'I-reset lahat',
      help: 'May keyboard navigation at visible focus. Maaaring gamitin ang screen reader ng device sa semantic na nilalaman.',
    }
    : {
      title: 'Accessibility settings',
      textSize: 'Text size',
      contrast: 'Contrast',
      normal: 'Normal',
      high: 'High',
      smart: 'Enhanced',
      profiles: 'Accessibility profiles',
      options: 'Additional options',
      language: 'Language',
      close: 'Close',
      reset: 'Reset all settings',
      help: 'Keyboard navigation and visible focus are supported. Device screen readers can read semantic page content.',
    };

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
          <h2 id="accessibility-panel-title" className="text-base font-bold">{t.title}</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label={t.close} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/15">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
          <section>
            <h3 className="mb-2 text-sm font-bold">{t.language}</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['en', 'fil'] as const).map((option) => (
                <button key={option} type="button" aria-pressed={language === option} onClick={() => setLanguage(option)} className={`min-h-11 border px-3 text-sm font-semibold ${language === option ? 'border-[#17645c] bg-[#eaf3ee] text-[#0f4d3c]' : 'border-[#dce7e1] text-[#4b5563]'}`}>
                  {option === 'en' ? 'English' : 'Filipino'}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-bold">{t.profiles}</h3>
            <p className="mb-3 text-xs text-[#66736f]">{isFilipino ? 'Pumili ng preset at baguhin ang mga setting kung kailangan.' : 'Choose a preset, then adjust settings as needed.'}</p>
            <div className="grid grid-cols-2 gap-2">
              {profiles.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" aria-pressed={settings.profile === id} onClick={() => applyProfile(id)} className={`flex min-h-11 items-center gap-2 border px-3 text-left text-xs font-semibold ${settings.profile === id ? 'border-[#17645c] bg-[#eaf3ee] text-[#0f4d3c]' : 'border-[#dce7e1] text-[#374151]'}`}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{label}
                </button>
              ))}
              <button type="button" aria-pressed={settings.profile === 'default'} onClick={() => applyProfile('default')} className={`col-span-2 flex min-h-11 items-center justify-center gap-2 border px-3 text-sm font-semibold ${settings.profile === 'default' ? 'border-[#17645c] bg-[#eaf3ee] text-[#0f4d3c]' : 'border-[#dce7e1] text-[#4b5563]'}`}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />{isFilipino ? 'Mga default na setting' : 'Default settings'}
              </button>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="accessibility-text-size" className="text-sm font-bold">{t.textSize}</label>
              <span className="text-xs font-semibold text-[#66736f]">{Math.round(settings.textScale * 100)}%</span>
            </div>
            <div className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2">
              <button type="button" disabled={settings.textScale <= 0.9} aria-label={isFilipino ? 'Bawasan ang laki ng teksto' : 'Decrease text size'} onClick={() => updateSettings({ textScale: Math.max(0.9, Math.round((settings.textScale - 0.1) * 10) / 10) })} className="flex h-11 w-11 items-center justify-center border border-[#cbd8d0] disabled:opacity-40"><Minus className="h-4 w-4" /></button>
              <input id="accessibility-text-size" aria-label={t.textSize} type="range" min="0.9" max="1.6" step="0.1" value={settings.textScale} onChange={(event) => updateSettings({ textScale: Number(event.target.value) })} className="w-full accent-[#17645c]" />
              <button type="button" disabled={settings.textScale >= 1.6} aria-label={isFilipino ? 'Lakihan ang teksto' : 'Increase text size'} onClick={() => updateSettings({ textScale: Math.min(1.6, Math.round((settings.textScale + 0.1) * 10) / 10) })} className="flex h-11 w-11 items-center justify-center border border-[#cbd8d0] disabled:opacity-40"><Plus className="h-4 w-4" /></button>
            </div>
          </section>

          <label className="block text-sm font-bold">
            {t.contrast}
            <select value={settings.contrast} onChange={(event) => updateSettings({ contrast: event.target.value as typeof settings.contrast })} className="mt-1 block min-h-11 w-full border border-[#cbd8d0] bg-white px-3 text-sm font-normal">
              <option value="normal">{t.normal}</option><option value="high">{t.high}</option><option value="smart">{t.smart}</option>
            </select>
          </label>

          <section>
            <h3 className="mb-2 text-sm font-bold">{t.options}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ['highlightLinks', isFilipino ? 'I-highlight ang links at controls' : 'Highlight links and controls'],
                ['textSpacing', isFilipino ? 'Dagdagan ang pagitan ng teksto' : 'Increase text spacing'],
                ['dyslexiaFont', isFilipino ? 'Font na mas madaling basahin' : 'Dyslexia-friendly font'],
                ['largeCursor', isFilipino ? 'Palakihin ang cursor' : 'Larger cursor'],
                ['largeTouchTargets', isFilipino ? 'Palakihin ang touch targets' : 'Larger touch targets'],
                ['reduceMotion', isFilipino ? 'Bawasan ang animation' : 'Reduce animations'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex min-h-11 items-center gap-2 border border-[#e1e8e3] px-3 text-xs font-medium">
                  <input type="checkbox" checked={settings[key]} onChange={() => toggle(key)} className="h-4 w-4 accent-[#17645c]" />{label}
                </label>
              ))}
            </div>
          </section>

          <p className="border-t border-[#e7eee9] pt-3 text-xs leading-relaxed text-[#66736f]">{t.help}</p>
          <button type="button" onClick={reset} className="min-h-11 text-sm font-semibold text-[#17645c] underline underline-offset-2">{t.reset}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
};
