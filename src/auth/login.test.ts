/**
 * src/auth/login.ts の再現テスト
 *
 * テスト方針（修正方針より）:
 *  - 再現テスト  : 誤った認証情報でログインしてもクラッシュしないこと
 *  - 正常系テスト: 正しい認証情報でログインしトークンが返ること
 *  - ネットワーク異常テスト: ネットワーク障害時もアプリがクラッシュしないこと
 *  - リグレッションテスト: callLoginApi のモック差し替えによる影響確認
 */

import { login } from './login';
import * as client from '../api/client';

// callLoginApi をモック化して外部通信なしにテストする
jest.mock('../api/client');
const mockCallLoginApi = client.callLoginApi as jest.MockedFunction<typeof client.callLoginApi>;

describe('login()', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  // -----------------------------------------------------------------------
  // 再現テスト: 修正前は response が undefined のとき TypeError が発生していた
  // -----------------------------------------------------------------------
  describe('再現テスト: APIがエラーを返す場合', () => {
    it('認証失敗（401相当）のとき TypeError をスローせず失敗結果を返す', async () => {
      mockCallLoginApi.mockRejectedValue(new Error('ログインAPIエラー: HTTP 401 Unauthorized'));

      const result = await login('wrong@example.com', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.errorMessage).toMatch(/401/);
      expect(result.token).toBeUndefined();
    });

    it('サーバーエラー（500相当）のとき TypeError をスローせず失敗結果を返す', async () => {
      mockCallLoginApi.mockRejectedValue(new Error('ログインAPIエラー: HTTP 500 Internal Server Error'));

      const result = await login('user@example.com', 'password');

      expect(result.success).toBe(false);
      expect(result.errorMessage).toMatch(/500/);
    });

    it('APIが token のない空オブジェクトを返した場合も TypeError をスローしない', async () => {
      // 型エラーを回避しつつ、実行時に token が欠落している状況を再現する
      mockCallLoginApi.mockResolvedValue({ token: '', userId: 'u1', expiresAt: '' });

      const result = await login('user@example.com', 'password');

      // token が空文字（falsy）の場合もガード節で弾かれること
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('有効なトークン');
    });
  });

  // -----------------------------------------------------------------------
  // ネットワーク異常テスト
  // -----------------------------------------------------------------------
  describe('ネットワーク異常テスト', () => {
    it('ネットワーク障害時にアプリがクラッシュせず適切なエラーメッセージを返す', async () => {
      mockCallLoginApi.mockRejectedValue(new Error('ネットワークエラーが発生しました: Failed to fetch'));

      const result = await login('user@example.com', 'password');

      expect(result.success).toBe(false);
      expect(result.errorMessage).toMatch(/ネットワーク/);
    });

    it('非 Error オブジェクトがスローされた場合もクラッシュしない', async () => {
      mockCallLoginApi.mockRejectedValue('unexpected string error');

      const result = await login('user@example.com', 'password');

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 正常系テスト
  // -----------------------------------------------------------------------
  describe('正常系テスト', () => {
    it('正しい認証情報でログインするとトークンを含む成功結果を返す', async () => {
      mockCallLoginApi.mockResolvedValue({
        token: 'valid-jwt-token',
        userId: 'user-123',
        expiresAt: '2026-12-31T23:59:59Z',
      });

      const result = await login('user@example.com', 'correctpassword');

      expect(result.success).toBe(true);
      expect(result.token).toBe('valid-jwt-token');
      expect(result.errorMessage).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // リグレッションテスト: callLoginApi の引数が正しく渡されているか
  // -----------------------------------------------------------------------
  describe('リグレッションテスト', () => {
    it('login() が callLoginApi に正しい email と password を渡す', async () => {
      mockCallLoginApi.mockResolvedValue({
        token: 'tok',
        userId: 'u1',
        expiresAt: '2026-01-01T00:00:00Z',
      });

      await login('test@example.com', 'mypassword');

      expect(mockCallLoginApi).toHaveBeenCalledTimes(1);
      expect(mockCallLoginApi).toHaveBeenCalledWith({ email: 'test@example.com', password: 'mypassword' });
    });
  });
});
