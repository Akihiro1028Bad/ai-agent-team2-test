// ログイン処理
// 修正: APIレスポンスが undefined / null の場合に .token アクセスで TypeError が発生していたバグを修正。
//       callLoginApi が失敗時に例外をスローするようになったため、try/catch でエラーを捕捉し、
//       ガード節によって response および response.token の存在を確認してからアクセスする。

import { callLoginApi } from '../api/client';
import { LoginRequest, LoginResponse } from '../types/auth';

export interface LoginResult {
  success: boolean;
  token?: string;
  errorMessage?: string;
}

/**
 * メールアドレスとパスワードでログインを行う。
 * APIレスポンスが不正な場合や通信エラー時も安全に処理し、
 * TypeError: Cannot read property 'token' of undefined が発生しないようにする。
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const request: LoginRequest = { email, password };

  let response: LoginResponse;

  try {
    response = await callLoginApi(request);
  } catch (error) {
    // ネットワークエラー・HTTPエラー時のハンドリング
    const message = error instanceof Error ? error.message : 'ログイン中に予期しないエラーが発生しました。';
    return { success: false, errorMessage: message };
  }

  // --- ここが修正箇所 (L42相当) ---
  // 修正前: const token = response.token;  // response が undefined の場合に TypeError
  // 修正後: response および token の存在をガード節で確認してからアクセスする

  if (!response || !response.token) {
    return {
      success: false,
      errorMessage: 'ログインAPIから有効なトークンが返されませんでした。',
    };
  }

  const token = response.token;

  return { success: true, token };
}
