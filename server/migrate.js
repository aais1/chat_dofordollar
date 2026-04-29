/**
 * Direct SQL migration script — bypasses drizzle-kit advisory locks
 * Works with Supabase pgbouncer connection string
 */
import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function migrate() {
  console.log('Running migrations...');

  await sql`
    DO $$ BEGIN
      CREATE TYPE role AS ENUM ('user', 'admin');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `;

  await sql`
    DO $$ BEGIN
      CREATE TYPE message_type AS ENUM ('text', 'image', 'video', 'audio');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `;

  await sql`
    DO $$ BEGIN
      CREATE TYPE content_type AS ENUM ('image', 'video', 'text');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id               SERIAL PRIMARY KEY,
      name             VARCHAR(100) NOT NULL,
      phone            VARCHAR(30)  NOT NULL UNIQUE,
      email            VARCHAR(200),
      pin              TEXT         NOT NULL,
      role             role         NOT NULL DEFAULT 'user',
      profile_picture  TEXT,
      is_blocked       BOOLEAN      NOT NULL DEFAULT false,
      is_muted         BOOLEAN      NOT NULL DEFAULT false,
      last_seen        TIMESTAMPTZ,
      created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `;
  console.log('✓ users table');

  await sql`
    CREATE TABLE IF NOT EXISTS chats (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      admin_id        INTEGER NOT NULL REFERENCES users(id),
      last_message    TEXT,
      last_message_at TIMESTAMPTZ,
      unread_count    INTEGER NOT NULL DEFAULT 0,
      is_active       BOOLEAN NOT NULL DEFAULT true,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  console.log('✓ chats table');

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id           SERIAL PRIMARY KEY,
      chat_id      INTEGER      NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      sender_id    INTEGER      NOT NULL REFERENCES users(id),
      receiver_id  INTEGER      NOT NULL REFERENCES users(id),
      content      TEXT,
      message_type message_type NOT NULL DEFAULT 'text',
      media_url    TEXT,
      is_delivered BOOLEAN      NOT NULL DEFAULT false,
      is_read      BOOLEAN      NOT NULL DEFAULT false,
      read_at      TIMESTAMPTZ,
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `;
  console.log('✓ messages table');

  await sql`
    CREATE TABLE IF NOT EXISTS statuses (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content_type     content_type NOT NULL,
      media_url        TEXT,
      text_content     TEXT,
      caption          TEXT,
      background_color VARCHAR(20),
      expiry_time      TIMESTAMPTZ  NOT NULL,
      duration         INTEGER      NOT NULL DEFAULT 1,
      view_count       INTEGER      NOT NULL DEFAULT 0,
      created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `;
  console.log('✓ statuses table');

  await sql`
    CREATE TABLE IF NOT EXISTS status_views (
      id         SERIAL PRIMARY KEY,
      status_id  INTEGER NOT NULL REFERENCES statuses(id)  ON DELETE CASCADE,
      viewer_id  INTEGER NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
      viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(status_id, viewer_id)
    );
  `;
  console.log('✓ status_views table');

  await sql`
    CREATE TABLE IF NOT EXISTS welcome_messages (
      id         SERIAL PRIMARY KEY,
      message    TEXT    NOT NULL,
      is_active  BOOLEAN NOT NULL DEFAULT true,
      updated_by INTEGER REFERENCES users(id),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  console.log('✓ welcome_messages table');

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS users_phone_idx         ON users(phone);`;
  await sql`CREATE INDEX IF NOT EXISTS chats_last_msg_at_idx   ON chats(last_message_at);`;
  await sql`CREATE INDEX IF NOT EXISTS messages_chat_created_idx ON messages(chat_id, created_at);`;
  await sql`CREATE INDEX IF NOT EXISTS statuses_expiry_idx     ON statuses(expiry_time);`;
  await sql`CREATE INDEX IF NOT EXISTS statuses_user_idx       ON statuses(user_id);`;

  console.log('✓ indexes created');
  console.log('\n✅ Migration complete!');
  await sql.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
