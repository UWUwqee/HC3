import React from 'react';
import { ContactSection } from './ContactSection';
import { NewsSection } from './NewsSection';
import { OutreachSection } from './OutreachSection';

export const PublicInformation: React.FC = () => (
  <div className="public-information-view">
    <NewsSection />
    <OutreachSection />
    <ContactSection />
  </div>
);