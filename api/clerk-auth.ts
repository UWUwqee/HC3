import { verifyToken, type VerifyTokenOptions } from '@clerk/backend';

export type ClerkIdentity = {
  uid: string;
  email?: string;
  email_verified?: boolean;
  admin?: boolean;
};

export async function verifyClerkToken(token: string): Promise<ClerkIdentity | null> {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is not configured.');

  try {
    const payload = await verifyToken(token, { secretKey } satisfies VerifyTokenOptions);
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    const publicMetadata = payload.publicMetadata as Record<string, unknown> | undefined;
    return {
      uid: payload.sub,
      email,
      email_verified: payload.email_verified === true,
      admin: publicMetadata?.role === 'admin',
    };
  } catch (error) {
    console.error('Clerk session token verification failed:', error);
    return null;
  }
}
