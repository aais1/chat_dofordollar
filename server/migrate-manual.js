import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

const sql = postgres(connectionString);

async function migrate() {
  console.log('🚀 Starting manual migration...');
  
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        subscription TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `;
    console.log('✅ Table "push_subscriptions" created or already exists.');

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS push_sub_user_id_idx ON push_subscriptions (user_id);
    `;
    console.log('✅ Index "push_sub_user_id_idx" created or already exists.');

    console.log('🎉 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await sql.end();
  }
}

migrate();
