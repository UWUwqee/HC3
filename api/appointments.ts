import 'dotenv/config';
import { createClient } from '@libsql/client';
import { randomBytes, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyToken } from '@clerk/backend';
import { COVERAGE_AREAS } from '../src/data/masikapClinicInfo.ts';
import { SERVICES_DATA } from '../src/data/healthCenterData.ts';
import { getContentDatabase, readSiteContent } from './site-content-store.ts';
import {
  APPOINTMENT_TIME_SLOTS,
  formatAppointmentTime,
  getAppointmentTimePeriod,
  getEarliestAppointmentDate,
  getLatestAppointmentDate,
  isAppointmentTimeAvailable,
} from '../src/appointmentSchedule.ts';
import { isValidPhilippinePhoneNumber } from '../src/philippinePhone.ts';

type ApiRequest = IncomingMessage & { body?: unknown; headers: IncomingMessage['headers'] & { authorization?: string } };
type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

const zones = new Set(COVERAGE_AREAS);
const preferredTimes = new Set(APPOINTMENT_TIME_SLOTS);
const priorityCategoryOptions = new Set(['pwd', 'senior_citizen', 'pregnant_lactating']);
const guardianRelationships = new Set(['Parent', 'Legal guardian', 'Other guardian']);

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
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) throw new Error('CLERK_SECRET_KEY is not configured.');
    return await verifyToken(token, { secretKey });
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
      zone TEXT NOT NULL,
      service_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      preferred_date TEXT NOT NULL,
      preferred_time TEXT NOT NULL,
      privacy_consent INTEGER NOT NULL,
      address TEXT,
      chief_complaint TEXT,
      age INTEGER,
      guardian_name TEXT,
      guardian_relationship TEXT,
      guardian_consent INTEGER NOT NULL DEFAULT 0,
      priority_categories TEXT NOT NULL DEFAULT '',
      attendance_consent INTEGER NOT NULL DEFAULT 0,
      early_arrival_consent INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      chat_status TEXT NOT NULL DEFAULT 'closed',
      created_at TEXT NOT NULL,
      completed_at TEXT,
      missed_at TEXT
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
  const appointmentColumns = [
    ['address', 'TEXT'],
    ['chief_complaint', 'TEXT'],
    ['age', 'INTEGER'],
    ['guardian_name', 'TEXT'],
    ['guardian_relationship', 'TEXT'],
    ['guardian_consent', 'INTEGER NOT NULL DEFAULT 0'],
    ['priority_categories', "TEXT NOT NULL DEFAULT ''"],
    ['attendance_consent', 'INTEGER NOT NULL DEFAULT 0'],
    ['early_arrival_consent', 'INTEGER NOT NULL DEFAULT 0'],
    ['completed_at', 'TEXT'],
    ['missed_at', 'TEXT'],
  ] as const;
  for (const [name, definition] of appointmentColumns) {
    if (!columnNames.has(name)) {
      await db.execute(`ALTER TABLE appointment_requests ADD COLUMN ${name} ${definition}`);
    }
  }
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
  await db.execute(`
    CREATE TABLE IF NOT EXISTS patient_profiles (
      owner_uid TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      middle_name TEXT NOT NULL DEFAULT '',
      surname TEXT NOT NULL,
      suffix TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL,
      phone TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
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
    if (token && !process.env.CLERK_SECRET_KEY) {
      return response.status(503).json({ error: 'Clerk authentication is not configured.' });
    }
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
      const prioritySlots = priorityResult.rows.map((row) => ({
        date: String(row.preferred_date),
        time: String(row.preferred_time),
        priorityCount: Number(row.priority_count),
      }));
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
        const servicesBySlot = String(appointment.priority_categories ?? '').trim()
          ? priorityServicesBySlot
          : regularServicesBySlot;
        const services = servicesBySlot.get(key) ?? [];
        const serviceId = String(appointment.service_id);
        if (!services.some((service) => service.id === serviceId)) {
          services.push({ id: serviceId, name: String(appointment.service_name) });
          servicesBySlot.set(key, services);
        }
      }
      const slotsWithServices = slots.map((slot) => ({
        ...slot,
        services: regularServicesBySlot.get(`${slot.date}:${slot.time}`) ?? [],
      }));
      const prioritySlotsWithServices = prioritySlots.map((slot) => ({
        ...slot,
        services: priorityServicesBySlot.get(`${slot.date}:${slot.time}`) ?? [],
      }));
      const settingResult = await db.execute({
        sql: `SELECT appointment_date, time_slot, capacity, blocked
              FROM appointment_slot_settings
              WHERE appointment_date >= ?
              ORDER BY appointment_date ASC, time_slot ASC`,
        args: [new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())],
      });
      const slotSettings = settingResult.rows.map((row) => ({
        date: String(row.appointment_date),
        time: String(row.time_slot),
        capacity: Number(row.capacity),
        blocked: Number(row.blocked) === 1,
      }));
      const unavailableResult = await db.execute({
        sql: `SELECT preferred_date, preferred_time,
                     MAX(CASE WHEN COALESCE(priority_categories, '') = '' THEN 1 ELSE 0 END) AS has_regular_booking,
                     MAX(CASE WHEN COALESCE(priority_categories, '') != '' THEN 1 ELSE 0 END) AS has_priority_booking
              FROM appointment_requests
              WHERE status IN ('pending', 'confirmed') AND preferred_date >= ?
              GROUP BY preferred_date, preferred_time`,
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
          args: [decoded.sub],
        });
        const profile = await db.execute({
          sql: 'SELECT first_name, middle_name, surname, suffix, gender, phone FROM patient_profiles WHERE owner_uid = ?',
          args: [decoded.sub],
        });
        return response.status(200).json({
          slots: slotsWithServices,
          prioritySlots: prioritySlotsWithServices,
          slotSettings,
          unavailableSlots,
          appointments: appointments.rows,
          profile: profile.rows[0] ?? null,
        });
      }
      return response.status(200).json({
        slots: slotsWithServices,
        prioritySlots: prioritySlotsWithServices,
        slotSettings,
        unavailableSlots,
      });
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
  if (!process.env.CLERK_SECRET_KEY) {
    return response.status(503).json({ error: 'Clerk authentication is not configured.' });
  }
  const decoded = await authenticate(request);
  if (!decoded) {
    return response.status(401).json({ error: 'Your Clerk sign-in could not be verified. Please sign in again.' });
  }

  const body = request.body && typeof request.body === 'object'
    ? request.body as Record<string, unknown>
    : {};

  if (body.action === 'save_profile') {
    const firstName = text(body.firstName, 80);
    const middleName = text(body.middleName, 80);
    const surname = text(body.surname, 80);
    const suffix = text(body.suffix, 8);
    const gender = text(body.gender, 40);
    const phone = text(body.phone, 32);
    const validSuffixes = new Set(['', 'Jr.', 'Sr.', 'I', 'II', 'III', 'IV', 'V']);
    const validGenders = new Set(['Male', 'Female', 'Other', 'Prefer not to say']);
    if (firstName.length < 1 || surname.length < 1) {
      return response.status(400).json({ error: 'Enter your first name and surname.' });
    }
    if (!validSuffixes.has(suffix) || !validGenders.has(gender)) {
      return response.status(400).json({ error: 'Choose a valid suffix and gender option.' });
    }
    if (!/^\+63\d{10}$/.test(phone) || !isValidPhilippinePhoneNumber(phone.slice(3))) {
      return response.status(400).json({ error: 'Enter a valid Philippine mobile number with +63 and 10 digits.' });
    }
    const db = getDatabase();
    if (!db) return response.status(503).json({ error: 'Your account details could not be saved.' });
    try {
      await ensureAppointmentTable(db);
      await db.execute({
        sql: `INSERT INTO patient_profiles
              (owner_uid, first_name, middle_name, surname, suffix, gender, phone, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(owner_uid) DO UPDATE SET
                first_name = excluded.first_name, middle_name = excluded.middle_name,
                surname = excluded.surname, suffix = excluded.suffix, gender = excluded.gender,
                phone = excluded.phone, updated_at = excluded.updated_at`,
        args: [decoded.sub, firstName, middleName, surname, suffix, gender, phone, new Date().toISOString()],
      });
      return response.status(200).json({ saved: true });
    } catch (error) {
      console.error('Patient account details could not be saved:', error);
      return response.status(500).json({ error: 'Your account details could not be saved.' });
    }
  }

  const patientName = text(body.patientName, 120);
  const phone = text(body.phone, 32);
  const email = text(body.email, 254).toLowerCase();
  const houseApartmentNumber = text(body.houseApartmentNumber, 100);
  const streetName = text(body.streetName, 150);
  const address = [houseApartmentNumber, streetName].filter(Boolean).join(', ').slice(0, 250);
  const chiefComplaint = text(body.chiefComplaint, 2000);
  const age = body.age;
  const guardianName = text(body.guardianName, 120);
  const guardianRelationship = text(body.guardianRelationship, 60);
  const priorityCategories = body.priorityCategories;
  const zone = text(body.zone, 40);
  const serviceId = text(body.serviceId, 40);
  const preferredDate = text(body.preferredDate, 10);
  const preferredTime = text(body.preferredTime, 30);
  const ownerUid = decoded.sub;

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

  let services = SERVICES_DATA;
  const contentDatabase = getContentDatabase();
  if (contentDatabase) {
    try {
      services = (await readSiteContent(contentDatabase)).content.services;
    } catch (error) {
      console.error('Published appointment services could not be loaded:', error);
      return response.status(500).json({ error: 'Published services could not be loaded. Please try again.' });
    }
  }
  const selectedService = services.find((service) => service.id === serviceId);

  const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(preferredDate)
    && !Number.isNaN(Date.parse(`${preferredDate}T00:00:00Z`))
    && new Date(`${preferredDate}T00:00:00Z`).toISOString().slice(0, 10) === preferredDate;
  const now = new Date();
  const earliestAppointmentDate = getEarliestAppointmentDate(now);
  const latestAppointmentDate = getLatestAppointmentDate(now);

  if (patientName.length < 2) return response.status(400).json({ error: 'Enter a valid full name.' });
  if (!/^\+63\d{10}$/.test(phone) || !isValidPhilippinePhoneNumber(phone.slice(3))) {
    return response.status(400).json({ error: 'Enter a valid Philippine mobile number with +63 and 10 digits.' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Enter a valid email address or leave it blank.' });
  if (!houseApartmentNumber || streetName.length < 2 || address.length < 5) {
    return response.status(400).json({ error: 'Enter a valid house/apartment number and street name.' });
  }
  if (chiefComplaint.length < 2) return response.status(400).json({ error: 'Describe your reason for the visit.' });
  if (typeof age !== 'number' || !Number.isInteger(age) || age < 0 || age > 110) {
    return response.status(400).json({ error: 'Enter a valid age from 0 to 110.' });
  }
  if (age <= 17 && (
    guardianName.length < 2
    || !guardianRelationships.has(guardianRelationship)
    || body.guardianConsent !== true
  )) {
    return response.status(400).json({ error: 'Patients aged 17 and younger need a parent or guardian and confirmation that they will attend.' });
  }
  if (!Array.isArray(priorityCategories)
    || priorityCategories.some((category) => typeof category !== 'string' || !priorityCategoryOptions.has(category))
    || new Set(priorityCategories).size !== priorityCategories.length) {
    return response.status(400).json({ error: 'Choose valid priority categories.' });
  }
  if (age < 60 && priorityCategories.includes('senior_citizen')) {
    return response.status(400).json({ error: 'Senior citizen priority is available to patients aged 60 and above.' });
  }
  if (age >= 60 && !priorityCategories.includes('senior_citizen')) priorityCategories.push('senior_citizen');
  if (age >= 60 && priorityCategories.includes('pregnant_lactating')) {
    return response.status(400).json({ error: 'Pregnant or lactating priority cannot be selected with senior citizen priority.' });
  }
  if (!zones.has(zone)) return response.status(400).json({ error: 'Select a valid zone or barangay.' });
  if (!selectedService) return response.status(400).json({ error: 'Select a service offered by Masikap Health Center.' });
  if (!dateIsValid || preferredDate < earliestAppointmentDate || preferredDate > latestAppointmentDate) {
    return response.status(400).json({ error: `Choose an appointment date between ${earliestAppointmentDate} and ${latestAppointmentDate} (Philippines time).` });
  }
  if (!preferredTimes.has(preferredTime)) return response.status(400).json({ error: 'Select a valid time slot.' });
  if (!isAppointmentTimeAvailable(preferredDate, preferredTime, now)) {
    return response.status(400).json({ error: 'Choose an appointment time that has not passed today.' });
  }
  if (body.privacyConsent !== true) return response.status(400).json({ error: 'Please agree to the contact and privacy consent.' });
  if (body.attendanceConsent !== true) return response.status(400).json({ error: 'Please acknowledge the appointment attendance reminder.' });
  if (body.arrivalConsent !== true) return response.status(400).json({ error: 'Please confirm that you will arrive 30 minutes early.' });

  const db = getDatabase();
  if (!db) return response.status(503).json({ error: 'Appointment requests are temporarily unavailable.' });

  const id = randomUUID();
  const referenceCode = `MFHC-${randomBytes(4).toString('hex').toUpperCase()}`;
  const createdAt = new Date().toISOString();

  try {
    await ensureAppointmentTable(db);
    const serviceName = selectedService.title;
    if (!serviceName) return response.status(400).json({ error: 'The selected service is not configured for appointment requests.' });
    const slotSettings = await db.execute({
      sql: `SELECT time_slot, capacity, blocked FROM appointment_slot_settings
            WHERE appointment_date = ? AND time_slot IN ('all_day', ?, ?)`,
      args: [preferredDate, preferredTime, getAppointmentTimePeriod(preferredTime)],
    });
    if (slotSettings.rows.some((setting) => Number(setting.blocked) === 1)) {
      return response.status(409).json({ error: 'The selected date or time slot is unavailable. Please choose another.' });
    }
    const transaction = await db.transaction('write');
    try {
      const activeAppointment = await transaction.execute({
        sql: `SELECT reference_code, preferred_date, preferred_time
              FROM appointment_requests
              WHERE owner_uid = ? AND status IN ('pending', 'confirmed')
              ORDER BY created_at DESC LIMIT 1`,
        args: [ownerUid],
      });
      if (activeAppointment.rows[0]) {
        const existing = activeAppointment.rows[0];
        await transaction.commit();
        return response.status(409).json({
          error: 'You already have an active appointment. Complete or cancel it before requesting another.',
          pendingRequest: {
            referenceCode: String(existing.reference_code),
            preferredDate: String(existing.preferred_date),
            preferredTime: String(existing.preferred_time),
            status: String(existing.status),
          },
        });
      }
      const appointmentPriorityCategories = [
        ...priorityCategories,
        ...(selectedService.category === 'animal_bite' ? ['animal_bite'] : []),
      ];
      const slotPeriod = getAppointmentTimePeriod(preferredTime);
      const occupiedSlot = await transaction.execute({
        sql: `SELECT 1 FROM appointment_requests
              WHERE preferred_date = ? AND preferred_time = ?
                AND status IN ('pending', 'confirmed')
                ${appointmentPriorityCategories.length > 0 ? "AND priority_categories != ''" : ''}
              LIMIT 1`,
        args: [preferredDate, preferredTime],
      });
      if (occupiedSlot.rows[0]) {
        await transaction.commit();
        return response.status(409).json({ error: 'This appointment time has already been booked. Please choose another time.' });
      }
      const periodSetting = slotSettings.rows.find((setting) => String(setting.time_slot) === slotPeriod);
      const slotCapacity = Number(periodSetting?.capacity ?? 0);
      if (slotCapacity > 0) {
        const periodAppointments = await transaction.execute({
          sql: `SELECT COUNT(*) AS booked_count FROM appointment_requests
                WHERE preferred_date = ? AND status = 'confirmed'
                  AND CASE
                    WHEN preferred_time IN ('morning', 'afternoon') THEN preferred_time
                    WHEN CAST(substr(preferred_time, 1, 2) AS INTEGER) < 12 THEN 'morning'
                    ELSE 'afternoon'
                  END = ?`,
          args: [preferredDate, slotPeriod],
        });
        if (Number(periodAppointments.rows[0]?.booked_count ?? 0) >= slotCapacity) {
          await transaction.commit();
          return response.status(409).json({ error: 'This time period has reached its appointment limit. Please choose another time.' });
        }
      }
      const status = 'confirmed';
      const appointmentTime = formatAppointmentTime(preferredTime);
      const confirmationMessage = `This is an automated message.\n\nYour appointment for ${serviceName} on ${preferredDate} at ${appointmentTime} has been automatically confirmed. You can view the schedule in your appointment messages.\n\nFilipino:\nAwtomatikong mensahe ito. Kumpirmado na ang iyong appointment para sa ${serviceName} sa ${preferredDate}, ganap na ${appointmentTime}. Maaari mong tingnan ang iskedyul sa mga mensahe ng appointment.`;
      await transaction.execute({
        sql: `INSERT INTO appointment_requests (
          id, owner_uid, reference_code, patient_name, phone, email, address, chief_complaint,
          age, guardian_name, guardian_relationship, guardian_consent, priority_categories,
          zone, service_id, service_name, preferred_date, preferred_time, privacy_consent,
          attendance_consent, early_arrival_consent, status, chat_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, ?, 'open', ?)`,
        args: [
          id, ownerUid, referenceCode, patientName, phone, email || null, address, chiefComplaint,
          age, age <= 17 ? guardianName : null, age <= 17 ? guardianRelationship : null,
          age <= 17 && body.guardianConsent === true ? 1 : 0, appointmentPriorityCategories.join(','),
          zone, serviceId, serviceName, preferredDate, preferredTime, status, createdAt,
        ],
      });
      await transaction.execute({
        sql: `INSERT INTO appointment_messages
              (id, appointment_id, sender_uid, sender_role, sender_name, message, created_at)
              VALUES (?, ?, 'clinic-system', 'admin', 'Health Center', ?, ?)`,
        args: [randomUUID(), id, confirmationMessage, createdAt],
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
