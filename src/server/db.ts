import { neon } from '@neondatabase/serverless';

// Neon serverless HTTP client. Connection string comes from env (Neon URL,
// e.g. postgresql://user:pass@host/db?sslmode=require). DATABASE_URL is the
// standard name; CANFLOW_DATABASE_URL is a fallback used to avoid collisions
// with an unconfigured Vercel/Neon integration that registers an empty DATABASE_URL.
const connectionString = process.env.DATABASE_URL || process.env.CANFLOW_DATABASE_URL;
if (!connectionString) {
  // Surface a clear error rather than a cryptic one at first query.
  console.error('DATABASE_URL is not set. Add your Neon connection string to the environment.');
}

const sql = neon(connectionString ?? '');

/** Run a parameterized query ($1, $2, …) and return all rows. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  // The neon() http client is callable as `sql(queryString, params)`.
  return (await sql(text, params)) as T[];
}

/** Run a query and return the first row (or null). */
export async function one<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
