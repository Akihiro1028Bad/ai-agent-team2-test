import { User, UserProfile } from '../types/user';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

function validateUserId(id: string): void {
  if (!id || id.trim() === '') {
    throw new Error('User ID is required');
  }
}

export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
  return res.json();
}

export async function getUser(id: string): Promise<User> {
  validateUserId(id);
  const res = await fetch(`${API_BASE}/users/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
  return res.json();
}

export async function getUserProfile(id: string): Promise<UserProfile> {
  validateUserId(id);
  const res = await fetch(`${API_BASE}/users/${id}/profile`);
  if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
  return res.json();
}

export async function updateUser(id: string, data: Partial<User>): Promise<User> {
  validateUserId(id);
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update user: ${res.status}`);
  return res.json();
}

export async function updateUserProfile(
  id: string,
  data: Partial<UserProfile>
): Promise<UserProfile> {
  validateUserId(id);
  const res = await fetch(`${API_BASE}/users/${id}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update profile: ${res.status}`);
  return res.json();
}
