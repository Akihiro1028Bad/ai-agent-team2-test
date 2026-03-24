import type { User } from "../types/user";

/** ユーザーが見つからない場合のエラー (HTTP 404) */
export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`ユーザーが見つかりません (id: ${id})`);
    this.name = "UserNotFoundError";
  }
}

/** APIサーバーエラーの場合のエラー (HTTP 5xx) */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * 指定IDのユーザー情報を取得する
 * @param id ユーザーID
 * @returns ユーザー情報
 * @throws {UserNotFoundError} ユーザーが見つからない場合 (404)
 * @throws {ApiError} サーバーエラーの場合 (5xx)
 */
export async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${encodeURIComponent(id)}`);

  if (response.status === 404) {
    throw new UserNotFoundError(id);
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `サーバーエラーが発生しました (status: ${response.status})`,
    );
  }

  const data: User = await response.json();
  return data;
}
