import { createInternalNeonAuth } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

export const NEON_AUTH_URL='https://ep-withered-flower-aeyxaru7.neonauth.c-2.us-east-2.aws.neon.tech/ashour_bukhari/auth';

const neonAuth=createInternalNeonAuth(NEON_AUTH_URL,{
  adapter: BetterAuthReactAdapter(),
});

export const authClient=neonAuth.adapter;
export const getAuthToken=()=>neonAuth.getJWTToken();
