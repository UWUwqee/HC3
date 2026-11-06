import React from 'react';
import { Syringe } from 'lucide-react';
import { useHealthCenter } from '../context/HealthCenterContext';
import checkupImage from '../assets/images/CHECK UP.jpg';
import familyPlanningImage from '../assets/images/FAMILYPLANNING.jpg';
import maternityImage from '../assets/images/MATERNITY.png';

const services = [
  {
    id: 'consultation',
    title: 'Consultation',
    titleFil: 'Konsultasyon',
    image: checkupImage,
    imageAlt: 'A health worker speaking with a patient',
  },
  {
    id: 'maternity',
    title: 'Prenatal and postnatal care',
    titleFil: 'Prenatal at postnatal',
    image: maternityImage,
    imageAlt: 'A pregnant patient receiving care from a health worker',
  },
  {
    id: 'family-planning',
    title: 'Family planning',
    titleFil: 'Family planning',
    image: familyPlanningImage,
    imageAlt: 'Family standing together',
  },
  {
    id: 'vaccination',
    title: 'Vaccination',
    titleFil: 'Bakuna',
    image: null,
    imageAlt: '',
  },
];

export const ServicesSection: React.FC = () => {
  const { language } = useHealthCenter();
  const isFilipino = language === 'fil';

  return (
    <section id="services" aria-labelledby="services-title" className="site-section-bg section-enter border-b border-[#dce7e1] py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="mb-7">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#2c7a5f]">Masikap Health Center</div>
          <h1 id="services-title" className="text-2xl font-bold text-[#0f4d3c] sm:text-3xl">{isFilipino ? 'Mga serbisyo' : 'Services'}</h1>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {services.map((service) => (
            <article key={service.id} className="site-card overflow-hidden">
              {service.image ? (
                <img
                  src={service.image}
                  alt={service.imageAlt}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-[#e8f1ec] text-[#17645c]" aria-hidden="true">
                  <Syringe className="h-12 w-12" strokeWidth={1.5} />
                </div>
              )}
              <h2 className="px-4 py-4 text-base font-bold text-[#0f4d3c]">
                {isFilipino ? service.titleFil : service.title}
              </h2>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};