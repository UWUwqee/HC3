import React, { useMemo, useState } from 'react';
import { formatAppointmentTime } from '../appointmentSchedule';

interface ReportAppointment {
  reference_code: string;
  patient_name: string;
  phone: string;
  email: string;
  zone: string;
  service_name: string;
  preferred_date: string;
  preferred_time: string;
  status: string;
  created_at: string;
}

export const AdminReports: React.FC<{ appointments: ReportAppointment[] }> = ({ appointments }) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState('all');
  const [service, setService] = useState('all');

  const services = useMemo(() => [...new Set(appointments.map((item) => item.service_name))].sort(), [appointments]);
  const filtered = useMemo(() => appointments.filter((item) => (
    (!fromDate || item.preferred_date >= fromDate)
    && (!toDate || item.preferred_date <= toDate)
    && (status === 'all' || item.status === status)
    && (service === 'all' || item.service_name === service)
  )), [appointments, fromDate, toDate, status, service]);

  const pendingCount = filtered.filter((item) => item.status === 'pending').length;
  const acceptedCount = filtered.filter((item) => item.status === 'confirmed').length;
  const completedCount = filtered.filter((item) => item.status === 'completed').length;

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-[#dce7e1] bg-white p-4 shadow-sm sm:p-5">
        <div><h2 className="text-base font-bold">Appointment reports</h2><p className="mt-1 text-xs text-[#66736f]">Filter appointment records by date, status, or service. Export completed patient records from the Completed records section.</p></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-semibold text-[#66736f]">Appointment from<input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className="mt-1 block min-h-11 w-full border border-[#d9e1dc] px-3 text-sm text-[#17312e]" /></label>
          <label className="text-xs font-semibold text-[#66736f]">Appointment to<input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className="mt-1 block min-h-11 w-full border border-[#d9e1dc] px-3 text-sm text-[#17312e]" /></label>
          <label className="text-xs font-semibold text-[#66736f]">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block min-h-11 w-full border border-[#d9e1dc] bg-white px-3 text-sm text-[#17312e]"><option value="all">All statuses</option><option value="pending">Pending</option><option value="confirmed">Accepted</option><option value="completed">Completed</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select></label>
          <label className="text-xs font-semibold text-[#66736f]">Service<select value={service} onChange={(event) => setService(event.target.value)} className="mt-1 block min-h-11 w-full border border-[#d9e1dc] bg-white px-3 text-sm text-[#17312e]"><option value="all">All services</option>{services.map((name) => <option key={name}>{name}</option>)}</select></label>
        </div>
      </div>

      <div aria-label="Filtered appointment summary" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Matching requests', filtered.length],
          ['Awaiting review', pendingCount],
          ['Accepted', acceptedCount],
          ['Completed', completedCount],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-md border border-[#dce7e1] bg-white p-3 shadow-sm sm:p-4"><div className="text-2xl font-bold">{value}</div><div className="mt-1 text-xs text-[#66736f]">{label}</div></div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border border-[#dce7e1] bg-white shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead className="bg-[#f2f6f2] text-[10px] uppercase tracking-wide text-[#66736f]"><tr>{['Appointment date', 'Patient', 'Service', 'Status', 'Reference'].map((heading) => <th key={heading} className="px-3 py-3 font-bold">{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#edf1ee]">
            {filtered.map((item) => <tr key={item.reference_code}><td className="px-3 py-3">{item.preferred_date} · {formatAppointmentTime(item.preferred_time)}</td><td className="px-3 py-3 font-semibold">{item.patient_name}</td><td className="px-3 py-3">{item.service_name}</td><td className="px-3 py-3 capitalize">{item.status}</td><td className="px-3 py-3 font-mono">{item.reference_code}</td></tr>)}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-[#87938c]">No appointment records match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
};
