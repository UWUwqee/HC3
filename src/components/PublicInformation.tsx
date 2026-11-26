import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CalendarDays, Clock3, MapPin, Megaphone, Stethoscope } from 'lucide-react';
import { useHealthCenter } from '../context/HealthCenterContext';
import { BackToHomeButton } from './BackToHomeButton';

export const PublicInformation: React.FC = () => {
  const { language, siteContent, siteContentError } = useHealthCenter();
  const isFilipino = language === 'fil';
  const featuredServices = siteContent.services.slice(0, 5);
  const updates = siteContent.news.slice(0, 3);
  const outreach = siteContent.outreach.slice(0, 3);
  const settings = siteContent.settings;
  const holidayAdvisory = (isFilipino ? settings.holidayAdvisoryFil : settings.holidayAdvisory).trim()
    || (isFilipino ? 'Tiyakin ang operasyon ng klinika bago bumisita tuwing holiday.' : 'Verify clinic operations before visiting on holidays.');
  const clinicDuty = isFilipino ? settings.clinicHoursFil : settings.clinicHours;
  const [viewingImage, setViewingImage] = useState<{ url: string; alt: string } | null>(null);

  useEffect(() => {
    if (!viewingImage) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewingImage(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [viewingImage]);

  return (
    <section id="clinic-information" className="site-section-bg section-enter border-b border-[#dce7e1] py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        {siteContentError && <p role="status" className="mb-4 border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{isFilipino ? 'Hindi ma-refresh ang pinakabagong impormasyon ng klinika; ipinapakita ang huling na-save na nilalaman.' : 'Clinic information could not be refreshed; showing the last saved content.'}</p>}
        <BackToHomeButton />
        <div className="breadcrumb">Home <span aria-hidden="true">/</span> <span className="font-semibold text-[#0f4d3c]">Information</span></div>
        <div className="mb-6">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#2c7a5f]">Clinic information</div>
          <h2 className="text-2xl font-bold text-[#0f4d3c] sm:text-3xl">
            {isFilipino ? 'Kasalukuyang impormasyon' : 'Current information'}
          </h2>
        </div>
        <div className="holiday-advisory" role="note">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div><strong>{isFilipino ? 'Pabatid sa holiday:' : 'Holiday advisory:'}</strong> {holidayAdvisory}</div>
        </div>
      </div>

      <div className="w-full bg-[#0b3f32] px-5 py-5 shadow-lg shadow-[#0b3f32]/15 sm:px-8 sm:py-8 lg:px-12">
        <section aria-labelledby="announcements-heading" className="mx-auto max-w-7xl space-y-4">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-emerald-100">
              <Megaphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 id="announcements-heading" className="text-lg font-bold text-white">{isFilipino ? 'Mga anunsyo' : 'Announcements'}</h3>
              <p className="mt-0.5 text-xs text-emerald-100">{isFilipino ? 'Mga pinakabagong balita at pabatid mula sa health center' : 'The latest news and notices from the health center'}</p>
            </div>
          </div>
          {updates.length > 0 ? (
            <div className="space-y-4">
              {updates.map((update) => (
                <article key={update.id} className="overflow-hidden rounded-xl border border-white/70 bg-white shadow-md shadow-black/10">
                  <div className="p-4 sm:p-5">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#eaf3ee] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#17645c]">
                        {isFilipino ? update.categoryFil : update.category}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-[#66736f]">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {update.date}
                      </span>
                    </div>
                    <h4 className="text-base font-bold leading-snug text-[#123f36] sm:text-lg">
                      {isFilipino ? update.titleFil : update.title}
                    </h4>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#43534d]">
                      {(isFilipino ? update.contentFil : update.content) || (isFilipino ? update.summaryFil : update.summary)}
                    </p>
                    {update.author && <div className="mt-4 border-t border-[#e7eee9] pt-3 text-xs font-medium text-[#66736f]">{update.author}</div>}
                  </div>
                  {update.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setViewingImage({ url: update.imageUrl!, alt: isFilipino ? update.titleFil : update.title })}
                      aria-label={isFilipino ? `Tingnan ang buong larawan: ${update.titleFil}` : `View full image: ${update.title}`}
                      className="group block w-full cursor-zoom-in overflow-hidden border-t border-[#e1e9e4] bg-[#f3f7f4] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#17645c]"
                    >
                      <img
                        src={update.imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="mx-auto block max-h-[28rem] h-auto w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-white/15 bg-white/5 px-4 py-5 text-sm text-emerald-50">
              {isFilipino ? 'Wala pang bagong anunsyo.' : 'There are no current announcements.'}
            </p>
          )}
        </section>
      </div>

      <div className="mx-auto mt-6 max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="grid gap-3 md:grid-cols-2">
          <section className="site-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-[#0f4d3c]"><Clock3 className="h-5 w-5 text-[#2c7a5f]" />{isFilipino ? 'Oras ng klinika' : 'Clinic hours'}</h3>
            <div className="space-y-1 text-xs text-[#374151]">
              <p>{clinicDuty}</p>
              {[settings.doctorHours, settings.xrayHours, settings.dentalHours]
                .map((hours, index) => {
                  const localizedHours = isFilipino
                    ? [settings.doctorHoursFil, settings.xrayHoursFil, settings.dentalHoursFil][index]
                    : hours;
                  return localizedHours.trim() ? <p key={`${index}-${localizedHours}`}>{localizedHours}</p> : null;
                })}
            </div>
          </section>

          <section className="site-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-[#0f4d3c]"><Stethoscope className="h-5 w-5 text-[#2c7a5f]" />{isFilipino ? 'Mga serbisyo' : 'Services overview'}</h3>
            {featuredServices.length > 0 ? (
              <ul className="bullet-list text-sm text-[#374151]">
                {featuredServices.map((service) => <li key={service.id}><strong>{isFilipino ? service.titleFil : service.title}</strong>{service.badge ? ` · ${isFilipino ? service.badgeFil : service.badge}` : ''}</li>)}
              </ul>
            ) : <p className="text-sm text-[#6b7280]">{isFilipino ? 'Wala pang nailathalang serbisyo.' : 'No services have been published yet.'}</p>}
          </section>

          <section className="site-card p-4 md:col-span-2">
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-[#0f4d3c]"><CalendarDays className="h-5 w-5 text-[#2c7a5f]" />{isFilipino ? 'Paparating na outreach' : 'Upcoming outreach'}</h3>
            {outreach.length > 0 ? (
              <ul className="bullet-list grid gap-x-6 text-sm text-[#374151] sm:grid-cols-2">
                {outreach.map((program) => <li key={program.id}><strong>{isFilipino ? program.titleFil : program.title}</strong><span className="mt-1 flex items-start gap-1.5 text-xs text-[#6b7280]"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{program.location}</span></li>)}
              </ul>
            ) : <p className="text-sm text-[#6b7280]">{isFilipino ? 'Wala pang naka-iskedyul na outreach.' : 'No outreach programs are currently scheduled.'}</p>}
            <div className="mt-3 space-y-3 border-t border-[#e7eee9] pt-3 text-xs leading-relaxed text-[#4b5563]">
              <p><strong className="text-[#0f4d3c]">{isFilipino ? 'Duty ng klinika:' : 'Clinic duty:'}</strong> {isFilipino ? 'Lunes-Biyernes, 7:00 AM-4:00 PM.' : 'Monday-Friday, 7:00 AM-4:00 PM.'}</p>
              <p><strong className="text-[#0f4d3c]">{isFilipino ? 'PhilHealth YAKAP:' : 'PhilHealth YAKAP:'}</strong> {isFilipino ? 'Maaaring makatanggap ang kwalipikadong miyembro ng hanggang PHP 20,000 na benepisyo. Maaaring may libreng gamot kung available sa health center.' : 'Eligible members may receive up to PHP 20,000 in benefits. Free medicines may be available at the health center.'}</p>
            </div>
          </section>
        </div>
      </div>

      {viewingImage && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={viewingImage.alt}
          className="fixed inset-0 z-[70] flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-slate-950/90 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-8"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setViewingImage(null); }}
        >
          <button type="button" onClick={() => setViewingImage(null)} aria-label={isFilipino ? 'Isara ang larawan' : 'Close image'} className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <span className="text-xl leading-none">×</span>
          </button>
          <img src={viewingImage.url} alt={viewingImage.alt} className="block h-auto w-auto max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] max-w-[calc(100vw-2rem)] object-contain" />
        </div>,
        document.body,
      )}
    </section>
  );
};
