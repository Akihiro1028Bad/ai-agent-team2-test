export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: Date | string;
  lastLoginAt?: string | null;
}

export interface UserProfile extends User {
  bio?: string;
  location?: string;
  website?: string;
}
