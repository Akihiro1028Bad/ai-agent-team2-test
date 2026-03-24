/**
 * JWT 発行・検証ロジックのユニットテスト
 * Issue #24: JWT発行・検証ロジック実装
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  getAccessTokenExpiresIn,
  getRefreshTokenExpiresIn,
} from '../../src/auth/jwt';

// ─── テスト用定数 ────────────────────────────────────────────

const TEST_SECRET = 'test-secret-at-least-256-bits-long-for-hs256-algorithm';

const MOCK_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_EMAIL = 'test@example.com';
const MOCK_JTI = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// ─── セットアップ ────────────────────────────────────────────

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

afterEach(() => {
  delete process.env.JWT_SECRET;
  vi.restoreAllMocks();
});

// ─── signAccessToken ─────────────────────────────────────────

describe('signAccessToken', () => {
  it('有効な JWT 文字列を返す', () => {
    const token = signAccessToken({ sub: MOCK_USER_ID, email: MOCK_EMAIL });

    expect(typeof token).toBe('string');
    // JWT は "header.payload.signature" の3パート構造
    expect(token.split('.')).toHaveLength(3);
  });

  it('ペイロードに sub / email / type="access" が含まれる', () => {
    const token = signAccessToken({ sub: MOCK_USER_ID, email: MOCK_EMAIL });
    const decoded = jwt.verify(token, TEST_SECRET) as Record<string, unknown>;

    expect(decoded.sub).toBe(MOCK_USER_ID);
    expect(decoded.email).toBe(MOCK_EMAIL);
    expect(decoded.type).toBe('access');
  });

  it('ペイロードに iat / exp が含まれる', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = signAccessToken({ sub: MOCK_USER_ID, email: MOCK_EMAIL });
    const after = Math.floor(Date.now() / 1000);

    const decoded = jwt.verify(token, TEST_SECRET) as Record<string, unknown>;

    expect(typeof decoded.iat).toBe('number');
    expect(typeof decoded.exp).toBe('number');
    expect(decoded.iat as number).toBeGreaterThanOrEqual(before);
    expect(decoded.iat as number).toBeLessThanOrEqual(after);
    // デフォルト有効期限 15分 = 900秒
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(900);
  });

  it('options.expiresIn で有効期限を上書きできる', () => {
    const token = signAccessToken(
      { sub: MOCK_USER_ID, email: MOCK_EMAIL },
      { expiresIn: '1h' },
    );
    const decoded = jwt.verify(token, TEST_SECRET) as Record<string, unknown>;
    // 1時間 = 3600秒
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(3600);
  });

  it('JWT_SECRET 未設定時はエラーをスローする', () => {
    delete process.env.JWT_SECRET;
    expect(() => signAccessToken({ sub: MOCK_USER_ID, email: MOCK_EMAIL }))
      .toThrow('JWT_SECRET');
  });
});

// ─── signRefreshToken ────────────────────────────────────────

describe('signRefreshToken', () => {
  it('有効な JWT 文字列を返す', () => {
    const token = signRefreshToken({ sub: MOCK_USER_ID, jti: MOCK_JTI });

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('ペイロードに sub / jti / type="refresh" が含まれる', () => {
    const token = signRefreshToken({ sub: MOCK_USER_ID, jti: MOCK_JTI });
    const decoded = jwt.verify(token, TEST_SECRET) as Record<string, unknown>;

    expect(decoded.sub).toBe(MOCK_USER_ID);
    expect(decoded.jti).toBe(MOCK_JTI);
    expect(decoded.type).toBe('refresh');
  });

  it('デフォルト有効期限は 7日（604800秒）', () => {
    const token = signRefreshToken({ sub: MOCK_USER_ID, jti: MOCK_JTI });
    const decoded = jwt.verify(token, TEST_SECRET) as Record<string, unknown>;
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(7 * 24 * 60 * 60);
  });

  it('JWT_SECRET 未設定時はエラーをスローする', () => {
    delete process.env.JWT_SECRET;
    expect(() => signRefreshToken({ sub: MOCK_USER_ID, jti: MOCK_JTI }))
      .toThrow('JWT_SECRET');
  });
});

// ─── verifyAccessToken ───────────────────────────────────────

describe('verifyAccessToken', () => {
  it('有効なアクセストークンを検証し payload を返す', () => {
    const token = signAccessToken({ sub: MOCK_USER_ID, email: MOCK_EMAIL });
    const result = verifyAccessToken(token);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.payload.sub).toBe(MOCK_USER_ID);
    expect(result.payload.email).toBe(MOCK_EMAIL);
    expect(result.payload.type).toBe('access');
  });

  it('有効期限切れトークンは reason="expired" を返す', () => {
    // 過去に有効期限が切れるトークンを生成
    const token = signAccessToken(
      { sub: MOCK_USER_ID, email: MOCK_EMAIL },
      { expiresIn: -1 }, // -1秒 → 即期限切れ
    );
    const result = verifyAccessToken(token);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe('expired');
  });

  it('改ざんされたトークンは reason="invalid" を返す', () => {
    const token = signAccessToken({ sub: MOCK_USER_ID, email: MOCK_EMAIL });
    const tampered = token.slice(0, -5) + 'XXXXX';
    const result = verifyAccessToken(tampered);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe('invalid');
  });

  it('異なるシークレットで署名されたトークンは reason="invalid" を返す', () => {
    const token = jwt.sign(
      { sub: MOCK_USER_ID, email: MOCK_EMAIL, type: 'access' },
      'different-secret',
      { algorithm: 'HS256', expiresIn: '15m' },
    );
    const result = verifyAccessToken(token);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe('invalid');
  });

  it('リフレッシュトークンをアクセストークンとして検証すると reason="wrong_type" を返す', () => {
    const refreshToken = signRefreshToken({ sub: MOCK_USER_ID, jti: MOCK_JTI });
    const result = verifyAccessToken(refreshToken);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe('wrong_type');
  });

  it('不正な形式の文字列は reason="invalid" を返す', () => {
    const result = verifyAccessToken('not.a.valid.jwt.token');

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe('invalid');
  });
});

// ─── verifyRefreshToken ──────────────────────────────────────

describe('verifyRefreshToken', () => {
  it('有効なリフレッシュトークンを検証し payload を返す', () => {
    const token = signRefreshToken({ sub: MOCK_USER_ID, jti: MOCK_JTI });
    const result = verifyRefreshToken(token);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.payload.sub).toBe(MOCK_USER_ID);
    expect(result.payload.jti).toBe(MOCK_JTI);
    expect(result.payload.type).toBe('refresh');
  });

  it('有効期限切れは reason="expired" を返す', () => {
    const token = signRefreshToken(
      { sub: MOCK_USER_ID, jti: MOCK_JTI },
      { expiresIn: -1 },
    );
    const result = verifyRefreshToken(token);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe('expired');
  });

  it('アクセストークンをリフレッシュトークンとして検証すると reason="wrong_type" を返す', () => {
    const accessToken = signAccessToken({ sub: MOCK_USER_ID, email: MOCK_EMAIL });
    const result = verifyRefreshToken(accessToken);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toBe('wrong_type');
  });
});

// ─── decodeToken ─────────────────────────────────────────────

describe('decodeToken', () => {
  it('署名検証なしでペイロードをデコードできる', () => {
    const token = signAccessToken({ sub: MOCK_USER_ID, email: MOCK_EMAIL });
    const decoded = decodeToken(token);

    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe(MOCK_USER_ID);
    expect(decoded?.email).toBe(MOCK_EMAIL);
    expect(decoded?.type).toBe('access');
  });

  it('異なるシークレットのトークンもデコードできる（署名検証なし）', () => {
    const token = jwt.sign(
      { sub: MOCK_USER_ID, email: MOCK_EMAIL, type: 'access' },
      'completely-different-secret',
      { algorithm: 'HS256' },
    );
    const decoded = decodeToken(token);

    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe(MOCK_USER_ID);
  });

  it('不正な形式の文字列は null を返す', () => {
    const decoded = decodeToken('invalid-token-string');
    expect(decoded).toBeNull();
  });

  it('空文字列は null を返す', () => {
    const decoded = decodeToken('');
    expect(decoded).toBeNull();
  });
});

// ─── getAccessTokenExpiresIn / getRefreshTokenExpiresIn ──────

describe('getAccessTokenExpiresIn', () => {
  it('"15m" を返す', () => {
    expect(getAccessTokenExpiresIn()).toBe('15m');
  });
});

describe('getRefreshTokenExpiresIn', () => {
  it('"7d" を返す', () => {
    expect(getRefreshTokenExpiresIn()).toBe('7d');
  });
});
