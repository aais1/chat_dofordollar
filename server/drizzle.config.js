import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './models/schema.js',
  out:    './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
