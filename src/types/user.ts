/**
 * ユーザー情報の型定義
 * GET /api/users/:id のレスポンスに対応する
 */
export interface User {
  /** ユーザーの一意識別子 */
  id: string;
  /** 表示名 / ユーザー名 */
  name: string;
  /** メールアドレス */
  email: string;
  /** アバター画像 URL */
  avatarUrl: string;
  /** 自己紹介文 */
  bio: string;
}
