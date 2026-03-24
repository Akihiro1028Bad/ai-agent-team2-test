// 認証関連の型定義

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * LoginResponse の token は必須フィールドとして定義する。
 * API失敗時はこの型のオブジェクトを返さず、呼び出し元で例外をキャッチする設計とする。
 */
export interface LoginResponse {
  token: string;
  userId: string;
  expiresAt: string;
}

export interface AuthError {
  code: string;
  message: string;
}
