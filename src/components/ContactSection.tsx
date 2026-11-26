import React from 'react';
import { useHealthCenter } from '../context/HealthCenterContext';
import { Clock, MapPin, CalendarDays } from 'lucide-react';
import { CLINIC_ADDRESS, COVERAGE_AREAS } from '../data/masikapClinicInfo';

export const ContactSection: React.FC = () => {
  const { t, language, setBookingModalOpen, appointmentRequestAvailability } = useHealthCenter();
  const bookingEnabled = appointmentRequestAvailability === 'available';
  const bookingLabel = appointmentRequestAvailability === 'pending'
    ? 'Appointment under review'
    : appointmentRequestAvailability === 'confirmed'
      ? 'Accepted appointment active'
    : appointmentRequestAvailability === 'checking'
      ? 'Checking request status'
      : appointmentRequestAvailability === 'error'
        ? 'Unable to check request'
        : 'REQUEST AN APPOINTMENT';

  return (
    <section id="contact" className="py-16 sm:py-20 bg-[#f3f7f4] border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="max-w-2xl mb-10">
          <div className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-3">
            {language === 'fil' ? 'Makipag-ugnayan' : 'Visit or call'}
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-950">
            {t.contactTitle}
          </h2>
          <p className="mt-3 text-base text-slate-600">
            {language === 'fil'
              ? 'Maaaring magpadala ng online appointment request anumang oras, depende sa bakanteng petsa at oras.'
              : 'Submit an appointment request online anytime, subject to available dates and time slots.'}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 border-y border-slate-300 py-7">
          <div className="flex gap-4">
            <CalendarDays className="w-5 h-5 text-teal-800 shrink-0 mt-1" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Online appointment</h3>
              <p className="mt-1 text-sm text-slate-600">{language === 'fil' ? 'Pumili ng serbisyo, petsa, at oras. Available ang online request anumang oras.' : 'Choose a service, date, and time. Online requests are available anytime.'}</p>
              <button disabled={!bookingEnabled} onClick={() => setBookingModalOpen(true)} className="mt-3 min-h-11 px-4 py-2.5 bg-teal-900 text-white text-sm font-bold rounded-md hover:bg-teal-950 disabled:cursor-not-allowed disabled:opacity-50">{bookingLabel}</button>
            </div>
          </div>

          <div className="flex gap-4">
            <MapPin className="w-5 h-5 text-teal-800 shrink-0 mt-1" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Masikap Health Center</h3>
              <p className="mt-1 text-sm text-slate-600">{CLINIC_ADDRESS}</p>
              <p className="mt-1 text-sm text-slate-600">{language === 'fil' ? 'Mga lugar na pinaglilingkuran' : 'Service areas'}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{COVERAGE_AREAS.join(', ')}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <Clock className="w-5 h-5 text-teal-800 shrink-0 mt-1" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">{language === 'fil' ? 'Kawani at mga serbisyo' : 'Staff and services'}</h3>
              <p className="mt-1 text-sm text-slate-600">{language === 'fil' ? 'Duty ng medical staff: 7am-4pm (8 oras).' : 'Medical staff duty: 7am-4pm (8 hours).'}</p>
              <p className="mt-1 text-sm text-slate-600">{language === 'fil' ? 'Konsultasyon, prenatal at postnatal, family planning, at bakuna.' : 'Consultation, prenatal and postnatal care, family planning, and vaccination.'}</p>
              <p className="mt-1 text-sm text-slate-600">{language === 'fil' ? 'Maaaring may libreng gamot kung available sa center.' : 'Medicines may be provided at no cost when available at the center.'}</p>
            </div>
          </div>
        </div>

        <p className="mt-6 border-t border-slate-300 pt-5 text-sm leading-relaxed text-slate-700">
          {language === 'fil'
            ? 'Maaaring maging kwalipikado ang mga miyembro ng PhilHealth sa hanggang PHP 20,000 na benepisyo sa ilalim ng YAKAP.'
            : 'PhilHealth members may be eligible for up to PHP 20,000 in YAKAP benefits.'}
        </p>
      </div>
    </section>
  );
};
