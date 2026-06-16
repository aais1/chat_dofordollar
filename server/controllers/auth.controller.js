import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
import { users, chats, messages, welcomeMessages } from '../models/schema.js';
import { eq, and } from 'drizzle-orm';

const signToken = (userId, role) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// GET /api/auth/me
export const getMe = async (req, res) => {
  res.json({ user: req.user });
};

// POST /api/auth/signup
export const signup = async (req, res) => {
  try {
    const { name, phone, pin } = req.body;
    if (!name || !phone || !pin) return res.status(400).json({ message: 'name, phone, and pin are required' });
    if (String(pin).length < 4) return res.status(400).json({ message: 'PIN must be at least 4 digits' });

    const [existing] = await db.select().from(users).where(eq(users.phone, phone));
    if (existing) return res.status(409).json({ message: 'Phone number already registered' });

    const hashedPin = await bcrypt.hash(String(pin), 10);

    const [newUser] = await db.insert(users).values({
      name,
      phone,
      pin: hashedPin,
      role: 'user',
    }).returning();

    // Temporarily assign all new users to the main admin (round-robin distribution disabled)
    const admins = await db.select().from(users).where(eq(users.role, 'admin'));
    if (admins.length > 0) {
      const admin = admins.find(a => a.email === 'admin@chatapp.com') || admins[0];
      // Create chat for new user
      const [chat] = await db.insert(chats).values({
        userId: newUser.id,
        adminId: admin.id,
        lastMessage: null,
        unreadCount: 0,
      }).returning();

      // Send this admin's welcome message
      const [welcome] = await db.select().from(welcomeMessages)
        .where(and(eq(welcomeMessages.isActive, true), eq(welcomeMessages.adminId, admin.id)));
      const welcomeText = welcome?.message || 'Welcome! How can we help you today?';

      await db.insert(messages).values({
        chatId:      chat.id,
        senderId:    admin.id,
        receiverId:  newUser.id,
        content:     welcomeText,
        messageType: 'text',
        isDelivered: true,
      });

      await db.update(chats).set({
        lastMessage:   welcomeText,
        lastMessageAt: new Date(),
        unreadCount:   1,
      }).where(eq(chats.id, chat.id));
    }

  const token = signToken(newUser.id, newUser.role);
  const safeUser = { ...newUser };
  delete safeUser.pin;
  res.status(201).json({ token, user: safeUser });
  } catch (err) {
    console.error('signup error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) return res.status(400).json({ message: 'phone and pin are required' });

    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Use admin login' });

    const match = await bcrypt.compare(String(pin), user.pin);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    if (user.isBlocked) return res.status(403).json({ message: 'Your account has been blocked' });

  const token = signToken(user.id, user.role);
  const safeUser = { ...user };
  delete safeUser.pin;
  res.json({ token, user: safeUser });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/auth/admin/login
export const adminLogin = async (req, res) => {
  try {
    const { email, password, phone, pin } = req.body;

    let admin;
    const HARDCODED_ADMINS = [
      { email: 'admin@chatapp.com',  password: 'qwerty12',  name: 'Admin 1', phone: process.env.ADMIN_PHONE  || '+923000000000' },
      { email: 'admin2@chatapp.com', password: 'admin2pass', name: 'Admin 2', phone: process.env.ADMIN2_PHONE || '+923000000001' },
    ];

    if (email && password) {
      const hardcoded = HARDCODED_ADMINS.find(a => a.email === email && String(password) === a.password);
      if (hardcoded) {
        const [found] = await db.select().from(users).where(eq(users.email, hardcoded.email));
        if (found && found.role === 'admin') {
          admin = found;
        } else if (!found) {
          const hashed = await bcrypt.hash(String(password), 10);
          const [created] = await db.insert(users).values({
            name: hardcoded.name,
            phone: hardcoded.phone,
            email: hardcoded.email,
            pin: hashed,
            role: 'admin',
          }).returning();
          admin = created;
        } else {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
      } else {
        const [found] = await db.select().from(users).where(eq(users.email, email));
        if (!found || found.role !== 'admin') return res.status(401).json({ message: 'Invalid credentials' });
        const match = await bcrypt.compare(String(password), found.pin);
        if (!match) return res.status(401).json({ message: 'Invalid credentials' });
        admin = found;
      }
    } else if (phone && pin) {
      const [found] = await db.select().from(users).where(eq(users.phone, phone));
      if (!found || found.role !== 'admin') return res.status(401).json({ message: 'Invalid credentials' });
      const match = await bcrypt.compare(String(pin), found.pin);
      if (!match) return res.status(401).json({ message: 'Invalid credentials' });
      admin = found;
    } else {
      return res.status(400).json({ message: 'Provide email+password or phone+pin' });
    }

  const token = signToken(admin.id, admin.role);
  const safeAdmin = { ...admin };
  delete safeAdmin.pin;
  res.json({ token, user: safeAdmin });
  } catch (err) {
    console.error('adminLogin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
