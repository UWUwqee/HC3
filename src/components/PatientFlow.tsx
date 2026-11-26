import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import patientFlowDiagram from '../assets/images/DIAGRAM xd.png';

export const PatientFlow: React.FC = () => {
  const [imageOpen, setImageOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!imageOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setImageOpen(false);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      triggerRef.current?.focus();
    };
  }, [imageOpen]);

  return (
    <section aria-label="Patient flow and visit information" className="site-section-bg section-enter border-t border-[#dce7e1] py-4 sm:py-5">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <button ref={triggerRef} type="button" onClick={() => setImageOpen(true)} title="View the patient flow diagram" className="mx-auto block max-w-5xl overflow-hidden rounded-sm border border-[#dce7e1] bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17645c]">
          <img
            src={patientFlowDiagram}
            alt="Patient flow diagram with registration, screening, care pathways, consultation, and visit information."
            loading="lazy"
            decoding="async"
            className="max-h-[min(62vh,560px)] h-auto w-full object-contain"
          />
        </button>
      </div>
      {imageOpen && (
        <div role="dialog" aria-modal="true" aria-label="Patient flow diagram" onClick={() => setImageOpen(false)} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
          <button ref={closeRef} type="button" aria-label="Close diagram" onClick={() => setImageOpen(false)} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#17312e] hover:bg-[#eaf3ee]">
            <X className="h-5 w-5" />
          </button>
          <img
            src={patientFlowDiagram}
            alt="Patient flow diagram with registration, screening, care pathways, consultation, and visit information."
            onClick={(event) => event.stopPropagation()}
            className="max-h-[92vh] max-w-[94vw] object-contain"
          />
        </div>
      )}
    </section>
  );
};
