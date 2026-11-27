import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import { useHealthCenter } from '../context/HealthCenterContext';
import { AlertCircle, CalendarDays, CheckCircle2, Clock, X } from 'lucide-react';
import { COVERAGE_AREAS } from '../data/masikapClinicInfo';
import {
  APPOINTMENT_TIME_SLOTS,
  formatAppointmentTime,
  getAppointmentTimePeriod,
  getEarliestAppointmentDate,
  getLatestAppointmentDate,
  isAppointmentTimeAvailable,
} from '../appointmentSchedule';
import { formatPhilippinePhoneNumber, isValidPhilippinePhoneNumber, normalizePhilippinePhoneNumber } from '../philippinePhone';

interface AppointmentReceipt {
  referenceCode: string;
  status: 'pending' | 'confirmed';
  createdAt: string;
}

interface PublicSlotSetting {
  date: string;
  time: string;
  blocked: boolean;
  capacity?: number;
}

interface PendingAppointmentRequest {
  referenceCode: string;
  preferredDate: string;
  preferredTime: string;
  status: 'pending' | 'confirmed';
}

function appointmentServiceLabel(service: { id: string; title: string; titleFil: string }, isFilipino: boolean) {
  return isFilipino ? service.titleFil : service.title;
}

export const OutreachBookingModal: React.FC = () => {
  const { getToken } = useAuth();
  const {
    t,
    language,
    bookingModalOpen,
    setBookingModalOpen,
    appointmentRequestAvailability,
    markAppointmentRequestStatus,
    selectedProgramForBooking,
    siteContent,
  } = useHealthCenter();
  const services = siteContent.services;
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const formRef = useRef<HTMLFormElement>(null);
  const [serviceId, setServiceId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [houseApartmentNumber, setHouseApartmentNumber] = useState('');
  const [streetName, setStreetName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('');
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [priorityCategories, setPriorityCategories] = useState<string[]>([]);
  const [zone, setZone] = useState(COVERAGE_AREAS[0]);
  const [now, setNow] = useState(() => new Date());
  const [preferredDate, setPreferredDate] = useState(() => getEarliestAppointmentDate());
  const [preferredTime, setPreferredTime] = useState(APPOINTMENT_TIME_SLOTS[0]);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [attendanceConsent, setAttendanceConsent] = useState(false);
  const [arrivalConsent, setArrivalConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const [receipt, setReceipt] = useState<AppointmentReceipt | null>(null);
  const [slotSettings, setSlotSettings] = useState<PublicSlotSetting[]>([]);
  const [unavailableSlots, setUnavailableSlots] = useState<Array<{
    date: string;
    time: string;
    hasRegularBooking: boolean;
    hasPriorityBooking: boolean;
  }>>([]);
  const [pendingRequest, setPendingRequest] = useState<PendingAppointmentRequest | null>(null);
  const [pendingRequestLoaded, setPendingRequestLoaded] = useState(false);
  const hasPrefilledAppointmentDetails = useRef(false);
  const earliestDate = getEarliestAppointmentDate(now);
  const latestDate = getLatestAppointmentDate(now);
  const selectedService = services.find((service) => service.id === serviceId);
  const isAnimalBiteService = selectedService?.category === 'animal_bite';
  const isSenior = age !== '' && Number(age) >= 60;
  const isMinor = age !== '' && Number(age) <= 17;
  const effectivePriorityCategories = Array.from(new Set([
    ...priorityCategories,
    ...(isSenior ? ['senior_citizen'] : []),
    ...(isAnimalBiteService ? ['animal_bite'] : []),
    ...(selectedService?.category === 'maternity' ? ['pregnant_lactating'] : []),
  ]));
  const address = [houseApartmentNumber.trim(), streetName.trim()].filter(Boolean).join(', ');
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
    && (effectivePriorityCategories.length > 0
      ? slot.hasPriorityBooking
      : slot.hasRegularBooking || slot.hasPriorityBooking)
  ));
  const slotUnavailable = dateBlocked || isTimeBlocked(preferredTime) || isTimeTaken(preferredTime)
    || !isAppointmentTimeAvailable(preferredDate, preferredTime, now);

  useEffect(() => {
    if (!bookingModalOpen) return;
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, [bookingModalOpen]);

  useEffect(() => {
    setPreferredDate((current) => current < earliestDate ? earliestDate : current);
  }, [earliestDate]);

  useEffect(() => {
    if (!slotUnavailable) return;
    const nextAvailableTime = APPOINTMENT_TIME_SLOTS.find((time) => (
      !dateBlocked
      && isAppointmentTimeAvailable(preferredDate, time, now)
      && !isTimeBlocked(time)
      && !isTimeTaken(time)
    ));
    if (nextAvailableTime) setPreferredTime(nextAvailableTime);
  }, [slotUnavailable, dateBlocked, preferredDate, preferredTime, now, slotSettings, unavailableSlots]);

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
    if (!bookingModalOpen) {
      setFormStep(1);
      setReceipt(null);
      setError('');
      setPatientName('');
      setPhone('');
      setEmail('');
      setAge('');
      setHouseApartmentNumber('');
      setStreetName('');
      setGuardianName('');
      setGuardianRelationship('');
      setGuardianConsent(false);
      setChiefComplaint('');
      setPriorityCategories([]);
      setZone(COVERAGE_AREAS[0]);
      setPrivacyConsent(false);
      setAttendanceConsent(false);
      setArrivalConsent(false);
      hasPrefilledAppointmentDetails.current = false;
    }
  }, [bookingModalOpen]);

  useEffect(() => {
    if (!bookingModalOpen) {
      setPendingRequestLoaded(false);
      return;
    }
    let active = true;
    const loadAvailability = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Your Clerk session could not be loaded. Please sign in again.');
        const response = await fetch('/api/appointments', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const result = await response.json() as {
          slotSettings?: PublicSlotSetting[];
          unavailableSlots?: Array<{
            date: string; time: string; hasRegularBooking: boolean; hasPriorityBooking: boolean;
          }>;
          profile?: { first_name: string; middle_name: string; surname: string; suffix: string; phone: string } | null;
          appointments?: Array<{
            reference_code: string; preferred_date: string; preferred_time: string; status: string;
            created_at: string; patient_name: string; phone: string; email?: string | null;
            service_id?: string; address?: string | null;
            chief_complaint?: string | null; age?: number | null; guardian_name?: string | null;
            guardian_relationship?: string | null; priority_categories?: string; zone: string;
          }>;
          error?: string;
        };
        if (!response.ok || !Array.isArray(result.slotSettings)) {
          throw new Error(result.error || 'Appointment availability could not be loaded.');
        }
        if (active) {
          setSlotSettings(result.slotSettings);
          setUnavailableSlots(result.unavailableSlots ?? []);
          const activeAppointment = result.appointments?.find((appointment) => ['pending', 'confirmed'].includes(appointment.status.toLowerCase()));
          setPendingRequest(activeAppointment ? {
            referenceCode: activeAppointment.reference_code,
            preferredDate: activeAppointment.preferred_date,
            preferredTime: activeAppointment.preferred_time,
            status: activeAppointment.status.toLowerCase() === 'confirmed' ? 'confirmed' : 'pending',
          } : null);
          if (activeAppointment) markAppointmentRequestStatus(activeAppointment.status.toLowerCase() === 'confirmed' ? 'confirmed' : 'pending');
          else markAppointmentRequestStatus('available');
          if (!hasPrefilledAppointmentDetails.current) {
            const previousAppointment = [...(result.appointments ?? [])]
              .sort((first, second) => second.created_at.localeCompare(first.created_at))[0];
            const profileName = result.profile
              ? [result.profile.first_name, result.profile.middle_name, result.profile.surname, result.profile.suffix].filter(Boolean).join(' ')
              : '';
            if (profileName) setPatientName(profileName);
            else if (previousAppointment?.patient_name) setPatientName(previousAppointment.patient_name);
            if (result.profile?.phone) setPhone(normalizePhilippinePhoneNumber(result.profile.phone));
            else if (previousAppointment?.phone) setPhone(normalizePhilippinePhoneNumber(previousAppointment.phone));
            if (previousAppointment) {
              if (previousAppointment.email) setEmail(previousAppointment.email);
              if (previousAppointment.service_id && services.some((service) => service.id === previousAppointment.service_id)) {
                setServiceId(previousAppointment.service_id);
              }
              const comma = (previousAppointment.address ?? '').indexOf(',');
              setAge(previousAppointment.age == null ? '' : String(previousAppointment.age));
              setHouseApartmentNumber(comma < 0
                ? (previousAppointment.address ?? '').trim()
                : (previousAppointment.address ?? '').slice(0, comma).trim());
              setStreetName(comma < 0 ? '' : (previousAppointment.address ?? '').slice(comma + 1).trim());
              setGuardianName(previousAppointment.guardian_name ?? '');
              setGuardianRelationship(previousAppointment.guardian_relationship ?? '');
              setChiefComplaint(previousAppointment.chief_complaint ?? '');
              setPriorityCategories((previousAppointment.priority_categories ?? '')
                .split(',')
                .filter((category) => ['pwd', 'pregnant_lactating'].includes(category)));
              setZone(previousAppointment.zone || COVERAGE_AREAS[0]);
            }
            hasPrefilledAppointmentDetails.current = true;
          }
          setPendingRequestLoaded(true);
          setAvailabilityError('');
        }
      } catch (caught) {
        if (active) {
          setAvailabilityError(caught instanceof Error ? caught.message : 'Appointment availability could not be loaded.');
          setPendingRequestLoaded(false);
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

  const isFilipino = language === 'fil';
  const canSubmitAppointment = appointmentRequestAvailability === 'available';

  const handleClose = () => setBookingModalOpen(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!pendingRequestLoaded) {
      setError(isFilipino ? 'Sinusuri muna kung may nakabinbing request. Subukan muli sandali.' : 'Checking for a pending request. Please try again in a moment.');
      return;
    }
    if (pendingRequest) return;
    if (!selectedService) {
      setError(isFilipino ? 'Walang available na serbisyo para sa appointment request.' : 'No services are currently available for appointment requests.');
      return;
    }
    if (!canSubmitAppointment) {
      setError(isFilipino ? 'Hindi pa handa ang appointment service. Subukan muli sandali.' : 'Appointment availability is still being checked. Please try again in a moment.');
      return;
    }
    if (!isValidPhilippinePhoneNumber(phone)) {
      setError(isFilipino ? 'Maglagay ng wastong Philippine mobile number na may 10 digit pagkatapos ng +63.' : 'Enter a valid Philippine mobile number with 10 digits after +63.');
      return;
    }
    if (age === '' || !/^\d{1,3}$/.test(age) || Number(age) > 110) {
      setError(isFilipino ? 'Maglagay ng edad mula 0 hanggang 110.' : 'Enter an age from 0 to 110.');
      return;
    }
    if (!houseApartmentNumber.trim() || !streetName.trim()) {
      setError(isFilipino ? 'Ilagay ang house/apartment number at pangalan ng kalye.' : 'Enter the house/apartment number and street name.');
      return;
    }
    if (chiefComplaint.trim().length < 2) {
      setError(isFilipino ? 'Ilarawan ang dahilan ng pagbisita.' : 'Describe your reason for the visit.');
      return;
    }
    if (isMinor && (!guardianName.trim() || !guardianRelationship || !guardianConsent)) {
      setError(isFilipino
        ? 'Kailangan ang detalye at pagdalo ng magulang o guardian para sa pasyenteng 17 taong gulang pababa.'
        : 'Patients aged 17 and younger need a parent or guardian and confirmation that they will attend.');
      return;
    }
    if (!privacyConsent || !attendanceConsent || !arrivalConsent) {
      setError(isFilipino ? 'Kumpirmahin ang lahat ng kinakailangang pahintulot bago magpatuloy.' : 'Confirm all required appointment consents before continuing.');
      return;
    }
    if (slotUnavailable) {
      setError(isFilipino ? 'Hindi available ang napiling petsa o oras. Pumili ng ibang schedule.' : 'The selected date or time is unavailable. Please choose another schedule.');
      return;
    }
    setSubmitting(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Your Clerk session could not be loaded. Please sign in again.');
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientName,
          phone: formatPhilippinePhoneNumber(phone),
          email,
          age: Number(age),
          houseApartmentNumber,
          streetName,
          guardianName: isMinor ? guardianName : '',
          guardianRelationship: isMinor ? guardianRelationship : '',
          guardianConsent: isMinor && guardianConsent,
          chiefComplaint,
          priorityCategories: effectivePriorityCategories.filter((category) => category !== 'animal_bite'),
          zone,
          serviceId,
          preferredDate,
          preferredTime,
          privacyConsent,
          attendanceConsent,
          arrivalConsent,
        }),
      });
      const responseBody = await response.text();
      let result: AppointmentReceipt & {
        error?: string;
        pendingRequest?: PendingAppointmentRequest;
      };
      try {
        result = JSON.parse(responseBody) as AppointmentReceipt & { error?: string };
      } catch {
        throw new Error(isFilipino
          ? 'Pansamantalang hindi magamit ang serbisyo ng appointment. Subukan muli mamaya.'
          : `Appointment service is temporarily unavailable (HTTP ${response.status}). Please try again later.`);
      }
      if (!response.ok) {
        if (response.status === 409 && result.pendingRequest) {
          setPendingRequest(result.pendingRequest);
          setPendingRequestLoaded(true);
          markAppointmentRequestStatus(result.pendingRequest.status);
        }
        const message = response.status === 401
          ? 'Your Clerk sign-in could not be verified. Please sign in again or check the Clerk server key configuration.'
          : result.error || 'Could not submit your appointment request.';
        throw new Error(message);
      }
      setPendingRequest({
        referenceCode: result.referenceCode,
        preferredDate,
        preferredTime,
        status: result.status,
      });
      markAppointmentRequestStatus(result.status);
      setReceipt(result);
      window.dispatchEvent(new CustomEvent('open-appointment-message', {
        detail: { referenceCode: result.referenceCode },
      }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your appointment request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formStep === 1) {
      if (!formRef.current?.reportValidity()) return;
      if (!selectedService) {
        setError(isFilipino ? 'Walang available na serbisyo para sa appointment request.' : 'No services are currently available for appointment requests.');
        return;
      }
      if (isMinor && (!guardianName.trim() || !guardianRelationship || !guardianConsent)) {
        setError(isFilipino
          ? 'Kailangan ang detalye at pagdalo ng magulang o guardian para sa pasyenteng 17 taong gulang pababa.'
          : 'Patients aged 17 and younger need a parent or guardian and confirmation that they will attend.');
        return;
      }
      setError('');
      setFormStep(2);
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
            <h2 id="appointment-title" className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">{receipt ? (isFilipino ? 'Kumpirmado ang appointment' : 'Appointment confirmed') : (isFilipino ? 'Online appointment request' : 'REQUEST AN APPOINTMENT')}</h2>
            {!receipt && <p className="mt-1 text-sm text-slate-600">{isFilipino ? 'Ilagay ang iyong detalye at napiling schedule.' : 'Enter your details and preferred schedule.'}</p>}
          </div>
          <button onClick={handleClose} aria-label="Close appointment form" className="flex h-11 w-11 shrink-0 items-center justify-center text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
        </header>

        {receipt ? (
          <div className="px-5 sm:px-7 py-8" aria-live="polite">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-7 h-7 text-teal-800 shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-slate-950">{isFilipino ? 'Awtomatikong nakumpirma ang iyong appointment.' : 'Your appointment was automatically confirmed.'}</h3>
                <p className="mt-2 text-sm text-slate-600">{isFilipino ? 'Makikita sa appointment messages ang kumpirmasyon at mga detalye ng schedule.' : 'The confirmation and schedule details are available in your appointment messages.'}</p>
                <p className="mt-4 text-sm text-slate-700">{selectedService && appointmentServiceLabel(selectedService, isFilipino)}</p>
                <p className="mt-1 text-sm text-slate-600">{preferredDate} · {formatAppointmentTime(preferredTime)} · {zone}</p>
                <p className="mt-4 text-xs text-slate-500">{isFilipino ? 'Reference number' : 'Request reference'}: <strong className="font-mono text-slate-900">{receipt.referenceCode}</strong></p>
                <button onClick={handleClose} className="mt-6 px-4 py-2.5 bg-teal-900 text-white text-sm font-bold rounded-md hover:bg-teal-950">{isFilipino ? 'Isara' : 'Done'}</button>
              </div>
            </div>
          </div>
        ) : pendingRequest ? (
          <div className="space-y-4 px-4 py-6 sm:px-7 sm:py-8" role="status" aria-live="polite">
            <div className="border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <h3 className="text-base font-bold">{pendingRequest.status === 'confirmed'
                ? (isFilipino ? 'May aktibo ka pang kumpirmadong appointment' : 'You already have an active confirmed appointment')
                : (isFilipino ? 'May request ka pang sinusuri' : 'You already have a request under review')}</h3>
              <p className="mt-2 text-sm leading-relaxed">
                {pendingRequest.status === 'confirmed'
                  ? (isFilipino
                    ? 'Kumpletuhin o kanselahin muna ang appointment na ito bago magpadala ng panibagong request.'
                    : 'Complete or cancel this appointment before submitting another request.')
                  : (isFilipino
                    ? 'Maghintay ng aksyon ng clinic staff bago magpadala ng panibagong appointment request.'
                    : 'Please wait for clinic staff to review this request before sending another appointment request.')}
              </p>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-semibold text-slate-500">{isFilipino ? 'Reference number' : 'Request reference'}</dt><dd className="break-all font-mono font-bold text-slate-900">{pendingRequest.referenceCode}</dd></div>
              <div><dt className="text-xs font-semibold text-slate-500">{isFilipino ? 'Petsa at oras' : 'Preferred schedule'}</dt><dd className="font-semibold text-slate-900">{pendingRequest.preferredDate} · {formatAppointmentTime(pendingRequest.preferredTime)}</dd></div>
            </dl>
            <p className="text-xs text-slate-500">{isFilipino ? 'Awtomatikong susuriin muli ang status habang bukas ang pahinang ito.' : 'This page will automatically check again while it is open.'}</p>
          </div>
        ) : !pendingRequestLoaded ? (
          <p className="px-4 py-8 text-center text-sm text-slate-600 sm:px-7" role="status">
            {availabilityError || (isFilipino
              ? 'Sinusuri ang mga nakabinbing appointment request...'
              : 'Checking for pending appointment requests...')}
          </p>
        ) : (
          <form ref={formRef} onSubmit={handleFormSubmit} className="space-y-5 px-4 py-5 sm:px-7 sm:py-6">
            {appointmentRequestAvailability === 'checking' || appointmentRequestAvailability === 'error' ? (
              <p role="status" className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                {availabilityError || (isFilipino ? 'Tinitingnan ang availability ng appointment...' : 'Checking appointment availability...')}
              </p>
            ) : null}
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

            {formStep === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="appointment-service" className="block text-sm font-semibold text-slate-800 mb-1.5">{isFilipino ? 'Serbisyo' : 'Service'} *</label>
                <select id="appointment-service" required value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700">
                  <option value="" disabled>{isFilipino ? 'Pumili ng serbisyo' : 'Select a service'}</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{appointmentServiceLabel(service, isFilipino)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="appointment-name" className="block text-sm font-semibold text-slate-800 mb-1.5">{t.formFullName} *</label>
                <input id="appointment-name" required minLength={2} maxLength={120} autoComplete="name" value={patientName} onChange={(event) => setPatientName(event.target.value)} className="w-full px-3.5 py-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-700" />
              </div>
              <div>
                <label htmlFor="appointment-phone" className="block text-sm font-semibold text-slate-800 mb-1.5">{t.formPhone} *</label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-700">+63</span>
                  <input id="appointment-phone" required type="tel" inputMode="numeric" autoComplete="tel-national" minLength={10} maxLength={10} pattern="9[0-9]{9}" value={phone} onChange={(event) => setPhone(normalizePhilippinePhoneNumber(event.target.value))} placeholder="9XXXXXXXXX" className="w-full rounded-r-md px-3.5 py-3 border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700" />
                </div>
              </div>
              <div>
                <label htmlFor="appointment-email" className="block text-sm font-semibold text-slate-800 mb-1.5">{t.formEmail}</label>
                <input id="appointment-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="w-full px-3.5 py-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-700" />
              </div>
              <div>
                <label htmlFor="appointment-zone" className="block text-sm font-semibold text-slate-800 mb-1.5">{t.formZone} *</label>
                <select id="appointment-zone" required value={zone} onChange={(event) => setZone(event.target.value)} className="w-full px-3.5 py-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-700">
                  {COVERAGE_AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="appointment-age" className="block text-sm font-semibold text-slate-800 mb-1.5">{isFilipino ? 'Edad' : 'Age'} *</label>
                <input id="appointment-age" required type="number" inputMode="numeric" min={0} max={110} value={age} onChange={(event) => setAge(event.target.value)} className="w-full px-3.5 py-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-700" />
              </div>
              <div>
                <label htmlFor="appointment-house-number" className="block text-sm font-semibold text-slate-800 mb-1.5">{isFilipino ? 'House / apartment number' : 'House / apartment number'} *</label>
                <input id="appointment-house-number" required maxLength={100} value={houseApartmentNumber} onChange={(event) => setHouseApartmentNumber(event.target.value)} className="w-full px-3.5 py-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-700" />
              </div>
              <div>
                <label htmlFor="appointment-street" className="block text-sm font-semibold text-slate-800 mb-1.5">{isFilipino ? 'Street name' : 'Street name'} *</label>
                <input id="appointment-street" required minLength={2} maxLength={150} value={streetName} onChange={(event) => setStreetName(event.target.value)} className="w-full px-3.5 py-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-700" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="appointment-reason" className="block text-sm font-semibold text-slate-800 mb-1.5">{isFilipino ? 'Dahilan ng pagbisita' : 'Reason for visit'} *</label>
                <textarea id="appointment-reason" required minLength={2} maxLength={2000} value={chiefComplaint} onChange={(event) => setChiefComplaint(event.target.value)} rows={3} className="w-full resize-y px-3.5 py-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-700" />
              </div>
              <fieldset className="sm:col-span-2">
                <legend className="mb-2 text-sm font-semibold text-slate-800">{isFilipino ? 'Mga priority category (opsyonal)' : 'Priority categories (optional)'}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ['pwd', 'Person with disability (PWD)'],
                    ['senior_citizen', 'Senior citizen (age 60+)'],
                    ['pregnant_lactating', 'Pregnant or lactating'],
                  ].map(([value, label]) => (
                    <label key={value} className="flex min-h-11 items-center gap-2 border border-slate-200 px-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={value === 'senior_citizen' ? isSenior || priorityCategories.includes(value) : priorityCategories.includes(value)}
                        disabled={value === 'senior_citizen' ? isSenior : value === 'pregnant_lactating' && isSenior}
                        onChange={(event) => setPriorityCategories((current) => event.target.checked
                          ? [...current, value]
                          : current.filter((category) => category !== value))}
                        className="h-4 w-4 accent-teal-800"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {isAnimalBiteService && (
                <p className="sm:col-span-2 border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-950">
                  {isFilipino
                    ? 'May priority ang mga request para sa kagat ng hayop. Makipag-ugnayan agad sa health center para sa pagsusuri.'
                    : 'Animal-bite requests receive priority. Contact the health center promptly for an assessment.'}
                </p>
              )}
              {isMinor && (
                <>
                  <div>
                    <label htmlFor="appointment-guardian" className="block text-sm font-semibold text-slate-800 mb-1.5">{isFilipino ? 'Pangalan ng magulang / guardian' : 'Parent / guardian name'} *</label>
                    <input id="appointment-guardian" required minLength={2} maxLength={120} value={guardianName} onChange={(event) => setGuardianName(event.target.value)} className="w-full px-3.5 py-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-700" />
                  </div>
                  <div>
                    <label htmlFor="appointment-guardian-relationship" className="block text-sm font-semibold text-slate-800 mb-1.5">{isFilipino ? 'Relasyon sa guardian' : 'Guardian relationship'} *</label>
                    <select id="appointment-guardian-relationship" required value={guardianRelationship} onChange={(event) => setGuardianRelationship(event.target.value)} className="w-full px-3.5 py-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-700">
                      <option value="" disabled>{isFilipino ? 'Pumili ng relasyon' : 'Select relationship'}</option>
                      <option value="Parent">Parent</option>
                      <option value="Legal guardian">Legal guardian</option>
                      <option value="Other guardian">Other guardian</option>
                    </select>
                  </div>
                  <label className="sm:col-span-2 flex items-start gap-3 text-sm text-slate-700">
                    <input type="checkbox" required checked={guardianConsent} onChange={(event) => setGuardianConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-800" />
                    <span>{isFilipino ? 'Kukumpirmahin ng magulang o guardian ang detalye at sasamahan ang pasyente.' : 'The parent or guardian confirms these details and will attend with the patient.'}</span>
                  </label>
                </>
              )}
            </div>
            ) : (
            <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="appointment-date" className="block text-sm font-semibold text-slate-800 mb-1.5">{t.formDate} *</label>
                <input id="appointment-date" required type="date" min={earliestDate} max={latestDate} value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} className="w-full px-3.5 py-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-700" />
              </div>
              <div>
                <label htmlFor="appointment-time" className="block text-sm font-semibold text-slate-800 mb-1.5">{t.formTimeSlot} *</label>
                <select id="appointment-time" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} className="w-full px-3.5 py-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-700">
                  {APPOINTMENT_TIME_SLOTS.map((time) => (
                    <option key={time} value={time} disabled={time !== preferredTime && isTimeTaken(time)}>
                      {formatAppointmentTime(time)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {slotUnavailable && <p role="status" className="text-sm font-semibold text-rose-800">{isFilipino ? 'Hindi available ang napiling petsa o oras. Pumili ng ibang schedule.' : 'This date or time slot is unavailable. Choose a different schedule.'}</p>}
            {availabilityError && <p role="status" className="text-xs text-amber-800">{isFilipino ? 'Hindi ma-check ang availability. Susuriin muli ang napiling schedule kapag ipinadala.' : 'Availability could not be checked. The server will verify your selected schedule when you submit.'}</p>}

            <div className="space-y-3 border-t border-slate-200 pt-4">
              <label className="flex items-start gap-3 text-sm text-slate-600">
                <input type="checkbox" required checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-800" />
                <span>{isFilipino
                  ? 'Alinsunod sa Republic Act No. 10173 (Data Privacy Act of 2012), pumapayag akong kolektahin at gamitin ng health center staff ang aking personal at pangkalusugang impormasyon upang suriin at tugunan ang appointment request na ito.'
                  : 'Under Republic Act No. 10173 (the Data Privacy Act of 2012), I consent to health center staff collecting and using my personal and health information to review and respond to this appointment request.'}</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-600">
                <input type="checkbox" required checked={attendanceConsent} onChange={(event) => setAttendanceConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-800" />
                <span>{isFilipino ? 'Nauunawaan kong dapat dumating sa napiling oras o makipag-ugnayan kung hindi makakadalo.' : 'I understand I should attend at the selected time or contact the health center if I cannot.'}</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-600">
                <input type="checkbox" required checked={arrivalConsent} onChange={(event) => setArrivalConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-800" />
                <span>{isFilipino ? 'Kukumpirmahing darating ako 30 minuto bago ang appointment.' : 'I confirm I will arrive 30 minutes before the appointment.'}</span>
              </label>
            </div>
            </>
            )}

            {error && <p role="alert" className="flex items-start gap-2 text-sm text-rose-800"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}</p>}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200 pt-4">
              {formStep === 2 ? (
                <p className="flex items-center gap-2 text-xs text-slate-500"><Clock className="w-4 h-4" />{isFilipino ? 'Awtomatikong makukumpirma ang available na schedule.' : 'Available schedules are automatically confirmed.'}</p>
              ) : <span />}
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end sm:gap-3">
                {formStep === 2 && <button type="button" onClick={() => { setError(''); setFormStep(1); }} className="min-h-11 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto">{isFilipino ? 'Bumalik' : 'Back'}</button>}
                <button type="button" onClick={handleClose} className="min-h-11 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto">{isFilipino ? 'Kanselahin' : 'Cancel'}</button>
                {formStep === 1 ? (
                  <button type="submit" disabled={!canSubmitAppointment || !selectedService} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-900 px-5 py-2.5 text-center text-sm font-bold text-white hover:bg-teal-950 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{isFilipino ? 'Magpatuloy sa iskedyul' : 'Continue to schedule'}</button>
                ) : (
                  <button type="submit" disabled={submitting || !canSubmitAppointment || !selectedService || slotUnavailable || !privacyConsent || !attendanceConsent || !arrivalConsent} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-900 px-5 py-2.5 text-center text-sm font-bold text-white hover:bg-teal-950 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"><CalendarDays className="w-4 h-4 shrink-0" />{submitting ? (isFilipino ? 'Kinukumpirma...' : 'Confirming...') : (isFilipino ? 'Kumpirmahin ang appointment' : 'Confirm appointment')}</button>
                )}
              </div>
            </div>
          </form>
        )}
      </section>
    </div>
  );
};
