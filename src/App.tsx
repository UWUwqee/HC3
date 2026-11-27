import React, { useEffect, useRef, useState } from 'react';
import { useAuth, useUser } from '@clerk/react';
import { HealthCenterProvider, useHealthCenter } from './context/HealthCenterContext';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { RouteFinder } from './components/RouteFinder';
import { ServicesSection } from './components/ServicesSection';
import { PublicInformation } from './components/PublicInformation';
import { AppointmentSchedule } from './components/AppointmentSchedule';
import { Footer } from './components/Footer';
import { OutreachBookingModal } from './components/OutreachBookingModal';
import { CheckCircle2, MessageCircleMore } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { AdminPanel } from './components/AdminPanel';
import { UserAppointmentChat } from './components/UserAppointmentChat';
import { PatientFlow } from './components/PatientFlow';
import { AccessibilityProvider } from './context/AccessibilityContext';

const AppContent: React.FC = () => {
  const {
    activeSection,
    notificationToast,
    setNotificationToast,
    appointmentRequestAvailability,
    language,
    isSignedIn,
    authModalOpen,
    setAuthModalOpen,
    setMessagesOpen,
    unreadAdminMessageCount,
    unreadMessagesError,
  } = useHealthCenter();

  useEffect(() => {
    const handleStatusChange = (event: Event) => {
      const detail = (event as CustomEvent<{ status: string; referenceCode: string }>).detail;
      setNotificationToast(detail.status === 'confirmed'
        ? `Appointment ${detail.referenceCode} approved.`
        : detail.status === 'completed'
          ? `Appointment ${detail.referenceCode} marked completed and removed from the public schedule.`
          : detail.status === 'missed'
            ? `Appointment ${detail.referenceCode} marked as missed.`
        : detail.status === 'rejected' || detail.status === 'cancelled'
          ? `Appointment ${detail.referenceCode} ${detail.status}.`
          : `Appointment ${detail.referenceCode} updated.`);
    };
    window.addEventListener('appointment-status-change', handleStatusChange);
    return () => window.removeEventListener('appointment-status-change', handleStatusChange);
  }, [setNotificationToast]);

  return (
    <AccessibilityProvider>
    <div className="public-page-shell min-h-screen flex flex-col text-[#374151] antialiased selection:bg-[#eaf3ee] selection:text-[#0f4d3c]">
      <a href="#main-content" className="skip-to-content">
        {language === 'fil' ? 'Lumaktaw sa pangunahing nilalaman' : 'Skip to main content'}
      </a>
      <Header />
      {isSignedIn && (
        <button
          type="button"
          onClick={() => setMessagesOpen(true)}
          aria-label={`${language === 'fil' ? 'Mga mensahe' : 'Messages'}${unreadAdminMessageCount > 0 ? `, ${unreadAdminMessageCount} unread` : ''}`}
          aria-haspopup="dialog"
          title={unreadMessagesError || (unreadAdminMessageCount > 0 ? `${unreadAdminMessageCount} unread message${unreadAdminMessageCount === 1 ? '' : 's'}` : 'Messages')}
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#0f4d3c] text-white shadow-lg ring-2 ring-white transition-colors hover:bg-[#17645c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#17645c] xl:hidden"
        >
          <MessageCircleMore className="h-7 w-7" aria-hidden="true" />
          {unreadAdminMessageCount > 0 && (
            <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
              {unreadAdminMessageCount > 99 ? '99+' : unreadAdminMessageCount}
            </span>
          )}
        </button>
      )}

      {(appointmentRequestAvailability === 'pending' || appointmentRequestAvailability === 'confirmed') && (
        <div role="status" aria-live="polite" className={`hidden border-b px-4 py-3 text-center text-sm font-semibold sm:block ${appointmentRequestAvailability === 'pending' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}>
          {appointmentRequestAvailability === 'pending'
            ? (language === 'fil'
              ? 'May appointment request ka pang naghihintay ng pagsusuri ng kawani.'
              : 'You have an appointment request waiting for clinic staff to review.')
            : (language === 'fil'
              ? 'May kumpirmado kang appointment. Kumpletuhin o kanselahin muna ito bago humiling muli.'
              : 'You have an accepted appointment. Complete or cancel it before requesting another.')}
        </div>
      )}

      <main id="main-content" key={activeSection} tabIndex={-1} className="public-view-enter flex-1">
        {activeSection === 'clinic-information' ? (
          <PublicInformation />
        ) : activeSection === 'appointment-schedule' ? (
          <AppointmentSchedule />
        ) : activeSection === 'services' ? (
          <ServicesSection />
        ) : (
          <>
            <Hero />
            <RouteFinder />
            <PatientFlow />
          </>
        )}
      </main>

      <Footer />

      {isSignedIn && <UserAppointmentChat />}
      <OutreachBookingModal />
      {authModalOpen && <AuthScreen onClose={() => setAuthModalOpen(false)} />}

      {notificationToast && (
        <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-50 flex max-w-sm items-center gap-2 rounded-md border border-white/10 bg-[#0f4d3c] px-4 py-3 text-sm font-semibold text-white shadow-lg animate-fade-in sm:bottom-5 sm:left-auto sm:right-5">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{notificationToast}</span>
        </div>
      )}
    </div>
    </AccessibilityProvider>
  );
};

export default function App() {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();
  const [accountRole, setAccountRole] = useState<'checking' | 'admin' | 'user' | 'error'>('checking');
  const [roleError, setRoleError] = useState('');
  const verifiedUserId = useRef<string | null>(null);
  const userId = user?.id ?? null;
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) {
      setAccountRole('checking');
      setRoleError('');
      verifiedUserId.current = null;
      return;
    }

    let active = true;
    if (verifiedUserId.current !== userId) setAccountRole('checking');
    void (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error('A Clerk session token could not be created.');
        const response = await fetch('/api/admin?mode=role', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const responseBody = await response.text();
        let data: { role?: string; error?: string } = {};
        try {
          data = JSON.parse(responseBody) as { role?: string; error?: string };
        } catch {
          throw new Error(responseBody.trim() || `Server responded with status ${response.status}.`);
        }
        if (!response.ok || (data.role !== 'admin' && data.role !== 'user')) {
          throw new Error(data.error || 'Your account role could not be verified.');
        }
        if (!active) return;
        verifiedUserId.current = userId;
        setAccountRole(data.role);
        setRoleError('');
        if (data.role === 'admin') {
          sessionStorage.removeItem('masikap_booking_after_signin');
          sessionStorage.removeItem('masikap_booking_program');
        }
        if (data.role === 'user' && window.location.pathname === '/admin') {
          window.history.replaceState(null, '', '/');
        }
      } catch (caught) {
        if (!active) return;
        setRoleError(caught instanceof Error ? caught.message : 'Your account role could not be verified.');
        setAccountRole('error');
      }
    })();

    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, userId]);

  if (!isLoaded) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#eef2ee] text-sm font-bold text-[#173a37]">
        Loading...
      </main>
    );
  }

  if (isSignedIn && accountRole === 'checking') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#eef2ee] text-sm font-bold text-[#173a37]">
        Checking account access...
      </main>
    );
  }

  if (isSignedIn && accountRole === 'error') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#eef2ee] px-5 text-center text-[#173a37]">
        <p role="alert" className="max-w-md text-sm">{roleError}</p>
        <button type="button" onClick={() => void signOut()} className="border border-[#b9c7be] px-4 py-2 text-sm font-bold">Sign out and try again</button>
      </main>
    );
  }

  if (isSignedIn && accountRole === 'admin') return <AdminPanel />;

  return (
    <HealthCenterProvider>
      <AppContent />
    </HealthCenterProvider>
  );
}
