import { createInternalNeonAuth } from "@neondatabase/auth";
import { BetterAuthReactAdapter, useStore } from "@neondatabase/auth/react";

const url = import.meta.env.VITE_NEON_AUTH_URL as string;

// Neon Auth (Better Auth) client. `adapter` is the React client
// (signIn.email / signUp.email / signOut / useSession); getJWTToken() mints a
// JWT we send to our own API for verification.
const neon = createInternalNeonAuth(url, { adapter: BetterAuthReactAdapter() });

export const authClient = neon.adapter;
export const getJWTToken = neon.getJWTToken;

/** Reactive session hook. `authClient.useSession` is a nanostore atom → read via useStore. */
export function useSession() {
  return useStore(authClient.useSession) as {
    data: { user?: { id: string; name?: string; email?: string } } | null;
    isPending: boolean;
  };
}

/** fetch() that attaches the Neon Auth JWT as a Bearer token when signed in. */
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  let token: string | null = null;
  try {
    token = await getJWTToken();
  } catch {
    token = null;
  }
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
