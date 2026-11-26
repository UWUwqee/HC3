import 'dotenv/config';
import { createClient } from '@libsql/client';
import { randomBytes, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { COVERAGE_AREAS } from '../src/data/masikapClinicInfo.ts';
import {
  APPOINTMENT_TIME_SLOTS,
  formatAppointmentTime,
  getAppointmentTimePeriod,
  getEarliestAppointmentDate,
  isAppointmentTimeAvailable,
} from '../src/appointmentSchedule.ts';
import { ensureSiteContent, getContentDatabase } from './site-content-store.ts';
import { verifyClerkToken } from './clerk-auth.ts';

type ApiRequest = IncomingMessage & { body?: unknown; headers: IncomingMessage['headers'] & { authorization?: string } };
type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

const zones = new Set(COVERAGE_AREAS);
const preferredTimes = new Set(APPOINTMENT_TIME_SLOTS);
const priorityCategoryOptions = new Set(['pwd', 'senior_citizen', 'pregnant_lactating']);

let database: ReturnType<typeof createClient> | undefined;

function getDatabase() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  database ??= createClient({ url, authToken });
  return database;
}

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

async function authenticate(request: ApiRequest) {
  const authorization = text(request.headers.authorization, 2000);
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  try {
    return await verifyClerkToken(token);
  } catch (error) {
    console.error('Appointment API Clerk session verification failed:', error);
    return null;
  }
}

async function ensureAppointmentTable(db: ReturnType<typeof createClient>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS appointment_requests (
      id TEXT PRIMARY KEY,
      owner_uid TEXT,
      reference_code TEXT NOT NULL UNIQUE,
      patient_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      chief_complaint TEXT,
      age INTEGER,
      priority_categories TEXT NOT NULL DEFAULT '',
      attendance_consent INTEGER NOT NULL DEFAULT 0,
      zone TEXT NOT NULL,
      service_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      preferred_date TEXT NOT NULL,
      preferred_time TEXT NOT NULL,
      privacy_consent INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      chat_status TEXT NOT NULL DEFAULT 'closed',
      created_at TEXT NOT NULL,
      completed_at TEXT
    )
  `);
  const columns = await db.execute('PRAGMA table_info(appointment_requests)');
  const columnNames = new Set(columns.rows.map((column) => String(column.name)));
  if (!columnNames.has('owner_uid')) {
    await db.execute('ALTER TABLE appointment_requests ADD COLUMN owner_uid TEXT');
  }
  if (!columnNames.has('chat_status')) {
    await db.execute("ALTER TABLE appointment_requests ADD COLUMN chat_status TEXT NOT NULL DEFAULT 'closed'");
  }
  if (!columnNames.has('address')) await db.execute('ALTER TABLE appointment_requests ADD COLUMN address TEXT');
  if (!columnNames.has('chief_complaint')) await db.execute('ALTER TABLE appointment_requests ADD COLUMN chief_complaint TEXT');
  if (!columnNames.has('age')) await db.execute('ALTER TABLE appointment_requests ADD COLUMN age INTEGER');
  if (!columnNames.has('priority_categories')) {
    await db.execute("ALTER TABLE appointment_requests ADD COLUMN priority_categories TEXT NOT NULL DEFAULT ''");
  }
  if (!columnNames.has('attendance_consent')) {
    await db.execute('ALTER TABLE appointment_requests ADD COLUMN attendance_consent INTEGER NOT NULL DEFAULT 0');
  }
  if (!columnNames.has('completed_at')) await db.execute('ALTER TABLE appointment_requests ADD COLUMN completed_at TEXT');
  await db.execute(`
    CREATE TABLE IF NOT EXISTS appointment_slot_settings (
      appointment_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 0,
      blocked INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (appointment_date, time_slot)
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS clinic_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS appointment_messages (
      id TEXT PRIMARY KEY,
      appointment_id TEXT NOT NULL,
      sender_uid TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await db.execute({
    sql: `INSERT OR IGNORE INTO clinic_settings (setting_key, setting_value, updated_at)
          VALUES ('clinic_open', '0', ?)`,
    args: [new Date().toISOString()],
  });
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'GET') {
    const token = text(request.headers.authorization, 2000);
    const decoded = token ? await authenticate(request) : null;
    if (token && !decoded) return response.status(401).json({ error: 'Authentication is required.' });
    const db = getDatabase();
    if (!db) return response.status(503).json({ error: 'Schedule data is temporarily unavailable.' });

    try {
      await ensureAppointmentTable(db);
      const result = await db.execute(`
        SELECT preferred_date, preferred_time, COUNT(*) AS booked_count
        FROM appointment_requests
        WHERE status = 'confirmed'
        GROUP BY preferred_date, preferred_time
        ORDER BY preferred_date ASC
      `);
      const slots = result.rows.map((row) => ({
        date: String(row.preferred_date),
        time: String(row.preferred_time),
        bookedCount: Number(row.booked_count),
      }));
      const priorityResult = await db.execute(`
        SELECT preferred_date, preferred_time, COUNT(*) AS priority_count
        FROM appointment_requests
        WHERE status = 'confirmed' AND priority_categories != ''
        GROUP BY preferred_date, preferred_time
        ORDER BY preferred_date ASC, preferred_time ASC
      `);
      const serviceAppointments = await db.execute(`
        SELECT preferred_date, preferred_time, service_id, service_name, priority_categories
        FROM appointment_requests
        WHERE status = 'confirmed'
        ORDER BY preferred_date ASC, preferred_time ASC, service_name ASC
      `);
      const regularServicesBySlot = new Map<string, Array<{ id: string; name: string }>>();
      const priorityServicesBySlot = new Map<string, Array<{ id: string; name: string }>>();
      for (const appointment of serviceAppointments.rows) {
        const key = `${String(appointment.preferred_date)}:${String(appointment.preferred_time)}`;
        const isPriority = String(appointment.priority_categories ?? '').trim() !== '';
        const servicesBySlot = isPriority ? priorityServicesBySlot : regularServicesBySlot;
        const services = servicesBySlot.get(key) ?? [];
        const serviceId = String(appointment.service_id);
        if (!services.some((service) => service.id === serviceId)) {
          services.push({ id: serviceId, name: String(appointment.service_name) });
          servicesBySlot.set(key, services);
        }
      }
      const prioritySlots = priorityResult.rows.map((row) => ({
        date: String(row.preferred_date),
        time: String(row.preferred_time),
        priorityCount: Number(row.priority_count),
        services: priorityServicesBySlot.get(`${String(row.preferred_date)}:${String(row.preferred_time)}`) ?? [],
      }));
      const slotsWithServices = slots.map((slot) => ({
        ...slot,
        services: regularServicesBySlot.get(`${slot.date}:${slot.time}`) ?? [],
      }));
      const settingResult = await db.execute({
        sql: `SELECT appointment_date, time_slot, blocked
              FROM appointment_slot_settings
              WHERE appointment_date >= ?
              ORDER BY appointment_date ASC, time_slot ASC`,
        args: [new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())],
      });
      const slotSettings = settingResult.rows.map((row) => ({
        date: String(row.appointment_date),
        time: String(row.time_slot),
        blocked: Number(row.blocked) === 1,
      }));
      const unavailableResult = await db.execute({
        sql: `SELECT preferred_date, preferred_time,
                     MAX(CASE WHEN priority_categories = '' THEN 1 ELSE 0 END) AS has_regular_booking,
                     MAX(CASE WHEN priority_categories != '' THEN 1 ELSE 0 END) AS has_priority_booking
              FROM appointment_requests
              WHERE status IN ('pending', 'confirmed') AND preferred_date >= ?
              GROUP BY preferred_date, preferred_time
              ORDER BY preferred_date ASC, preferred_time ASC`,
        args: [new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())],
      });
      const unavailableSlots = unavailableResult.rows.map((row) => ({
        date: String(row.preferred_date),
        time: String(row.preferred_time),
        hasRegularBooking: Number(row.has_regular_booking) === 1,
        hasPriorityBooking: Number(row.has_priority_booking) === 1,
      }));

      if (decoded) {
        const appointments = await db.execute({
          sql: `SELECT * FROM appointment_requests WHERE owner_uid = ? ORDER BY preferred_date ASC, preferred_time ASC`,
          args: [decoded.uid],
        });
        return response.status(200).json({
          slots: slotsWithServices,
          prioritySlots,
          slotSettings,
          unavailableSlots,
          appointments: appointments.rows,
        });
      }
      return response.status(200).json({ slots: slotsWithServices, prioritySlots, slotSettings, unavailableSlots });
    } catch {
      return response.status(500).json({ error: 'Schedule data could not be loaded.' });
    }
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const authorization = text(request.headers.authorization, 2000);
  if (!authorization.startsWith('Bearer ')) {
    return response.status(401).json({ error: 'Sign in before requesting an appointment.' });
  }
  const decoded = await authenticate(request);
  if (!decoded) {
    return response.status(401).json({ error: 'Your Clerk sign-in could not be verified.' });
  }

  const body = request.body && typeof request.body === 'object'
    ? request.body as Record<string, unknown>
    : {};
  const patientName = text(body.patientName, 120);
  const phone = text(body.phone, 32);
  const email = text(body.email, 254).toLowerCase();
  const address = text(body.address, 250);
  const chiefComplaint = text(body.chiefComplaint, 2000);
  const age = body.age;
  const requestedCategories = body.priorityCategories;
  const zone = text(body.zone, 40);
  const serviceId = text(body.serviceId, 40);
  const preferredDate = text(body.preferredDate, 10);
  const preferredTime = text(body.preferredTime, 30);
  const ownerUid = decoded.uid;

  if (body.action === 'cancel') {
    const referenceCode = text(body.referenceCode, 80);
    if (!referenceCode || !ownerUid) return response.status(400).json({ error: 'Reference code and signed-in user are required.' });
    const db = getDatabase();
    if (!db) return response.status(503).json({ error: 'Appointment requests are temporarily unavailable.' });
    try {
      await db.execute({ sql: "UPDATE appointment_requests SET status = 'cancelled' WHERE reference_code = ? AND owner_uid = ?", args: [referenceCode, ownerUid] });
      return response.status(200).json({ referenceCode, status: 'cancelled' });
    } catch {
      return response.status(500).json({ error: 'Appointment could not be cancelled.' });
    }
  }

  const phoneDigits = phone.replace(/\D/g, '');
  const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(preferredDate)
    && !Number.isNaN(Date.parse(`${preferredDate}T00:00:00Z`))
    && new Date(`${preferredDate}T00:00:00Z`).toISOString().slice(0, 10) === preferredDate;
  const now = new Date();
  const earliestAppointmentDate = getEarliestAppointmentDate(now);
  const priorityCategories = Array.isArray(requestedCategories)
    ? requestedCategories.filter((category: unknown): category is string => typeof category === 'string')
    : [];

  if (patientName.length < 2) return response.status(400).json({ error: 'Enter a valid full name.' });
  if (phoneDigits.length < 7) return response.status(400).json({ error: 'Enter a contact number with at least 7 digits.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Enter a valid email address or leave it blank.' });
  if (address.length < 5) return response.status(400).json({ error: 'Enter a valid home address.' });
  if (chiefComplaint.length < 2) return response.status(400).json({ error: 'Describe your reason for the visit.' });
  if (typeof age !== 'number' || !Number.isInteger(age) || age < 0 || age > 120) {
    return response.status(400).json({ error: 'Enter a valid age from 0 to 120.' });
  }
  if (!Array.isArray(requestedCategories)
    || priorityCategories.length !== requestedCategories.length
    || priorityCategories.some((category) => !priorityCategoryOptions.has(category))
    || new Set(priorityCategories).size !== priorityCategories.length) {
    return response.status(400).json({ error: 'Choose valid priority categories.' });
  }
  if (age < 60 && priorityCategories.includes('senior_citizen')) {
    return response.status(400).json({ error: 'Senior citizen priority is available to patients aged 60 and above.' });
  }
  if (age >= 60 && !priorityCategories.includes('senior_citizen')) priorityCategories.push('senior_citizen');
  if (!zones.has(zone)) return response.status(400).json({ error: 'Select a valid zone or barangay.' });
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(serviceId)) return response.status(400).json({ error: 'Select a valid service.' });
  if (!dateIsValid || preferredDate < earliestAppointmentDate) {
    return response.status(400).json({ error: `Choose an appointment date on or after ${earliestAppointmentDate} (Philippines time).` });
  }
  if (!preferredTimes.has(preferredTime)) return response.status(400).json({ error: 'Select a half-hour appointment time between 9:00 AM and 2:00 PM.' });
  if (!isAppointmentTimeAvailable(preferredDate, preferredTime, now)) {
    return response.status(400).json({ error: `Choose an appointment time that has not passed today. Today's date is available until 2:00 PM (Philippines time).` });
  }
  if (body.privacyConsent !== true) return response.status(400).json({ error: 'Please agree to the contact and privacy consent.' });
  if (body.attendanceConsent !== true) return response.status(400).json({ error: 'Please acknowledge the appointment attendance reminder.' });

  const db = getDatabase();
  if (!db) return response.status(503).json({ error: 'Appointment requests are temporarily unavailable.' });

  const id = randomUUID();
  const referenceCode = `MFHC-${randomBytes(4).toString('hex').toUpperCase()}`;
  const createdAt = new Date().toISOString();

  try {
    await ensureAppointmentTable(db);
    const contentDb = getContentDatabase();
    if (!contentDb) return response.status(503).json({ error: 'Appointment requests are temporarily unavailable.' });
    await ensureSiteContent(contentDb);
    const serviceResult = await contentDb.execute({
      sql: `SELECT content_json FROM public_site_content
            WHERE content_type = 'service' AND content_id = ? AND published = 1 AND deleted = 0`,
      args: [serviceId],
    });
    if (!serviceResult.rows[0]) return response.status(400).json({ error: 'This service is no longer available for appointment requests.' });
    const service = JSON.parse(String(serviceResult.rows[0].content_json)) as { title?: unknown };
    const serviceName = typeof service.title === 'string' ? service.title.trim().slice(0, 160) : '';
    if (!serviceName) return response.status(400).json({ error: 'The selected service is not configured for appointment requests.' });
    const transaction = await db.transaction('write');
    try {
      const activeAppointment = await transaction.execute({
        sql: `SELECT reference_code, preferred_date, preferred_time, status
              FROM appointment_requests
              WHERE owner_uid = ? AND status IN ('pending', 'confirmed')
              ORDER BY created_at DESC LIMIT 1`,
        args: [ownerUid],
      });
      if (activeAppointment.rows[0]) {
        const existing = activeAppointment.rows[0];
        await transaction.commit();
        return response.status(409).json({
          error: String(existing.status) === 'confirmed'
            ? 'You already have an accepted appointment. Complete or cancel it before requesting another.'
            : 'You already have an appointment request waiting for review.',
          activeAppointment: {
            referenceCode: String(existing.reference_code),
            preferredDate: String(existing.preferred_date),
            preferredTime: String(existing.preferred_time),
            status: String(existing.status),
          },
        });
      }
      const prioritySlotFilter = priorityCategories.length > 0 ? "AND priority_categories != ''" : '';
      const occupiedSlot = await transaction.execute({
        sql: `SELECT 1 FROM appointment_requests
              WHERE preferred_date = ? AND preferred_time = ?
                AND status IN ('pending', 'confirmed')
                ${prioritySlotFilter}
              LIMIT 1`,
        args: [preferredDate, preferredTime],
      });
      if (occupiedSlot.rows[0]) {
        await transaction.commit();
        return response.status(409).json({ error: 'This appointment time has already been booked. Please choose another time.' });
      }
      const period = getAppointmentTimePeriod(preferredTime);
      const slotSettings = await transaction.execute({
        sql: `SELECT time_slot, blocked FROM appointment_slot_settings
              WHERE appointment_date = ? AND time_slot IN ('all_day', ?, ?)`,
        args: [preferredDate, preferredTime, period],
      });
      if (slotSettings.rows.some((setting) => Number(setting.blocked) === 1)) {
        await transaction.commit();
        return response.status(409).json({ error: 'The selected date or time slot is unavailable. Please choose another.' });
      }
      const status = 'confirmed';
      const appointmentTime = formatAppointmentTime(preferredTime);
      const message = `This is an automated message.\n\nYour appointment for ${serviceName} on ${preferredDate} at ${appointmentTime} has been automatically confirmed. You can view the schedule in your appointment chat.\n\nFilipino:\nAwtomatikong mensahe ito. Kumpirmado na ang iyong appointment para sa ${serviceName} sa ${preferredDate}, ganap na ${appointmentTime}. Maaari mong tingnan ang iskedyul sa chat ng iyong appointment.`;
      await transaction.execute({
        sql: `INSERT INTO appointment_requests (
          id, owner_uid, reference_code, patient_name, phone, email, address, chief_complaint, age,
          priority_categories, attendance_consent, zone, service_id, service_name, preferred_date,
          preferred_time, privacy_consent, status, chat_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'open', ?)`,
        args: [
          id, ownerUid, referenceCode, patientName, phone, email || null, address, chiefComplaint, age,
          priorityCategories.join(','), body.attendanceConsent ? 1 : 0, zone, serviceId, serviceName,
          preferredDate, preferredTime, status, createdAt,
        ],
      });
      await transaction.execute({
        sql: `INSERT INTO appointment_messages
              (id, appointment_id, sender_uid, sender_role, sender_name, message, created_at)
              VALUES (?, ?, 'clinic-system', 'admin', 'Masikap Health Center', ?, ?)`,
        args: [randomUUID(), id, message, createdAt],
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch {
    return response.status(500).json({ error: 'We could not save your request. Please try again.' });
  }

  return response.status(201).json({ referenceCode, status: 'confirmed', createdAt });
}
