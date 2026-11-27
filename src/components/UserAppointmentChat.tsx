import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { useAuth, useUser } from '@clerk/react';
import { ChevronLeft, MessageCircle, Send, X } from 'lucide-react';
import { useHealthCenter } from '../context/HealthCenterContext';
import { formatAppointmentTime } from '../appointmentSchedule';

interface ChatAppointment {
  id: string;
  reference_code: string;
  patient_name: string;
  service_name: string;
  preferred_date: string;
  preferred_time: string;
  status: string;
  chat_status: string;
}

interface ChatMessage {
  id: string;
  appointment_id: string;
  sender_role: string;
  sender_name: string;
  message: string;
  created_at: string;
}

interface ChatResponse {
  appointments: ChatAppointment[];
  messages: ChatMessage[];
}

const WEBSITE_ASSISTANT_ACKNOWLEDGMENT = 'Got your message! Thanks for reaching out. The website assistant will reply with information based on published health center listings.';

function isAutomatedReminder(message: ChatMessage) {
  return message.sender_role === 'admin'
    && (message.message.startsWith('This is an automated reminder.')
      || message.message.startsWith('Reminder: Your appointment'));
}

function getDisplayMessage(message: string) {
  const legacyConfirmation = message.match(
    /^Your appointment for (.+) on (\d{4}-\d{2}-\d{2}) at (.+?) has been automatically confirmed\. You can view this schedule in your appointment chat\./,
  );
  if (!legacyConfirmation) return message;
  const [, service, date, time] = legacyConfirmation;
  return `This is an automated message.\n\nYour appointment for ${service} on ${date} at ${time} has been automatically confirmed. You can view the schedule in your appointment chat.\n\nFilipino:\nAwtomatikong mensahe ito. Kumpirmado na ang iyong appointment para sa ${service} sa ${date}, ganap na ${time}. Maaari mong tingnan ang iskedyul sa chat ng iyong appointment.`;
}

async function chatRequest(getToken: () => Promise<string | null>, body?: Record<string, unknown>) {
  const token = await getToken();
  if (!token) throw new Error('Your Clerk session could not be loaded. Please sign in again.');
  return fetch('/api/admin', {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
}

export const UserAppointmentChat: React.FC = () => {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { language, messagesOpen, setMessagesOpen } = useHealthCenter();
  const isFilipino = language === 'fil';
  const [appointments, setAppointments] = useState<ChatAppointment[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [optimisticMessage, setOptimisticMessage] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [assistantError, setAssistantError] = useState('');
  const [requestedReferenceCode, setRequestedReferenceCode] = useState('');
  const lastStatuses = useRef<Record<string, string>>({});
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!messagesOpen) return;
    let active = true;
    setLoading(true);

    const loadMessages = async () => {
      try {
        const response = await chatRequest(getToken);
        if (!response.ok) throw new Error('Messages could not be loaded.');
        const data = await response.json() as ChatResponse;
        if (!active) return;
        const normalizedAppointments = data.appointments.map((appointment) => ({
          ...appointment,
          status: String(appointment.status).toLowerCase(),
          chat_status: String(appointment.chat_status || 'closed'),
        }));
        normalizedAppointments.forEach((appointment) => {
          const previousStatus = lastStatuses.current[appointment.id];
          if (previousStatus && previousStatus !== appointment.status) {
            window.dispatchEvent(new CustomEvent('appointment-status-change', {
              detail: { status: appointment.status, referenceCode: appointment.reference_code },
            }));
          }
        });
        lastStatuses.current = Object.fromEntries(normalizedAppointments.map((appointment) => [appointment.id, appointment.status]));
        setAppointments(normalizedAppointments);
        setMessages(data.messages.filter((message) => !isAutomatedReminder(message)));
        setSelectedAppointmentId((current) => (
          current && data.appointments.some((appointment) => appointment.id === current)
            ? current
            : ''
        ));
        setError('');
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Messages could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [getToken, messagesOpen]);

  const selectedAppointment = appointments.find((appointment) => appointment.id === selectedAppointmentId);
  const selectedMessages = messages.filter((message) => message.appointment_id === selectedAppointmentId);
  const visibleMessages = [...selectedMessages];
  if (optimisticMessage?.appointment_id === selectedAppointmentId
    && !selectedMessages.some((message) => message.id === optimisticMessage.id)) {
    visibleMessages.push(optimisticMessage);
    if (sending && !selectedMessages.some((message) => message.id === `${optimisticMessage.id}-ack`)) {
      visibleMessages.push({
        ...optimisticMessage,
        id: `${optimisticMessage.id}-ack`,
        sender_role: 'assistant',
        sender_name: 'Website Assistant',
        message: WEBSITE_ASSISTANT_ACKNOWLEDGMENT,
      });
    }
  }
  const latestIncomingMessage = [...selectedMessages].reverse().find((message) => (
    message.sender_role === 'admin' || message.sender_role === 'assistant'
  ));

  useEffect(() => {
    if (!requestedReferenceCode) return;
    const appointment = appointments.find((item) => item.reference_code === requestedReferenceCode);
    if (!appointment) return;
    setSelectedAppointmentId(appointment.id);
    setRequestedReferenceCode('');
  }, [appointments, requestedReferenceCode]);

  useEffect(() => {
    const openAppointmentMessage = (event: Event) => {
      const { referenceCode } = (event as CustomEvent<{ referenceCode?: unknown }>).detail ?? {};
      if (typeof referenceCode !== 'string') return;
      setRequestedReferenceCode(referenceCode);
      setSelectedAppointmentId('');
      setMessagesOpen(true);
    };
    window.addEventListener('open-appointment-message', openAppointmentMessage);
    return () => window.removeEventListener('open-appointment-message', openAppointmentMessage);
  }, [setMessagesOpen]);

  useEffect(() => {
    if (!messagesOpen || !selectedAppointmentId || !latestIncomingMessage) return;
    void chatRequest(getToken, { action: 'mark_chat_read', appointmentId: selectedAppointmentId })
      .then((response) => {
        if (!response.ok) throw new Error('Messages could not be marked as read.');
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : 'Messages could not be marked as read.');
      });
  }, [getToken, messagesOpen, selectedAppointmentId, latestIncomingMessage?.id]);

  useEffect(() => {
    if (!messagesOpen || !selectedAppointment) return;
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [messagesOpen, selectedAppointmentId, visibleMessages.length, sending]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = messageDraft.trim();
    if (!selectedAppointment || selectedAppointment.chat_status !== 'open' || !question || sending) return;

    setSending(true);
    setError('');
    setAssistantError('');
    const clientMessageId = crypto.randomUUID();
    setOptimisticMessage({
      id: clientMessageId,
      appointment_id: selectedAppointment.id,
      sender_role: 'user',
      sender_name: user?.fullName || 'Patient',
      message: question,
      created_at: new Date().toISOString(),
    });
    setMessageDraft('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Your Clerk session could not be loaded. Please sign in again.');
      const response = await fetch('/api/website-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ appointmentId: selectedAppointment.id, question, clientMessageId }),
        cache: 'no-store',
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || `The website assistant is temporarily unavailable (HTTP ${response.status}).`);
      }
      const refresh = await chatRequest(getToken);
      if (!refresh.ok) throw new Error('The answer was saved, but the conversation could not be refreshed.');
      const data = await refresh.json() as ChatResponse;
      setAppointments(data.appointments);
      setMessages(data.messages);
    } catch (caught) {
      setMessageDraft(question);
      setAssistantError(caught instanceof Error ? caught.message : 'The website assistant could not respond.');
    } finally {
      setOptimisticMessage(null);
      setSending(false);
    }
  };

  const cancelSelectedAppointment = async () => {
    if (!selectedAppointment || !['pending', 'confirmed'].includes(selectedAppointment.status)) return;
    if (!window.confirm(isFilipino ? 'Kanselahin ang appointment request na ito?' : 'Cancel this appointment request?')) return;
    setError('');
    try {
      const response = await chatRequest(getToken, {
        action: 'patient_cancel',
        appointmentId: selectedAppointment.id,
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Appointment could not be cancelled.');
      setAppointments((current) => current.map((appointment) => appointment.id === selectedAppointment.id
        ? { ...appointment, status: 'cancelled' }
        : appointment));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Appointment could not be cancelled.');
    }
  };

  if (!messagesOpen) return null;

  return (
    <section role="dialog" aria-modal="true" aria-labelledby="patient-messages-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setMessagesOpen(false); }}>
      <div className="flex h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#dfe6e1] bg-[#f8faf7] shadow-2xl sm:h-[min(420px,72dvh)] sm:max-h-[72dvh]">
        <header className="flex shrink-0 items-center justify-between border-b border-[#e8eeea] bg-white px-4 py-2 sm:px-5">
          <div>
            <p className="text-[10px] font-bold text-[#17645c]">{isFilipino ? 'Mga appointment mo' : 'Your appointments'}</p>
            <h2 id="patient-messages-title" className="mt-0.5 text-base font-bold text-[#17312e]">{isFilipino ? 'Mga mensahe' : 'Messages'}</h2>
          </div>
          <button type="button" onClick={() => setMessagesOpen(false)} aria-label={isFilipino ? 'Isara ang mga mensahe' : 'Close messages'} className="rounded-full p-2 text-[#66736f] transition-colors hover:bg-[#f1f4f1]">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden bg-white lg:grid-cols-[190px_minmax(0,1fr)]">
          <aside className={`${selectedAppointment ? 'hidden lg:block' : 'block'} min-h-0 overflow-y-auto border-b border-[#dfe6e1] lg:border-b-0 lg:border-r`}>
            {appointments.map((appointment) => (
              <button key={appointment.id} type="button" onClick={() => { setAssistantError(''); setSelectedAppointmentId(appointment.id); }} className={`w-full border-b border-[#edf1ee] px-3 py-3 text-left transition-colors hover:bg-[#f4f7f4] ${selectedAppointmentId === appointment.id ? 'bg-[#edf3ef]' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#17312e]">{appointment.service_name}</p>
                    <p className="mt-1 text-xs text-[#66736f]">{appointment.reference_code}</p>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase ${appointment.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : appointment.status === 'completed' ? 'bg-sky-100 text-sky-800' : ['missed', 'cancelled', 'rejected'].includes(appointment.status) ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{appointment.status}</span>
                </div>
                <p className="mt-1.5 text-[11px] text-[#66736f]">{appointment.preferred_date} · {formatAppointmentTime(appointment.preferred_time)}</p>
              </button>
            ))}
            {appointments.length === 0 && <p className="p-4 text-sm text-[#66736f]">{loading ? (isFilipino ? 'Naglo-load...' : 'Loading...') : (isFilipino ? 'Wala pang appointment conversation.' : 'No appointment conversations yet.')}</p>}
          </aside>

          <div className={`${selectedAppointment ? 'block' : 'hidden'} h-full min-h-0 min-w-0 overflow-hidden lg:block`}>
            {!selectedAppointment ? (
              <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-[#66736f]">{isFilipino ? 'Pumili ng appointment conversation' : 'Select an appointment conversation'}</div>
            ) : (
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <div className="sticky top-0 z-10 flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-[#e7ece9] bg-white px-3 py-2 sm:px-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <button type="button" onClick={() => setSelectedAppointmentId('')} className="shrink-0 rounded-full p-1 hover:bg-[#f1f4f1] lg:hidden" aria-label={isFilipino ? 'Bumalik sa mga appointment' : 'Back to appointments'}>
                      <ChevronLeft className="h-5 w-5 text-[#17645c]" />
                    </button>
                    <MessageCircle className="h-4 w-4 shrink-0 text-[#17645c]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[#17312e]">{selectedAppointment.service_name}</p>
                      <p className="text-[10px] text-[#66736f]">{selectedAppointment.chat_status === 'closed' ? (isFilipino ? 'Sarado ang chat ng clinic staff' : 'Chat closed by clinic staff') : (isFilipino ? 'Bukas ang chat' : 'Chat open')}</p>
                    </div>
                  </div>
                  {['pending', 'confirmed'].includes(selectedAppointment.status) && (
                    <button type="button" onClick={() => void cancelSelectedAppointment()} className="min-h-8 shrink-0 rounded-md border border-rose-200 px-2.5 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-50">
                      {isFilipino ? 'Kanselahin' : 'Cancel appointment'}
                    </button>
                  )}
                </div>

                <div ref={conversationRef} aria-live="polite" className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain bg-[#f7f9f8] px-3 py-2.5 sm:px-4">
                  {visibleMessages.length === 0 && (
                    <article className="max-w-[88%] rounded-2xl rounded-bl-md border border-[#e0e8e2] bg-white px-3 py-2 text-xs leading-relaxed text-[#17312e]">
                      {isFilipino
                        ? 'Kumusta! Makakatulong ako sa mga tanong tungkol sa mga serbisyong nakalista, oras, lokasyon, at appointment. Hindi ako nagbibigay ng payong medikal o sumusuri ng live na availability.'
                        : 'Hi! I can help with published services, clinic hours, location, and appointment guidance. I can’t provide medical advice or check live availability.'}
                    </article>
                  )}
                  {visibleMessages.map((message) => (
                    <div key={message.id} className={`flex ${message.sender_role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <article className={`max-w-[min(82%,28rem)] rounded-2xl px-2.5 py-1.5 text-xs leading-[1.4] ${message.sender_role === 'user' ? 'rounded-br-md bg-[#17645c] text-white' : 'rounded-bl-md border border-[#e8eeea] bg-white text-[#17312e]'}`}>
                        <p className="whitespace-pre-line break-words">{getDisplayMessage(message.message)}</p>
                        <p className={`mt-0.5 text-[9px] leading-3 ${message.sender_role === 'user' ? 'text-white/70' : 'text-[#87938c]'}`}>
                          {message.id === optimisticMessage?.id ? (isFilipino ? 'Ipinapadala...' : 'Sending...') : message.sender_name}
                        </p>
                      </article>
                    </div>
                  ))}
                </div>
                {selectedAppointment.chat_status === 'open' ? (
                  <div className="shrink-0 border-t border-[#e7ece9] bg-white px-3 py-1.5 sm:px-4">
                    {assistantError && <p role="alert" className="mb-2 text-xs text-rose-800">{assistantError}</p>}
                    <form onSubmit={sendMessage} className="flex items-center gap-2">
                      <input value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} maxLength={1200} aria-label={isFilipino ? 'Itanong sa website assistant' : 'Ask the website assistant'} placeholder={isFilipino ? 'Magtanong tungkol sa health center' : 'Ask about the health center website'} className="h-9 min-w-0 flex-1 rounded-full border border-[#d8e0db] bg-[#f7f9f8] px-3.5 text-xs outline-none transition-colors placeholder:text-[#9aa59f] focus:border-[#17645c] focus:bg-white" />
                      <button type="submit" disabled={sending || !messageDraft.trim()} aria-label={isFilipino ? 'Ipadala ang tanong' : 'Send question to website assistant'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#17645c] text-white transition-colors hover:bg-[#124f49] disabled:cursor-not-allowed disabled:opacity-50">
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                ) : (
                  <p className="shrink-0 border-t border-[#e7ece9] bg-white px-4 py-3 text-center text-xs font-semibold text-[#66736f]">
                    {isFilipino ? 'Nakasara ang chat na ito. Makipag-ugnayan sa clinic staff para sa tulong.' : 'This chat has been closed by clinic staff.'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        {error && <p role="alert" className="shrink-0 border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-800">{error}</p>}
      </div>
    </section>
  );
};