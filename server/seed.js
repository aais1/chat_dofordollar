import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from './config/db.js';
import { users, welcomeMessages } from './models/schema.js';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('Seeding database...');

  // Create admin
  const [existing] = await db.select().from(users).where(eq(users.role, 'admin'));
  if (!existing) {
    // Hardcoded admin credentials (change here if you need to update)
    const ADMIN_EMAIL = 'admin@chatapp.com';
    const ADMIN_PASSWORD = 'qwerty12';

    const hashedPin = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const [admin] = await db.insert(users).values({
      name:  'Admin',
      phone: process.env.ADMIN_PHONE || '+923000000000',
      email: ADMIN_EMAIL,
      pin:   hashedPin,
      role:  'admin',
    }).returning();
    console.log('Admin created:', admin.email);
    console.log('Admin password is hardcoded in seed.js (for development).');
  } else {
    console.log('Admin already exists, skipping.');
  }

  // Create welcome message
  const [existingWelcome] = await db.select().from(welcomeMessages).where(eq(welcomeMessages.isActive, true));
  if (!existingWelcome) {
    await db.insert(welcomeMessages).values({
      message:  'Welcome! 👋 Thank you for reaching out. How can we help you today?',
      isActive: true,
    });
    console.log('Welcome message created.');
  }

  console.log('Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
