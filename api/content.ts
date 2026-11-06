import type { IncomingMessage, ServerResponse } from 'node:http';
import { getContentDatabase, readSiteContent } from './site-content-store.js';

type ApiRequest = IncomingMessage;
type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  const db = getContentDatabase();
  if (!db) {
    const { DEFAULT_CLINIC_PUBLIC_SETTINGS, NEWS_UPDATES, OUTREACH_PROGRAMS, SERVICES_DATA } = await import('../src/data/healthCenterData.js');
    return response.status(200).json({
      services: SERVICES_DATA,
      news: NEWS_UPDATES,
      outreach: OUTREACH_PROGRAMS,
      settings: { ...DEFAULT_CLINIC_PUBLIC_SETTINGS },
    });
  }
  try {
    const { content } = await readSiteContent(db);
    return response.status(200).json(content);
  } catch (error) {
    console.error('Public site content could not be loaded:', error);
    const { DEFAULT_CLINIC_PUBLIC_SETTINGS, NEWS_UPDATES, OUTREACH_PROGRAMS, SERVICES_DATA } = await import('../src/data/healthCenterData.js');
    return response.status(200).json({
      services: SERVICES_DATA,
      news: NEWS_UPDATES,
      outreach: OUTREACH_PROGRAMS,
      settings: { ...DEFAULT_CLINIC_PUBLIC_SETTINGS },
    });
  }
}
