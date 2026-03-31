export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: Date;
}

export interface UserProfile extends User {
  bio?: string;
  location?: string;
  website?: string;
}

export interface UserProfileUpdateInput {
  bio?: string;
  location?: string;
  website?: string;
}
