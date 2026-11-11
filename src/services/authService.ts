import { db } from '../db/cobosDb';
import { generateUUID, queueSyncItem } from './accountingEngine';
import type { User, UserRole } from '../types';

/**
 * Normalizes phone number input into the required @cobos.zw email format
 * E.g., "+263 77 282 4132" or "0772824132" -> "263772824132@cobos.zw"
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
  // In Zimbabwe, mobile numbers starting with 0 (e.g. 0772824132) map to 263772824132
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

export const ADMIN_EMAIL = 'comfort.designszw@gmail.com';

// Clean production administrator user
export const INITIAL_ADMIN_USER: User = {
  id: 'usr_admin_comfort',
  name: 'Comfort Ncube',
  email: ADMIN_EMAIL,
  phone: '+263 77 282 4132',
  role: 'owner',
  organisationId: 'org_default',
  authProvider: 'clerk_email',
};

const AUTH_STORAGE_KEY = 'cobos_active_session_user';

export class AuthService {
  /**
   * Initializes users table with Admin if empty
   */
  static async init() {
    const existingAdmin = await db.users.where('email').equalsIgnoreCase(ADMIN_EMAIL).first();
    if (!existingAdmin) {
      await db.users.put(INITIAL_ADMIN_USER);
    }
  }

  /**
   * Get currently active session user from localStorage or fallback to Comfort Ncube (Admin)
   */
  static getActiveSessionUser(): User {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.email) {
            // Ensure comfort.designszw@gmail.com is strictly an Admin/Owner
            if (parsed.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
              parsed.role = 'owner';
            }
            return parsed;
          }
        }
      } catch (e) {
        // Fallback
      }
    }
    return INITIAL_ADMIN_USER;
  }

  /**
   * Store active session
   */
  static setActiveSessionUser(user: User) {
    if (typeof window !== 'undefined') {
      // Comfort's email is guaranteed Admin
      if (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        user.role = 'owner';
      }
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
  static async signIn(identifier: string, _password?: string): Promise<User> {
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
      // If user doesn't exist yet, provision account cleanly
      const isComfortAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      const displayName = isComfortAdmin
        ? 'Comfort Ncube'
        : isPhone
        ? `User ${rawPhone}`
        : identifier.split('@')[0];

      user = {
        id: 'usr_' + generateUUID(),
        name: displayName,
        email,
        phone: isPhone ? rawPhone : undefined,
        role: isComfortAdmin ? 'owner' : 'cashier',
        organisationId: 'org_default',
        authProvider: isPhone ? 'clerk_phone' : 'clerk_email',
      };
      await db.users.put(user);
      await queueSyncItem('user' as any, user.id, 'INSERT', user);
    }

    // Guarantee admin role for comfort.designszw@gmail.com
    if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      user.role = 'owner';
      await db.users.update(user.id, { role: 'owner' });
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
      email, // Normalized phone email format in database
      phone: rawPhone,
      role: params.role || 'cashier',
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
    const isComfortAdmin = cleanEmail === ADMIN_EMAIL.toLowerCase();

    const newUser: User = {
      id: 'usr_' + generateUUID(),
      name: params.fullName.trim(),
      email: cleanEmail,
      role: isComfortAdmin ? 'owner' : params.role || 'cashier',
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
    const email = customProfile?.email || ADMIN_EMAIL;
    const isComfortAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const name = customProfile?.name || (isComfortAdmin ? 'Comfort Ncube' : email.split('@')[0]);

    let user = await db.users.where('email').equalsIgnoreCase(email).first();

    if (!user) {
      user = {
        id: 'usr_' + generateUUID(),
        name,
        email,
        role: isComfortAdmin ? 'owner' : 'cashier',
        organisationId: 'org_default',
        authProvider: 'clerk_google',
        avatarUrl: customProfile?.avatarUrl,
      };
      await db.users.put(user);
      await queueSyncItem('user' as any, user.id, 'INSERT', user);
    } else if (isComfortAdmin && user.role !== 'owner') {
      user.role = 'owner';
      await db.users.update(user.id, { role: 'owner' });
    }

    this.setActiveSessionUser(user);
    return user;
  }
}
