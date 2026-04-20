export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: Date | string;
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

/**
 * ユーザー検索結果
 */
export interface UserSearchResult {
  users: User[];
  totalCount: number;
  isFiltered: boolean;
}
