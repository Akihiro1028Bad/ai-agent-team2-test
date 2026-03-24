// APIクライアント
// 修正: APIコール失敗時に undefined を返す代わりに Error をスローするよう変更。
//       呼び出し元が try/catch でエラーを確実に検知できるようにする。

import { LoginRequest, LoginResponse } from '../types/auth';

const API_BASE_URL = process.env.API_BASE_URL ?? 'https://api.example.com';

/**
 * ログインAPIを呼び出す。
 * 成功時は LoginResponse を返す。
 * 失敗時（ネットワークエラー・認証エラー・サーバーエラー等）は Error をスローする。
 *
 * @throws {Error} ネットワークエラーまたはHTTPエラー
 */
export async function callLoginApi(request: LoginRequest): Promise<LoginResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch (networkError) {
    // ネットワーク障害時: undefined を返さず例外をスローする
    throw new Error(
      `ネットワークエラーが発生しました: ${networkError instanceof Error ? networkError.message : String(networkError)}`
    );
  }

  if (!response.ok) {
    // HTTPエラー（4xx / 5xx）時: undefined を返さず例外をスローする
    throw new Error(`ログインAPIエラー: HTTP ${response.status} ${response.statusText}`);
  }

  const data: LoginResponse = await response.json();
  return data;
}
