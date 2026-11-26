import React, { useEffect, useRef, useState } from 'react';
import { useHealthCenter } from '../context/HealthCenterContext';
import { AlertCircle, CalendarDays, CheckCircle2, Clock, X } from 'lucide-react';
import { useAuth } from '@clerk/react';
import { COVERAGE_AREAS } from '../data/masikapClinicInfo';
import {
  APPOINTMENT_TIME_SLOTS,
  formatAppointmentTime,
  getAppointmentTimePeriod,
  getEarliestAppointmentDate,
  isAppointmentTimeAvailable,
} from '../appointmentSchedule';

interface AppointmentReceipt {
  referenceCode: string;
  status: 'pending' | 'confirmed';
  createdAt: string;
}

interface PublicSlotSetting {
  date: string;
  time: string;
  blocked: boolean;
}

interface UnavailableAppointmentSlot {
  date: string;
  time: string;
  hasRegularBooking: boolean;
  hasPriorityBooking: boolean;
}

interface ActiveAppointment {
  referenceCode: string;
  preferredDate: string;
  preferredTime: string;
  status: 'pending' | 'confirmed';
}

const priorityCategoryOptions = [
  { value: 'pwd', label: 'Person with disability (PWD)', labelFil: 'Taong may kapansanan (PWD)' },
  { value: 'senior_citizen', label: 'Senior citizen', labelFil: 'Nakatatanda' },
  { value: 'pregnant_lactating', label: 'Pregnant or lactating', labelFil: 'Buntis o nagpapasuso' },
] as const;

export const OutreachBookingModal: React.FC = () => {
  const { getToken } = useAuth();
  const {
    t,
    language,
    bookingModalOpen,
    setBookingModalOpen,
    clinicOpen,
    appointmentRequestAvailability,
    markAppointmentRequestStatus,
    selectedProgramForBooking,
    siteContent,
  } = useHealthCenter();
  const services = siteContent.services;
  const [serviceId, setServiceId] = useState('checkup');
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [address, setAddress] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [priorityCategories, setPriorityCategories] = useState<string[]>([]);
  const [zone, setZone] = useState(COVERAGE_AREAS[0] ?? '');
  const [now, setNow] = useState(() => new Date());
  const [preferredDate, setPreferredDate] = useState(() => getEarliestAppointmentDate());
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [attendanceConsent, setAttendanceConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const [receipt, setReceipt] = useState<AppointmentReceipt | null>(null);
  const [slotSettings, setSlotSettings] = useState<PublicSlotSetting[]>([]);
  const [unavailableSlots, setUnavailableSlots] = useState<UnavailableAppointmentSlot[]>([]);
  const [activeAppointment, setActiveAppointment] = useState<ActiveAppointment | null>(null);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const formRef = useRef<HTMLFormElement>(null);
  const isFilipino = language === 'fil';
  const earliestDate = getEarliestAppointmentDate(now);
  const canSubmitAppointment = appointmentRequestAvailability === 'available';
  const selectedService = services.find((service) => service.id === serviceId);
  const dateBlocked = slotSettings.some((setting) => setting.date === preferredDate && setting.time === 'all_day' && setting.blocked);
  const isTimeBlocked = (time: string) => {
    const period = getAppointmentTimePeriod(time);
    return slotSettings.some((setting) => setting.date === preferredDate
      && setting.blocked
      && (setting.time === time || setting.time === period));
  };
  const isTimeTaken = (time: string) => unavailableSlots.some((slot) => (
    slot.date === preferredDate
    && slot.time === time
    && (priorityCategories.length > 0
      ? slot.hasPriorityBooking
      : slot.hasRegularBooking || slot.hasPriorityBooking)
  ));
  const slotUnavailable = dateBlocked
    || !isAppointmentTimeAvailable(preferredDate, preferredTime, now)
    || isTimeBlocked(preferredTime)
    || isTimeTaken(preferredTime);

  useEffect(() => {
    if (!bookingModalOpen) return;
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, [bookingModalOpen]);

  useEffect(() => {
    setPreferredDate((current) => current < earliestDate ? earliestDate : current);
  }, [earliestDate]);

  useEffect(() => {
    if (!dateBlocked
      && isAppointmentTimeAvailable(preferredDate, preferredTime, now)
      && !isTimeBlocked(preferredTime)
      && !isTimeTaken(preferredTime)) return;
    const nextAvailableTime = APPOINTMENT_TIME_SLOTS.find((time) => (
      !dateBlocked
      && isAppointmentTimeAvailable(preferredDate, time, now)
      && !isTimeBlocked(time)
      && !isTimeTaken(time)
    ));
    if (nextAvailableTime) setPreferredTime(nextAvailableTime);
  }, [dateBlocked, preferredDate, preferredTime, now, slotSettings, unavailableSlots, priorityCategories]);

  useEffect(() => {
    if (selectedProgramForBooking && services.some((service) => service.id === selectedProgramForBooking)) {
      setServiceId(selectedProgramForBooking);
    }
  }, [selectedProgramForBooking, services]);

  useEffect(() => {
    if (services.length > 0 && !services.some((service) => service.id === serviceId)) {
      setServiceId(services[0].id);
    }
  }, [services, serviceId]);

  useEffect(() => {
    const isMaternityService = services.find((service) => service.id === serviceId)?.category === 'maternity';
    if (isMaternityService) {
      setPriorityCategories((current) => current.includes('pregnant_lactating')
        ? current
        : [...current, 'pregnant_lactating']);
    }
  }, [serviceId, services]);

  useEffect(() => {
    if (!bookingModalOpen) {
      setReceipt(null);
      setError('');
      setPatientName('');
      setPhone('');
      setAge('');
      setAddress('');
      setChiefComplaint('');
      setPriorityCategories([]);
      setPrivacyConsent(false);
      setAttendanceConsent(false);
      setFormStep(1);
    }
  }, [bookingModalOpen]);

  useEffect(() => {
    if (!bookingModalOpen) {
      setAvailabilityLoaded(false);
      return;
    }
    let active = true;
    const loadAvailability = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Sign in to view appointment availability.');
        const response = await fetch('/api/appointments', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const result = await response.json() as {
          slotSettings?: PublicSlotSetting[];
          unavailableSlots?: UnavailableAppointmentSlot[];
          appointments?: Array<{ reference_code: string; preferred_date: string; preferred_time: string; status: string }>;
          error?: string;
        };
        if (!response.ok || !Array.isArray(result.slotSettings) || !Array.isArray(result.unavailableSlots)) {
          throw new Error(result.error || 'Appointment availability could not be loaded.');
        }
        if (!active) return;
        setSlotSettings(result.slotSettings);
        setUnavailableSlots(result.unavailableSlots);
        const current = result.appointments?.find((appointment) => ['pending', 'confirmed'].includes(appointment.status.toLowerCase()));
        const status = current?.status.toLowerCase() === 'confirmed' ? 'confirmed' : 'pending';
        setActiveAppointment(current ? {
          referenceCode: current.reference_code,
          preferredDate: current.preferred_date,
          preferredTime: current.preferred_time,
          status,
        } : null);
        if (current) markAppointmentRequestStatus(status);
        setAvailabilityLoaded(true);
        setAvailabilityError('');
      } catch (caught) {
        if (active) {
          setAvailabilityError(caught instanceof Error ? caught.message : 'Appointment availability could not be loaded.');
          setAvailabilityLoaded(false);
        }
      }
    };
    void loadAvailability();
    const timer = window.setInterval(() => void loadAvailability(), 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [bookingModalOpen, getToken, markAppointmentRequestStatus]);

  if (!bookingModalOpen) return null;

  const handleClose = () => setBookingModalOpen(false);

  const handleContinueToSchedule = () => {
    if (!attendanceConsent) {
      setError(isFilipino ? 'Basahin at tanggapin ang paalala bago magpatuloy.' : 'Acknowledge the attendance reminder before continuing.');
      return;
    }
    if (formRef.current?.reportValidity()) {
      setError('');
      setFormStep(2);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!availabilityLoaded) {
      setError(isFilipino ? 'Sinusuri muna ang availability. Subukan muli sandali.' : 'Appointment availability is still being checked. Please try again shortly.');
      return;
    }
    if (activeAppointment) return;
    if (!selectedService) {
      setError(isFilipino ? 'Walang available na serbisyo para sa appointment request.' : 'No services are currently available for appointment requests.');
      return;
    }
    if (!canSubmitAppointment) {
      setError(appointmentRequestAvailability === 'error'
        ? (isFilipino ? 'Hindi masuri ang availability ng appointment. Subukan muli.' : 'Appointment availability could not be checked. Please try again.')
        : (isFilipino ? 'Tinitingnan ang availability ng appointment...' : 'Checking appointment availability.'));
      return;
    }
    if (slotUnavailable) {
      setError(isFilipino ? 'Hindi available ang napiling petsa o oras. Pumili ng ibang schedule.' : 'The selected date or time is unavailable. Please choose another schedule.');
      return;
    }
    setSubmitting(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in to submit an appointment.');
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientName,
          phone,
          age: Number(age),
          address,
          chiefComplaint,
          priorityCategories,
          zone,
          serviceId,
          preferredDate,
          preferredTime,
          privacyConsent,
          attendanceConsent,
        }),
      });
      const responseBody = await response.text();
      let result: AppointmentReceipt & { error?: string; activeAppointment?: ActiveAppointment };
      try {
        result = JSON.parse(responseBody) as AppointmentReceipt & { error?: string; activeAppointment?: ActiveAppointment };
      } catch {
        throw new Error(isFilipino
          ? 'Pansamantalang hindi magamit ang serbisyo ng appointment. Subukan muli mamaya.'
          : `Appointment service is temporarily unavailable (HTTP ${response.status}). Please try again later.`);
      }
      if (!response.ok) {
        if (response.status === 409 && result.activeAppointment) {
          setActiveAppointment(result.activeAppointment);
          setAvailabilityLoaded(true);
          markAppointmentRequestStatus(result.activeAppointment.status);
        }
        const message = response.status === 401
          ? 'Your sign-in could not be verified. Check the Clerk environment variables, then redeploy.'
          : result.error || 'Could not submit your appointment request.';
        throw new Error(message);
      }
      setActiveAppointment({
        referenceCode: result.referenceCode,
        preferredDate,
        preferredTime,
        status: result.status,
      });
      markAppointmentRequestStatus(result.status);
      setReceipt(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit your appointment request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (formStep === 1) {
      event.preventDefault();
      handleContinueToSchedule();
      return;
    }
    void handleSubmit(event);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) handleClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="appointment-title" className="my-0 max-h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-2xl overflow-y-auto bg-white shadow-2xl sm:my-5 sm:max-h-[92vh]">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:gap-5 sm:px-7 sm:py-5">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-teal-800">Masikap Health Center</div>
            <h2 id="appointment-title" className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">
              {receipt
                ? (receipt.status === 'confirmed'
                  ? (isFilipino ? 'Kumpirmado ang appointment' : 'Appointment confirmed')
                  : (isFilipino ? 'Natanggap ang request' : 'Request received'))
                : (isFilipino ? 'Online appointment request' : 'Request an appointment')}
            </h2>
          </div>
          <button type="button" onClick={handleClose} aria-label={isFilipino ? 'Isara ang appointment form' : 'Close appointment form'} className="flex h-11 w-11 shrink-0 items-center justify-center text-slate-500 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </header>

        {receipt ? (
          <div className="px-5 py-8 sm:px-7" aria-live="polite">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-7 w-7 shrink-0 text-teal-800" />
              <div>
                <h3 className="text-lg font-bold text-slate-950">
                  {receipt.status === 'confirmed'
                    ? (isFilipino ? 'Kumpirmado na ang iyong appointment.' : 'Your appointment has been confirmed.')
                    : (isFilipino ? 'Nakatala ang iyong appointment request.' : 'Your appointment request is recorded.')}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {receipt.status === 'confirmed'
                    ? (isFilipino ? 'Makikita mo ang kumpirmasyon at iskedyul sa appointment messages.' : 'Your confirmation and schedule are available in appointment messages.')
                    : (isFilipino ? 'Makikipag-ugnayan ang kawani ng klinika tungkol sa iyong request.' : 'Clinic staff will contact you about your request.')}
                </p>
                <p className="mt-4 text-sm text-slate-700">{selectedService?.title}</p>
                <p className="mt-1 text-sm text-slate-600">{preferredDate} · {formatAppointmentTime(preferredTime)} · {zone}</p>
                <p className="mt-4 text-xs text-slate-500">{isFilipino ? 'Reference number' : 'Appointment reference'}: <strong className="font-mono text-slate-900">{receipt.referenceCode}</strong></p>
                <button type="button" onClick={handleClose} className="mt-6 min-h-11 rounded-md bg-teal-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-950">{isFilipino ? 'Isara' : 'Done'}</button>
              </div>
            </div>
          </div>
        ) : activeAppointment ? (
          <div className="space-y-4 px-4 py-6 sm:px-7 sm:py-8" role="status" aria-live="polite">
            <div className="border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <h3 className="text-base font-bold">
                {activeAppointment.status === 'confirmed'
                  ? (isFilipino ? 'May aktibo ka pang kumpirmadong appointment' : 'You already have an active accepted appointment')
                  : (isFilipino ? 'May request ka pang sinusuri' : 'You already have a request under review')}
              </h3>
              <p className="mt-2 text-sm leading-relaxed">
                {activeAppointment.status === 'confirmed'
                  ? (isFilipino ? 'Kumpletuhin o kanselahin muna ito bago humiling muli.' : 'Complete or cancel this appointment before submitting another request.')
                  : (isFilipino ? 'Hintayin ang pagsusuri ng kawani bago magpadala ng panibagong request.' : 'Wait for clinic staff to review this request before submitting another.')}
              </p>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-semibold text-slate-500">{isFilipino ? 'Reference number' : 'Appointment reference'}</dt><dd className="break-all font-mono font-bold text-slate-900">{activeAppointment.referenceCode}</dd></div>
              <div><dt className="text-xs font-semibold text-slate-500">{isFilipino ? 'Petsa at oras' : 'Appointment time'}</dt><dd className="font-semibold text-slate-900">{activeAppointment.preferredDate} · {formatAppointmentTime(activeAppointment.preferredTime)}</dd></div>
            </dl>
          </div>
        ) : !availabilityLoaded ? (
          <p className="px-4 py-8 text-center text-sm text-slate-600 sm:px-7" role={availabilityError ? 'alert' : 'status'}>
            {availabilityError || (isFilipino ? 'Sinusuri ang availability ng appointment...' : 'Checking appointment availability...')}
          </p>
        ) : (
          <form ref={formRef} onSubmit={handleFormSubmit} className="space-y-5 px-4 py-5 sm:px-7 sm:py-6">
            <div aria-label={isFilipino ? 'Hakbang sa appointment' : 'Appointment request steps'} className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>{isFilipino ? `Hakbang ${formStep} ng 2` : `Step ${formStep} of 2`}</span>
                <span>{formStep === 1
                  ? (isFilipino ? 'Impormasyon ng pasyente' : 'Patient details')
                  : (isFilipino ? 'Iskedyul at pahintulot' : 'Schedule and consent')}</span>
              </div>
              <div role="progressbar" aria-valuemin={1} aria-valuemax={2} aria-valuenow={formStep} aria-label={isFilipino ? 'Pag-usad ng form' : 'Form progress'} className="h-1.5 overflow-hidden bg-slate-100">
                <div className={`h-full bg-teal-800 transition-all ${formStep === 1 ? 'w-1/2' : 'w-full'}`} />
              </div>
            </div>

            {clinicOpen !== true && (
              <p role="status" className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                {clinicOpen === false
                  ? (isFilipino ? 'Sarado ang center para sa personal na serbisyo ngayon. Maaari pa ring mag-request ng online appointment.' : 'The center is closed for in-person services now. You can still request an appointment online.')
                  : (isFilipino ? 'Tinitingnan ang oras ng serbisyo ng center.' : 'Checking the center’s in-person service hours.')}
              </p>
            )}

            {formStep === 1 ? (
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="appointment-service" className="mb-1 block text-sm font-semibold text-slate-800">{isFilipino ? 'Serbisyo' : 'Service'} *</label>
                  <select id="appointment-service" required value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700">
                    {services.map((service) => <option key={service.id} value={service.id}>{isFilipino ? service.titleFil : service.title}</option>)}
                  </select>
                  {services.length === 0 && <p role="status" className="mt-2 text-xs text-amber-800">{isFilipino ? 'Walang nailathalang serbisyo para sa appointment request.' : 'There are no published services available for appointment requests.'}</p>}
                </div>
                <div>
                  <label htmlFor="appointment-name" className="mb-1 block text-sm font-semibold text-slate-800">{t.formFullName} *</label>
                  <input id="appointment-name" required minLength={2} maxLength={120} autoComplete="name" value={patientName} onChange={(event) => setPatientName(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700" />
                </div>
                <div>
                  <label htmlFor="appointment-phone" className="mb-1 block text-sm font-semibold text-slate-800">{t.formPhone} *</label>
                  <input id="appointment-phone" required type="tel" inputMode="tel" autoComplete="tel" minLength={7} maxLength={32} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09XX XXX XXXX" className="min-h-12 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700" />
                </div>
                <div>
                  <label htmlFor="appointment-zone" className="mb-1 block text-sm font-semibold text-slate-800">{t.formZone} *</label>
                  <select id="appointment-zone" required value={zone} onChange={(event) => setZone(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700">
                    {COVERAGE_AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="appointment-address" className="mb-1 block text-sm font-semibold text-slate-800">{isFilipino ? 'Tirahan' : 'Home address'} *</label>
                  <input id="appointment-address" required minLength={5} maxLength={250} autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700" />
                </div>
                <div>
                  <label htmlFor="appointment-age" className="mb-1 block text-sm font-semibold text-slate-800">{isFilipino ? 'Edad' : 'Age'} *</label>
                  <input id="appointment-age" required type="number" min={0} max={120} step={1} inputMode="numeric" value={age} onChange={(event) => {
                    const nextAge = event.target.value;
                    const qualifiesAsSenior = nextAge !== '' && Number(nextAge) >= 60;
                    setAge(nextAge);
                    setPriorityCategories((current) => qualifiesAsSenior
                      ? current.includes('senior_citizen') ? current : [...current, 'senior_citizen']
                      : current.filter((category) => category !== 'senior_citizen'));
                  }} className="min-h-12 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700" />
                </div>
                <fieldset className="rounded-md border border-slate-300 p-3 sm:col-span-2">
                  <legend className="px-1 text-sm font-semibold text-slate-800">{isFilipino ? 'Priority category (opsyonal; piliin lahat ng naaangkop)' : 'Priority category (optional; select all that apply)'}</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {priorityCategoryOptions.map(({ value, label, labelFil }) => (
                      <label key={value} className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={value === 'senior_citizen' ? Number(age) >= 60 : priorityCategories.includes(value)}
                          disabled={value === 'senior_citizen' && (!age || Number(age) < 60)}
                          onChange={(event) => {
                            if (value === 'senior_citizen') return;
                            setPriorityCategories((current) => event.target.checked
                              ? [...current, value]
                              : current.filter((category) => category !== value));
                          }}
                          className="h-4 w-4 shrink-0 accent-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        {isFilipino ? labelFil : label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="sm:col-span-2">
                  <label htmlFor="appointment-chief-complaint" className="mb-1 block text-sm font-semibold text-slate-800">{isFilipino ? 'Alalahaning pangkalusugan' : 'Health concern'} *</label>
                  <textarea id="appointment-chief-complaint" required minLength={2} maxLength={2000} rows={4} value={chiefComplaint} onChange={(event) => setChiefComplaint(event.target.value)} placeholder={isFilipino ? 'Ilarawan nang maikli ang iyong alalahanin o serbisyong kailangan.' : 'Briefly describe your concern or the service you need.'} className="w-full resize-y rounded-md border border-slate-300 px-3.5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-700" />
                </div>
                <label className="flex items-start gap-3 border border-amber-300 bg-amber-50 p-3 text-sm leading-relaxed text-amber-950 sm:col-span-2">
                  <input type="checkbox" required checked={attendanceConsent} onChange={(event) => setAttendanceConsent(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-teal-800" />
                  <span>{isFilipino
                    ? 'Nauunawaan kong dapat akong dumating sa takdang oras at makipag-ugnayan sa health center kung kailangan kong magkansela o magpalit ng iskedyul.'
                    : 'I understand that I should arrive on time and contact the health center if I need to cancel or change my appointment.'}</span>
                </label>
                <button type="submit" disabled={!attendanceConsent || !canSubmitAppointment || !selectedService} className="min-h-12 w-full rounded-sm bg-[#0f4d3c] px-4 py-3 text-base font-bold text-white hover:bg-[#2c7a5f] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2">
                  {isFilipino ? 'Magpatuloy sa schedule' : 'Continue to schedule'}
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div>
                  <label htmlFor="appointment-date" className="mb-1 block text-sm font-semibold text-slate-800">{t.formDate} *</label>
                  <input id="appointment-date" required type="date" min={earliestDate} value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700" />
                </div>
                <div>
                  <label htmlFor="appointment-time" className="mb-1 block text-sm font-semibold text-slate-800">{isFilipino ? 'Oras ng appointment' : 'Appointment time'} *</label>
                  <select id="appointment-time" required value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} className="min-h-12 w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-teal-700">
                    {APPOINTMENT_TIME_SLOTS.map((time) => {
                      const unavailable = !isAppointmentTimeAvailable(preferredDate, time, now)
                        || isTimeBlocked(time)
                        || isTimeTaken(time)
                        || dateBlocked;
                      return <option key={time} value={time} disabled={unavailable}>{formatAppointmentTime(time)}{unavailable ? (isFilipino ? ' · Hindi available' : ' · Unavailable') : ''}</option>;
                    })}
                  </select>
                </div>
                <label className="flex items-start gap-3 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-600 sm:col-span-2">
                  <input type="checkbox" required checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-teal-800" />
                  <span>{isFilipino
                    ? 'Pumapayag akong gamitin ng kawani ng health center ang aking personal at pangkalusugang impormasyon, kabilang ang detalye ng appointment at dahilan ng pagbisita, upang tugunan ang request na ito.'
                    : 'I agree that health center staff may use my personal and health information, including appointment details and reason for visit, to respond to this request.'}</span>
                </label>
              </div>
            )}

            {slotUnavailable && formStep === 2 && <p role="status" className="text-sm font-semibold text-rose-800">{isFilipino ? 'Hindi available ang napiling petsa o oras. Pumili ng ibang schedule.' : 'This date or time is unavailable or already booked. Choose another schedule.'}</p>}
            {availabilityError && <p role="status" className="text-xs text-amber-800">{isFilipino ? 'Hindi ma-check ang availability. Susuriin muli ng server ang iskedyul kapag ipinadala.' : 'Availability could not be checked. The server will verify your selected time when submitted.'}</p>}
            {error && <p role="alert" className="flex items-start gap-2 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

            {formStep === 2 && (
              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setError(''); setFormStep(1); }} className="min-h-11 flex-1 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:flex-none">{isFilipino ? 'Bumalik' : 'Back'}</button>
                  <button type="button" onClick={handleClose} className="min-h-11 flex-1 rounded-md px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:flex-none">{isFilipino ? 'Kanselahin' : 'Cancel'}</button>
                </div>
                <button type="submit" disabled={submitting || slotUnavailable || !canSubmitAppointment || !selectedService || !privacyConsent || !attendanceConsent} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-[#0f4d3c] px-5 py-2.5 text-base font-bold text-white hover:bg-[#2c7a5f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
                  <CalendarDays className="h-4 w-4" />{submitting ? (isFilipino ? 'Ipinapadala...' : 'Sending...') : (isFilipino ? 'Ipadala ang request' : 'Send appointment request')}
                </button>
              </div>
            )}
          </form>
        )}
      </section>
    </div>
  );
};
