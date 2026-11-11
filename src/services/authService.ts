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

/**
 * Password validation rules:
 * - More than 8 characters (at least 9)
 * - Mixed with letters, numbers, and special characters
 */
export interface PasswordValidationResult {
  isValid: boolean;
  hasMinLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  errors: string[];
}

export function validatePasswordRules(password: string): PasswordValidationResult {
  const clean = password || '';
  const hasMinLength = clean.length > 8;
  const hasLetter = /[a-zA-Z]/.test(clean);
  const hasNumber = /[0-9]/.test(clean);
  const hasSpecial = /[^a-zA-Z0-9]/.test(clean);

  const errors: string[] = [];
  if (!hasMinLength) errors.push('Password must be more than 8 characters');
  if (!hasLetter) errors.push('Password must contain letters');
  if (!hasNumber) errors.push('Password must contain numbers');
  if (!hasSpecial) errors.push('Password must contain special characters (!@#$%...)');

  return {
    isValid: hasMinLength && hasLetter && hasNumber && hasSpecial,
    hasMinLength,
    hasLetter,
    hasNumber,
    hasSpecial,
    errors,
  };
}

/**
 * SHA-256 secure hash for passwords.
 */
export async function hashUserPassword(password: string): Promise<string> {
  const clean = password.trim();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`cobos_sec_v2_salt_${clean}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return 'pw_' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'pw_fb_' + Math.abs(hash).toString(16);
}

/**
 * SHA-256 secure hash for user authorization PINs (legacy support).
 */
export async function hashUserPin(pin: string): Promise<string> {
  const cleanPin = pin.trim();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`cobos_salt_${cleanPin}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < cleanPin.length; i++) {
    const char = cleanPin.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(16) + '_sec';
}

export const SUPER_ADMIN_EMAIL = 'comfort.designszw@gmail.com';
export const SUPER_ADMIN_NAME = 'Munyaradzi Muchineripi';

// True Super Administrator Account
export const INITIAL_SUPER_ADMIN_USER: User = {
  id: 'usr_super_admin_munyaradzi',
  name: SUPER_ADMIN_NAME,
  email: SUPER_ADMIN_EMAIL,
  phone: '+263 77 282 4132',
  role: 'super_admin',
  organisationId: 'org_master',
  authProvider: 'clerk_email',
  subscriptionPlan: 'enterprise',
  createdAt: '2026-01-01T00:00:00Z',
};

const AUTH_STORAGE_KEY = 'cobos_active_session_user';

export class AuthService {
  /**
   * Initializes users table with Super Admin if empty
   */
  static async init() {
    const existingSuperAdmin = await db.users.where('email').equalsIgnoreCase(SUPER_ADMIN_EMAIL).first();
    if (!existingSuperAdmin) {
      await db.users.put(INITIAL_SUPER_ADMIN_USER);
      await queueSyncItem('user', INITIAL_SUPER_ADMIN_USER.id, 'INSERT', INITIAL_SUPER_ADMIN_USER);
    } else if (existingSuperAdmin.role !== 'super_admin' || existingSuperAdmin.name !== SUPER_ADMIN_NAME) {
      await db.users.update(existingSuperAdmin.id, {
        role: 'super_admin',
        name: SUPER_ADMIN_NAME,
      });
    }
  }

  /**
   * Get currently active session user from localStorage or return null if unauthenticated.
   * By default, no user or account is logged in automatically without explicit verification.
   */
  static getActiveSessionUser(): User | null {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed: User = JSON.parse(stored);
          if (parsed && parsed.email) {
            if (parsed.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
              parsed.role = 'super_admin';
              parsed.name = SUPER_ADMIN_NAME;
            }
            return parsed;
          }
        }
      } catch (e) {
        // Fallback
      }
    }
    return null;
  }

  /**
   * Store active session and enforce Super Admin guarantee
   */
  static setActiveSessionUser(user: User) {
    if (typeof window !== 'undefined') {
      if (user.email && user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        user.role = 'super_admin';
        user.name = SUPER_ADMIN_NAME;
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
   * Sign In via Phone OR Email with Password verification
   */
  static async signIn(identifier: string, password: string): Promise<User> {
    await this.init();
    if (!password || password.trim().length === 0) {
      throw new Error('Please enter your password to authorize access.');
    }

    const { email, rawPhone, isPhone } = normalizePhoneToCobosEmail(identifier);
    const passwordHash = await hashUserPassword(password);

    // Look up existing user in database
    let user = await db.users.where('email').equalsIgnoreCase(email).first();

    if (!user && isPhone) {
      const allUsers = await db.users.toArray();
      user = allUsers.find(
        (u) =>
          u.phone &&
          u.phone.replace(/\D/g, '') === rawPhone.replace(/\D/g, '')
      );
    }

    if (user) {
      // If user has a passwordHash configured, verify it
      if (user.passwordHash) {
        if (user.passwordHash !== passwordHash) {
          throw new Error('Incorrect password. Please verify your credentials.');
        }
      } else {
        // First login with password: check complexity rules and set passwordHash
        const validation = validatePasswordRules(password);
        if (!validation.isValid) {
          throw new Error(validation.errors[0] || 'Password does not meet required security complexity.');
        }
        user.passwordHash = passwordHash;
        await db.users.update(user.id, { passwordHash });
        await queueSyncItem('user', user.id, 'UPDATE', user);
      }
    } else {
      // User doesn't exist yet: Check password rules then auto-provision
      const validation = validatePasswordRules(password);
      if (!validation.isValid) {
        throw new Error(validation.errors[0] || 'Password must be more than 8 characters mixed with letters, numbers, and symbols.');
      }

      const isSuperAdmin = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
      const displayName = isSuperAdmin
        ? SUPER_ADMIN_NAME
        : isPhone
        ? `Staff ${rawPhone.slice(-4)}`
        : identifier.split('@')[0];

      user = {
        id: 'usr_' + generateUUID(),
        name: displayName,
        email,
        phone: isPhone ? rawPhone : undefined,
        role: isSuperAdmin ? 'super_admin' : 'cashier',
        organisationId: isSuperAdmin ? 'org_master' : 'org_default',
        authProvider: isPhone ? 'clerk_phone' : 'clerk_email',
        subscriptionPlan: isSuperAdmin ? 'enterprise' : 'standard',
        passwordHash,
        createdAt: new Date().toISOString(),
      };
      await db.users.put(user);
      await queueSyncItem('user', user.id, 'INSERT', user);
    }

    // Guarantee super admin role
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      user.role = 'super_admin';
      user.name = SUPER_ADMIN_NAME;
      await db.users.update(user.id, { role: 'super_admin', name: SUPER_ADMIN_NAME });
    }

    this.setActiveSessionUser(user);
    return user;
  }

  /**
   * Sign Up with Phone & Required Password
   */
  static async signUpWithPhone(params: {
    fullName: string;
    phone: string;
    password: string;
    role: UserRole;
  }): Promise<{ user: User; convertedEmail: string }> {
    await this.init();
    const validation = validatePasswordRules(params.password);
    if (!validation.isValid) {
      throw new Error(validation.errors[0] || 'Password must be more than 8 characters mixed with numbers, letters, and special characters.');
    }

    const { email, rawPhone } = normalizePhoneToCobosEmail(params.phone);
    const isSuperAdmin = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const passwordHash = await hashUserPassword(params.password);

    // Prevent unauthorized super_admin claims
    const allowedRole: UserRole = isSuperAdmin 
      ? 'super_admin' 
      : params.role === 'super_admin' 
      ? 'manager' 
      : params.role || 'cashier';

    const newUser: User = {
      id: 'usr_' + generateUUID(),
      name: isSuperAdmin ? SUPER_ADMIN_NAME : params.fullName.trim(),
      email,
      phone: rawPhone,
      role: allowedRole,
      organisationId: isSuperAdmin ? 'org_master' : 'org_default',
      authProvider: 'clerk_phone',
      subscriptionPlan: isSuperAdmin ? 'enterprise' : 'standard',
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    await db.users.put(newUser);
    await queueSyncItem('user', newUser.id, 'INSERT', newUser);
    this.setActiveSessionUser(newUser);

    return { user: newUser, convertedEmail: email };
  }

  /**
   * Sign Up with Email & Required Password
   */
  static async signUpWithEmail(params: {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
  }): Promise<User> {
    await this.init();
    const validation = validatePasswordRules(params.password);
    if (!validation.isValid) {
      throw new Error(validation.errors[0] || 'Password must be more than 8 characters mixed with numbers, letters, and special characters.');
    }

    const cleanEmail = params.email.trim().toLowerCase();
    const isSuperAdmin = cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase();
    const passwordHash = await hashUserPassword(params.password);

    const allowedRole: UserRole = isSuperAdmin 
      ? 'super_admin' 
      : params.role === 'super_admin' 
      ? 'manager' 
      : params.role || 'cashier';

    const newUser: User = {
      id: 'usr_' + generateUUID(),
      name: isSuperAdmin ? SUPER_ADMIN_NAME : params.fullName.trim(),
      email: cleanEmail,
      role: allowedRole,
      organisationId: isSuperAdmin ? 'org_master' : 'org_default',
      authProvider: 'clerk_email',
      subscriptionPlan: isSuperAdmin ? 'enterprise' : 'standard',
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    await db.users.put(newUser);
    await queueSyncItem('user', newUser.id, 'INSERT', newUser);
    this.setActiveSessionUser(newUser);

    return newUser;
  }

  /**
   * Google Social Login: Authenticates and verifies confirmed Google account profile
   */
  static async signInWithGoogle(verifiedProfile: { name: string; email: string; avatarUrl?: string }): Promise<User> {
    await this.init();
    if (!verifiedProfile || !verifiedProfile.email || !verifiedProfile.email.trim()) {
      throw new Error('A verified Google account is required to sign in.');
    }

    const email = verifiedProfile.email.trim().toLowerCase();
    const isSuperAdmin = email === SUPER_ADMIN_EMAIL.toLowerCase();
    const name = isSuperAdmin ? SUPER_ADMIN_NAME : (verifiedProfile.name?.trim() || email.split('@')[0]);

    // Verify against existing user in database
    let user = await db.users.where('email').equalsIgnoreCase(email).first();

    if (!user) {
      user = {
        id: 'usr_' + generateUUID(),
        name,
        email,
        role: isSuperAdmin ? 'super_admin' : 'cashier',
        organisationId: isSuperAdmin ? 'org_master' : 'org_default',
        authProvider: 'clerk_google',
        avatarUrl: verifiedProfile.avatarUrl,
        subscriptionPlan: isSuperAdmin ? 'enterprise' : 'standard',
        createdAt: new Date().toISOString(),
      };
      await db.users.put(user);
      await queueSyncItem('user', user.id, 'INSERT', user);
    } else {
      // Verified in database, update profile details if changed
      let hasUpdates = false;
      if (verifiedProfile.avatarUrl && user.avatarUrl !== verifiedProfile.avatarUrl) {
        user.avatarUrl = verifiedProfile.avatarUrl;
        hasUpdates = true;
      }
      if (isSuperAdmin && user.role !== 'super_admin') {
        user.role = 'super_admin';
        user.name = SUPER_ADMIN_NAME;
        hasUpdates = true;
      }
      if (hasUpdates) {
        await db.users.put(user);
        await queueSyncItem('user', user.id, 'UPDATE', user);
      }
    }

    this.setActiveSessionUser(user);
    return user;
  }
}

