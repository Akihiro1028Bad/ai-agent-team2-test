/**
 * JWT 発行・検証ロジック
 * Issue #24: JWT発行・検証ロジック実装
 *
 * 依存ライブラリ: jsonwebtoken
 */

import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import type {
  AccessTokenInput,
  AccessTokenPayload,
  RefreshTokenInput,
  RefreshTokenPayload,
  JwtVerifyResult,
  SignOptions,
} from '../types/jwt';

// ─── 定数 ────────────────────────────────────────────────────

/** アクセストークンのデフォルト有効期限 */
const ACCESS_TOKEN_EXPIRES_IN = '15m';

/** リフレッシュトークンのデフォルト有効期限 */
const REFRESH_TOKEN_EXPIRES_IN = '7d';

/** 使用するアルゴリズム（アルゴリズム混同攻撃対策のため明示） */
const JWT_ALGORITHM = 'HS256' as const;

// ─── シークレット取得 ────────────────────────────────────────

/**
 * 環境変数から JWT シークレットを取得する。
 * 未設定の場合は起動時に例外をスローする。
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      '[JWT] JWT_SECRET が環境変数に設定されていません。' +
      '本番環境では 256bit 以上の安全なランダム文字列を設定してください。',
    );
  }
  return secret;
}

// ─── 発行関数 ────────────────────────────────────────────────

/**
 * アクセストークンを発行する。
 *
 * @param input - ペイロード入力（sub: User UUID, email: メールアドレス）
 * @param options - 発行オプション（有効期限の上書きなど）
 * @returns 署名済み JWT 文字列
 *
 * @example
 * ```ts
 * const token = signAccessToken({ sub: user.id, email: user.email });
 * ```
 */
export function signAccessToken(input: AccessTokenInput, options?: SignOptions): string {
  const secret = getJwtSecret();
  const payload = {
    sub: input.sub,
    email: input.email,
    type: 'access' as const,
  };

  return jwt.sign(payload, secret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: options?.expiresIn ?? ACCESS_TOKEN_EXPIRES_IN,
  });
}

/**
 * リフレッシュトークンを発行する。
 *
 * @param input - ペイロード入力（sub: User UUID, jti: DB の refresh_tokens.id）
 * @param options - 発行オプション（有効期限の上書きなど）
 * @returns 署名済み JWT 文字列
 *
 * @example
 * ```ts
 * const token = signRefreshToken({ sub: user.id, jti: refreshTokenRecord.id });
 * ```
 */
export function signRefreshToken(input: RefreshTokenInput, options?: SignOptions): string {
  const secret = getJwtSecret();
  const payload = {
    sub: input.sub,
    jti: input.jti,
    type: 'refresh' as const,
  };

  return jwt.sign(payload, secret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: options?.expiresIn ?? REFRESH_TOKEN_EXPIRES_IN,
  });
}

// ─── 検証関数 ────────────────────────────────────────────────

/**
 * アクセストークンを検証する。
 * 例外はスローせず、`JwtVerifyResult` として結果を返す。
 *
 * @param token - 検証対象の JWT 文字列
 * @returns 検証結果（成功時: payload, 失敗時: reason）
 *
 * @example
 * ```ts
 * const result = verifyAccessToken(bearerToken);
 * if (!result.success) {
 *   if (result.reason === 'expired') { ... }
 *   return res.status(401).json({ error: 'Unauthorized' });
 * }
 * const { sub, email } = result.payload;
 * ```
 */
export function verifyAccessToken(token: string): JwtVerifyResult<AccessTokenPayload> {
  return verifyToken<AccessTokenPayload>(token, 'access');
}

/**
 * リフレッシュトークンを検証する。
 * 例外はスローせず、`JwtVerifyResult` として結果を返す。
 *
 * @param token - 検証対象の JWT 文字列
 * @returns 検証結果（成功時: payload, 失敗時: reason）
 */
export function verifyRefreshToken(token: string): JwtVerifyResult<RefreshTokenPayload> {
  return verifyToken<RefreshTokenPayload>(token, 'refresh');
}

// ─── ユーティリティ ──────────────────────────────────────────

/**
 * 署名検証なしでトークンをデコードする。
 * ログ出力・デバッグ目的専用。認証判定には使用しないこと。
 *
 * @param token - JWT 文字列
 * @returns デコード済みペイロード（デコード失敗時は null）
 */
export function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const decoded = jwt.decode(token);
    if (decoded && typeof decoded === 'object') {
      return decoded as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * アクセストークンの有効期限（秒）を返す。
 * テスト・設定確認用。
 */
export function getAccessTokenExpiresIn(): string {
  return ACCESS_TOKEN_EXPIRES_IN;
}

/**
 * リフレッシュトークンの有効期限（秒）を返す。
 * テスト・設定確認用。
 */
export function getRefreshTokenExpiresIn(): string {
  return REFRESH_TOKEN_EXPIRES_IN;
}

// ─── 内部ヘルパー ────────────────────────────────────────────

/**
 * JWT を検証し、`type` クレームによる種別チェックも行う内部汎用関数。
 *
 * @param token - JWT 文字列
 * @param expectedType - 期待するトークン種別 ('access' | 'refresh')
 * @returns 検証結果
 */
function verifyToken<T extends { type: string }>(
  token: string,
  expectedType: 'access' | 'refresh',
): JwtVerifyResult<T> {
  const secret = getJwtSecret();

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: [JWT_ALGORITHM],
    }) as T;

    // type クレームの種別チェック
    if (decoded.type !== expectedType) {
      return { success: false, reason: 'wrong_type' };
    }

    return { success: true, payload: decoded };
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return { success: false, reason: 'expired' };
    }
    if (err instanceof JsonWebTokenError) {
      return { success: false, reason: 'invalid' };
    }
    // 予期しないエラーは invalid として扱う
    return { success: false, reason: 'invalid' };
  }
}
