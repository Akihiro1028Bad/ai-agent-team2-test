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

/**
 * ユーザー検索パラメータ
 */
export interface SearchParams {
  query: string;
}
