import { createServiceClient } from './supabase';
import { User, UserRole } from '@/types';
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret');
const JWT_EXPIRY = '24h';

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export async function createToken(user: User): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    store_id: user.store_id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  store_id: string;
} | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as {
      sub: string;
      email: string;
      name: string;
      role: UserRole;
      store_id: string;
    };
  } catch {
    return null;
  }
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const supabase = createServiceClient();
  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from('users')
    .select('*, store:stores(*)')
    .eq('email', email)
    .eq('password_hash', passwordHash)
    .single();

  if (error || !data) return null;
  return data as User;
}

export async function getUserFromToken(token: string): Promise<User | null> {
  const payload = await verifyToken(token);
  if (!payload) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('users')
    .select('*, store:stores(*)')
    .eq('id', payload.sub)
    .single();

  if (error || !data) return null;
  return data as User;
}

export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const hierarchy: Record<UserRole, number> = {
    superadmin: 3,
    manager: 2,
    seller: 1,
  };
  return hierarchy[userRole] >= hierarchy[requiredRole];
}

export function canAccessStore(user: User, storeId: string): boolean {
  if (user.role === 'superadmin') return true;
  return user.store_id === storeId;
}
