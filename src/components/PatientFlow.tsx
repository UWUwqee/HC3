import React from 'react';
import { useHealthCenter } from '../context/HealthCenterContext';
import { CLINIC_ADDRESS, COVERAGE_AREAS } from '../data/masikapClinicInfo';

const clinicStaff = [
  { name: 'Jashen D. Gener, MD', role: 'Physician', roleFil: 'Doktor', group: 'Medical' },
  { name: 'Pauline Joy D. Sanchez, RN', role: 'Nurse', roleFil: 'Nars', group: 'Medical' },
  { name: 'Cristy M. Reyes, RM', role: 'Midwife', roleFil: 'Komadrona', group: 'Medical' },
  { name: 'Marilta L. Vargas', role: 'Midwife', roleFil: 'Komadrona', group: 'Medical' },
  { name: 'Jocelyn L. Miguel, RM', role: 'Midwife', roleFil: 'Komadrona', group: 'Medical' },
  { name: 'Madeleine S. Reyes, DMD', role: 'Dentist', roleFil: 'Dentista', group: 'Dental/Doctor' },
];

export const PatientFlow: React.FC = () => {
  const { language } = useHealthCenter();
  const isFilipino = language === 'fil';

  return (
    <section aria-labelledby="patient-flow-title" className="site-section-bg section-enter border-t border-[#dce7e1] py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="mb-7">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#2c7a5f]">Masikap Health Center</div>
          <h2 id="patient-flow-title" className="text-2xl font-bold text-[#0f4d3c] sm:text-3xl">{isFilipino ? 'Klinika at mga serbisyo' : 'Clinic information'}</h2>
          <address className="mt-2 text-sm not-italic text-[#4b5563]">{CLINIC_ADDRESS}</address>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="site-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead className="bg-[#f3f7f4] text-xs font-bold uppercase text-[#374151]">
                  <tr>
                    <th scope="col" className="px-4 py-3">{isFilipino ? 'Pangalan' : 'Name'}</th>
                    <th scope="col" className="px-4 py-3">{isFilipino ? 'Posisyon' : 'Designation'}</th>
                    <th scope="col" className="px-4 py-3">{isFilipino ? 'Duty sa klinika' : 'Clinic duty'}</th>
                    <th scope="col" className="px-4 py-3">{isFilipino ? 'Oras' : 'Clinic hours'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7eee9]">
                  {(['Medical', 'Dental/Doctor'] as const).map((group) => (
                    <React.Fragment key={group}>
                      <tr className="bg-[#f8faf9]">
                        <th scope="rowgroup" colSpan={4} className="px-4 py-2 text-xs font-bold text-[#0f4d3c]">
                          {isFilipino && group === 'Medical' ? 'Medikal' : group}
                        </th>
                      </tr>
                      {clinicStaff.filter((staff) => staff.group === group).map((staff) => (
                        <tr key={staff.name}>
                          <td className="px-4 py-2.5 font-medium text-[#1f2937]">{staff.name}</td>
                          <td className="px-4 py-2.5 text-[#4b5563]">{isFilipino ? staff.roleFil : staff.role}</td>
                          <td className="px-4 py-2.5 text-[#4b5563]">{group === 'Medical' ? '7am-4pm' : 'Not listed'}</td>
                          <td className="px-4 py-2.5 text-[#4b5563]">{group === 'Medical' ? '8h' : 'Not listed'}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="site-card p-5 sm:p-6">
            <h3 className="text-base font-bold text-[#0f4d3c]">{isFilipino ? 'Mga serbisyo' : 'Services offered'}</h3>
            <ul className="mt-3 space-y-2 text-sm text-[#4b5563]">
              <li>{isFilipino ? 'Konsultasyon' : 'Consultation'}</li>
              <li>{isFilipino ? 'Prenatal at postnatal' : 'Prenatal and postnatal care'}</li>
              <li>{isFilipino ? 'Family planning' : 'Family planning'}</li>
              <li>{isFilipino ? 'Bakuna' : 'Vaccination'}</li>
            </ul>
            <p className="mt-5 border-t border-[#e7eee9] pt-4 text-sm leading-relaxed text-[#4b5563]">
              {isFilipino
                ? 'Maaaring maging kwalipikado ang mga miyembro ng PhilHealth sa hanggang PHP 20,000 na benepisyo sa ilalim ng YAKAP. Maaaring may libreng gamot kung available sa center.'
                : 'PhilHealth members may be eligible for up to PHP 20,000 in YAKAP benefits. Medicines may be provided at no cost when available at the center.'}
            </p>
          </aside>
        </div>

        <div className="mt-6 border-t border-[#dce7e1] pt-5">
          <h3 className="text-sm font-bold text-[#0f4d3c]">{isFilipino ? 'Mga lugar na pinaglilingkuran' : 'Service area'}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#4b5563]">{COVERAGE_AREAS.join(', ')}</p>
        </div>
      </div>
    </section>
  );
};
