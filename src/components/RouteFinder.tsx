import React from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { CLINIC_ADDRESS } from '../data/masikapClinicInfo';
import { useHealthCenter } from '../context/HealthCenterContext';

export const RouteFinder: React.FC = () => {
  const { language } = useHealthCenter();
  const isFilipino = language === 'fil';

  return (
    <section aria-labelledby="route-finder-title" className="border-b border-[#dce7e1] bg-[#f7faf8] py-8 sm:py-10">
      <div className="mx-auto grid max-w-7xl gap-6 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-12">
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#2c7a5f]">{isFilipino ? 'Lokasyon' : 'Location'}</div>
          <h2 id="route-finder-title" className="text-xl font-bold text-[#0f4d3c] sm:text-2xl">
            {isFilipino ? 'Pumunta sa health center' : 'Find your route to the health center'}
          </h2>
        </div>

        <div className="border-y border-[#dce7e1] py-4">
          <p className="flex items-start gap-3 text-sm leading-relaxed text-[#374151]">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#17645c]" aria-hidden="true" />
            <span>{CLINIC_ADDRESS}</span>
          </p>
          <form action="https://www.google.com/maps/dir/" method="get" target="_blank" className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="api" value="1" />
            <input type="hidden" name="destination" value={CLINIC_ADDRESS} />
            <input type="hidden" name="travelmode" value="transit" />
            <label className="sr-only" htmlFor="route-origin">{isFilipino ? 'Panimulang lokasyon' : 'Starting location'}</label>
            <input
              id="route-origin"
              name="origin"
              type="text"
              placeholder={isFilipino ? 'Ilagay ang panimulang lokasyon' : 'Enter your starting location'}
              className="min-h-11 min-w-0 flex-1 border border-[#cfd8d2] bg-white px-3 text-sm text-[#17312e] outline-none focus:border-[#17645c] focus:ring-2 focus:ring-[#17645c]/15"
            />
            <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#17645c] px-4 text-sm font-bold text-white transition-colors hover:bg-[#104f49]">
              {isFilipino ? 'Kumuha ng direksyon' : 'Get directions'}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};