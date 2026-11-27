import React, { useEffect, useState } from 'react';
import { CalendarDays, Clock3, MapPin } from 'lucide-react';
import { useHealthCenter } from '../context/HealthCenterContext';
import { CLINIC_ADDRESS } from '../data/masikapClinicInfo';
import { formatAppointmentTime, getAppointmentTimeMinutes } from '../appointmentSchedule';

interface ScheduleSlot {
  date: string;
  time: string;
  bookedCount: number;
  services?: Array<{ id: string; name: string }>;
}

interface PriorityScheduleSlot {
  date: string;
  time: string;
  priorityCount: number;
  services?: Array<{ id: string; name: string }>;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(`${value}T12:00:00+08:00`));
}

export const AppointmentSchedule: React.FC = () => {
  const { language, siteContent } = useHealthCenter();
  const isFilipino = language === 'fil';
  const settings = siteContent.settings;
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [prioritySlots, setPrioritySlots] = useState<PriorityScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    const loadSchedule = () => {
    const controller = new AbortController();
    void fetch('/api/appointments', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Schedule unavailable');
        return response.json() as Promise<{ slots: ScheduleSlot[]; prioritySlots?: PriorityScheduleSlot[] }>;
      })
      .then((data) => {
        setSlots(data.slots);
        setPrioritySlots(data.prioritySlots ?? []);
        setError('');
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setError(isFilipino ? 'Hindi ma-load ang iskedyul.' : 'Schedule could not be loaded.');
      })
      .finally(() => setLoading(false));
    return controller;
    };
    let controller = loadSchedule();
    const timer = window.setInterval(() => {
      controller.abort();
      controller = loadSchedule();
    }, 3000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [isFilipino]);

  const timeLabels: Record<string, string> = {
    morning: isFilipino ? 'Umaga' : 'Morning',
    afternoon: isFilipino ? 'Hapon' : 'Afternoon',
    'no preference': isFilipino ? 'Anumang oras' : 'Any time',
  };
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const priorityCountBySlot = new Map(prioritySlots.map((slot) => [`${slot.date}:${slot.time}`, slot.priorityCount]));
  const regularSlots = slots
    .map((slot) => ({
      ...slot,
      bookedCount: Math.max(0, slot.bookedCount - (priorityCountBySlot.get(`${slot.date}:${slot.time}`) ?? 0)),
      priority: false,
    }))
    .filter((slot) => slot.bookedCount > 0 && slot.date >= today && (!dateFilter || slot.date === dateFilter));
  const upcomingPrioritySlots = prioritySlots
    .filter((slot) => slot.priorityCount > 0 && slot.date >= today && (!dateFilter || slot.date === dateFilter))
    .map((slot) => ({ ...slot, bookedCount: slot.priorityCount, priority: true }));
  const displaySlots = [...upcomingPrioritySlots, ...regularSlots]
    .sort((first, second) => first.date.localeCompare(second.date)
      || (getAppointmentTimeMinutes(first.time) ?? 1440) - (getAppointmentTimeMinutes(second.time) ?? 1440)
      || Number(second.priority) - Number(first.priority));

  return (
    <section id="appointment-schedule" className="site-section-bg section-enter border-b border-[#dce7e1] py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="breadcrumb">Home <span aria-hidden="true">/</span> <span className="font-semibold text-[#0f4d3c]">Schedule</span></div>
        <div className="mb-7">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#2c7a5f]">
              <CalendarDays className="h-4 w-4" />
              {isFilipino ? 'Mga kumpirmadong appointment' : 'Accepted appointments'}
            </div>
            <h2 className="text-2xl font-bold text-[#0f4d3c] sm:text-3xl">
              {isFilipino ? 'Mga petsa at oras' : 'Dates and Time Slots'}
            </h2>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-3">
          <label htmlFor="schedule-date-filter" className="text-sm font-semibold text-[#52635b]">
            {isFilipino ? 'I-filter ayon sa petsa' : 'Filter by date'}
            <input id="schedule-date-filter" type="date" min={today} value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="mt-1 block min-h-11 border border-[#d9e1dc] bg-white px-3 text-sm text-[#17312e]" />
          </label>
          {dateFilter && <button type="button" onClick={() => setDateFilter('')} className="min-h-11 px-3 text-sm font-semibold text-[#17645c] hover:bg-[#eaf3ee]">{isFilipino ? 'Ipakita lahat ng petsa' : 'Show all dates'}</button>}
        </div>

        {loading || error || displaySlots.length === 0 ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
            <div className="site-card flex flex-col items-start p-6 sm:p-8">
              <CalendarDays className="h-8 w-8 text-[#2c7a5f]" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-bold text-[#0f4d3c]">{isFilipino ? 'Iskedyul ng appointment' : 'Appointment schedule'}</h3>
              <p role={error ? 'alert' : 'status'} className={`mt-2 max-w-xl text-sm leading-relaxed ${error ? 'text-rose-800' : 'text-[#6b7280]'}`}>
                {error || (loading
                  ? (isFilipino ? 'Nilo-load ang mga kumpirmadong appointment...' : 'Loading accepted appointments...')
                    : (isFilipino ? 'Lalabas dito ang mga kumpirmadong oras ng appointment.' : 'Confirmed appointment times will appear here.'))}
              </p>
            </div>
            <aside className="site-card p-5 sm:p-6">
              <h3 className="text-sm font-bold text-[#0f4d3c]">{isFilipino ? 'Mabilisang impormasyon' : 'Quick information'}</h3>
              <dl className="mt-4 space-y-4 text-sm">
                <div><dt className="flex items-center gap-2 font-semibold text-[#374151]"><Clock3 className="h-4 w-4 text-[#2c7a5f]" />{isFilipino ? 'Oras ng klinika' : 'Clinic hours'}</dt><dd className="mt-1 pl-6 text-[#6b7280]">{isFilipino ? settings.clinicHoursFil : settings.clinicHours}</dd></div>
                <div><dt className="flex items-center gap-2 font-semibold text-[#374151]"><MapPin className="h-4 w-4 text-[#2c7a5f]" />{isFilipino ? 'Lokasyon' : 'Location'}</dt><dd className="mt-1 pl-6 text-[#6b7280]">{CLINIC_ADDRESS}</dd></div>
              </dl>
            </aside>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {displaySlots.map((slot) => (
                  <article key={`${slot.date}-${slot.time}-${slot.priority ? 'priority' : 'regular'}`} className={`site-card p-5 transition-colors hover:border-[#9bbdad] ${slot.priority ? 'border-amber-300 bg-amber-50/50' : ''}`}>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#2c7a5f]">{slot.date}</p>
                    <h3 className="mt-1 text-sm font-bold text-[#0f4d3c]">{dateLabel(slot.date)}</h3>
                    {slot.priority && <p className="mt-2 text-xs font-bold uppercase tracking-wide text-amber-800">{isFilipino ? 'Appointment na may prayoridad' : 'Priority appointment'}</p>}
                    <div className="mt-5 flex items-center gap-2 border-t border-[#e7eee9] pt-4">
                      <Clock3 className="h-5 w-5 shrink-0 text-[#2c7a5f]" />
                      <span className="text-base font-bold text-[#0f4d3c]">{timeLabels[slot.time] ?? formatAppointmentTime(slot.time)}</span>
                    </div>
                    {slot.services && slot.services.length > 0 && (
                      <p className="mt-3 text-xs leading-relaxed text-[#52635b]">
                        <strong>{isFilipino ? 'Serbisyo:' : 'Services:'}</strong> {slot.services.map((service) => service.name).join(', ')}
                      </p>
                    )}
                    <p className="mt-3 text-sm text-[#6b7280]">
                      <strong className="text-[#374151]">{slot.bookedCount}</strong> {isFilipino ? 'appointment na naaprubahan' : `accepted ${slot.bookedCount === 1 ? 'appointment' : 'appointments'}`}
                    </p>
                  </article>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-start gap-x-8 gap-y-3 border-t border-[#dce7e1] pt-4 text-xs text-[#6b7280]">
              <span className="flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4 text-[#2c7a5f]" />{isFilipino ? settings.clinicHoursFil : settings.clinicHours}</span>
              <span className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-[#2c7a5f]" />{CLINIC_ADDRESS}</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
