import { createAuthClient } from '@neondatabase/auth';

export const NEON_AUTH_URL='https://ep-withered-flower-aeyxaru7.neonauth.c-2.us-east-2.aws.neon.tech/ashour_bukhari/auth';

export const authClient=createAuthClient(NEON_AUTH_URL);
