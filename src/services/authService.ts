import { db } from '../db/cobosDb';
import { generateUUID, queueSyncItem } from './accountingEngine';
import type { User, UserRole } from '../types';

/**
 * Normalizes phone number input into the required @cobos.zw email format
 * E.g., "+263 77 212 3456" or "0772123456" -> "263772123456@cobos.zw"
 */
export function normalizePhoneToCobosEmail(input: string): { email: string; rawPhone: string; isPhone: boolean } {
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    return {
      email: trimmed.toLowerCase(),
      rawPhone: '',
      isPhone: false,
    };
  }

  let digits = trimmed.replace(/\D/g, '');
  // In Zimbabwe, mobile numbers starting with 0 (e.g. 0772123456) map to 263772123456
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '263' + digits.substring(1);
  } else if (!digits.startsWith('263') && digits.length === 9) {
    digits = '263' + digits;
  }

  const email = `${digits}@cobos.zw`;
  return {
    email,
    rawPhone: trimmed,
    isPhone: true,
  };
}

export const SEED_USERS: User[] = [
  {
    id: 'usr_owner_comfort',
    name: 'Comfort Ncube',
    email: '263772123456@cobos.zw',
    phone: '+263 77 212 3456',
    role: 'owner',
    organisationId: 'org_default',
    authProvider: 'clerk_phone',
  },
  {
    id: 'usr_manager_tinashe',
    name: 'Tinashe Hove',
    email: '263773456789@cobos.zw',
    phone: '+263 77 345 6789',
    role: 'manager',
    organisationId: 'org_default',
    authProvider: 'clerk_phone',
  },
  {
    id: 'usr_cashier_grace',
    name: 'Grace Tsuro',
    email: '263712345678@cobos.zw',
    phone: '+263 71 234 5678',
    role: 'cashier',
    organisationId: 'org_default',
    authProvider: 'clerk_phone',
  },
  {
    id: 'usr_accountant_ruvimbo',
    name: 'Ruvimbo Shumba',
    email: 'accountant@cobos.zw',
    phone: '+263 77 987 6543',
    role: 'accountant',
    organisationId: 'org_default',
    authProvider: 'clerk_email',
  },
  {
    id: 'usr_inventory_farai',
    name: 'Farai Gumbo',
    email: 'inventory@cobos.zw',
    phone: '+263 78 456 7890',
    role: 'inventory_manager',
    organisationId: 'org_default',
    authProvider: 'clerk_email',
  },
];

const AUTH_STORAGE_KEY = 'cobos_active_session_user';

export class AuthService {
  /**
   * Initializes users in Dexie if empty
   */
  static async init() {
    const count = await db.users.count();
    if (count === 0) {
      await db.users.bulkPut(SEED_USERS);
    }
  }

  /**
   * Get currently active session user from localStorage or fallback to default Owner
   */
  static getActiveSessionUser(): User {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        // Fallback
      }
    }
    return SEED_USERS[0]; // Comfort Ncube (Owner)
  }

  /**
   * Store active session
   */
  static setActiveSessionUser(user: User) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    }
  }

  /**
   * Clear session (Logout)
   */
  static clearSession() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }

  /**
   * Sign In via Phone OR Email and Password
   */
  static async signIn(identifier: string, password: string): Promise<User> {
    await this.init();
    const { email, rawPhone, isPhone } = normalizePhoneToCobosEmail(identifier);

    // Look up by converted @cobos.zw email OR by raw phone OR direct email
    let user = await db.users.where('email').equalsIgnoreCase(email).first();

    if (!user && isPhone) {
      const allUsers = await db.users.toArray();
      user = allUsers.find(
        (u) =>
          u.phone &&
          u.phone.replace(/\D/g, '') === rawPhone.replace(/\D/g, '')
      );
    }

    if (!user) {
      // If user doesn't exist yet, auto-provision user to support frictionless onboarding
      const displayName = isPhone ? `User ${rawPhone}` : identifier.split('@')[0];
      user = {
        id: 'usr_' + generateUUID(),
        name: displayName,
        email,
        phone: isPhone ? rawPhone : undefined,
        role: 'owner',
        organisationId: 'org_default',
        authProvider: isPhone ? 'clerk_phone' : 'clerk_email',
      };
      await db.users.put(user);
      await queueSyncItem('user' as any, user.id, 'INSERT', user);
    }

    this.setActiveSessionUser(user);
    return user;
  }

  /**
   * Sign Up with Phone & Password (converts phone to ${phone}@cobos.zw in database)
   */
  static async signUpWithPhone(params: {
    fullName: string;
    phone: string;
    password: string;
    role: UserRole;
  }): Promise<{ user: User; convertedEmail: string }> {
    await this.init();
    const { email, rawPhone } = normalizePhoneToCobosEmail(params.phone);

    const newUser: User = {
      id: 'usr_' + generateUUID(),
      name: params.fullName.trim(),
      email, // Converted into phone@cobos.zw in database
      phone: rawPhone,
      role: params.role || 'owner',
      organisationId: 'org_default',
      authProvider: 'clerk_phone',
    };

    await db.users.put(newUser);
    await queueSyncItem('user' as any, newUser.id, 'INSERT', newUser);
    this.setActiveSessionUser(newUser);

    return { user: newUser, convertedEmail: email };
  }

  /**
   * Sign Up with Email & Password
   */
  static async signUpWithEmail(params: {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
  }): Promise<User> {
    await this.init();
    const cleanEmail = params.email.trim().toLowerCase();

    const newUser: User = {
      id: 'usr_' + generateUUID(),
      name: params.fullName.trim(),
      email: cleanEmail,
      role: params.role || 'owner',
      organisationId: 'org_default',
      authProvider: 'clerk_email',
    };

    await db.users.put(newUser);
    await queueSyncItem('user' as any, newUser.id, 'INSERT', newUser);
    this.setActiveSessionUser(newUser);

    return newUser;
  }

  /**
   * Google Social Login
   */
  static async signInWithGoogle(customProfile?: { name: string; email: string; avatarUrl?: string }): Promise<User> {
    await this.init();
    const email = customProfile?.email || 'comfort.designszw@gmail.com';
    const name = customProfile?.name || 'Comfort Ncube (Google Account)';

    let user = await db.users.where('email').equalsIgnoreCase(email).first();

    if (!user) {
      user = {
        id: 'usr_' + generateUUID(),
        name,
        email,
        role: 'owner',
        organisationId: 'org_default',
        authProvider: 'clerk_google',
        avatarUrl: customProfile?.avatarUrl,
      };
      await db.users.put(user);
      await queueSyncItem('user' as any, user.id, 'INSERT', user);
    }

    this.setActiveSessionUser(user);
    return user;
  }
}
