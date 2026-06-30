// Applies schema.sql to the Neon Postgres database in DATABASE_URL.
// Usage: node --env-file=.env scripts/db-setup.mjs
//    or: DATABASE_URL="postgres://…" node scripts/db-setup.mjs
import { neon } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✗ DATABASE_URL is not set. Pass it via --env-file=.env or inline.');
  process.exit(1);
}

const sql = neon(url);
const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');

// Strip comment lines, then split into individual statements.
const cleaned = schema
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n');
const statements = cleaned.split(';').map((s) => s.trim()).filter(Boolean);

console.log(`Applying ${statements.length} statements…`);
for (const stmt of statements) {
  await sql(stmt);
}
console.log('✓ Schema applied.');
