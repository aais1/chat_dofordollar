import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../models/schema.js';

const connectionString = process.env.DATABASE_URL;

// Use pgbouncer-compatible settings (no prepare)
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });

export default db;
