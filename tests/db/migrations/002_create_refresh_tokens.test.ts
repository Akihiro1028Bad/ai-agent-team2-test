/**
 * Migration 002 テスト: refresh_tokens テーブル作成
 *
 * テスト戦略:
 *   - up() / down() の SQL 内容を静的検証
 *   - 実DB接続なし（テスト用リポのためモックベース）
 *   - 実際の結合テストは Docker PostgreSQL 環境で行う想定
 *
 * Issue #23
 */

import { describe, it, expect } from 'vitest';
import { migration } from '../../../src/db/migrations/002_create_refresh_tokens';

describe('Migration 002: create_refresh_tokens', () => {
  // ----------------------------------------------------------------
  // メタ情報
  // ----------------------------------------------------------------
  describe('migration name', () => {
    it('正しいマイグレーション名を持つこと', () => {
      expect(migration.name).toBe('002_create_refresh_tokens');
    });
  });

  // ----------------------------------------------------------------
  // up() SQL 検証: テーブル定義
  // ----------------------------------------------------------------
  describe('up SQL - table definition', () => {
    it('up SQL が定義されていること', () => {
      expect(migration.up).toBeTruthy();
    });

    it('refresh_tokens テーブルを CREATE することを含むこと', () => {
      expect(migration.up).toMatch(/CREATE TABLE IF NOT EXISTS refresh_tokens/i);
    });

    it('id は UUID 主キーであること', () => {
      expect(migration.up).toMatch(/id\s+UUID\s+NOT NULL/i);
      expect(migration.up).toMatch(/PRIMARY KEY/i);
    });

    it('id のデフォルトは gen_random_uuid() であること', () => {
      expect(migration.up).toMatch(/DEFAULT gen_random_uuid\(\)/i);
    });

    it('user_id は UUID NOT NULL であること', () => {
      expect(migration.up).toMatch(/user_id\s+UUID\s+NOT NULL/i);
    });

    it('user_id は users(id) への外部キーであること', () => {
      expect(migration.up).toMatch(/REFERENCES users\(id\)/i);
    });

    it('user_id は CASCADE 削除であること', () => {
      expect(migration.up).toMatch(/ON DELETE CASCADE/i);
    });

    it('token_hash は VARCHAR(255) NOT NULL であること', () => {
      expect(migration.up).toMatch(/token_hash\s+VARCHAR\(255\)\s+NOT NULL/i);
    });

    it('expires_at は TIMESTAMPTZ NOT NULL であること', () => {
      expect(migration.up).toMatch(/expires_at\s+TIMESTAMPTZ\s+NOT NULL/i);
    });

    it('revoked_at は TIMESTAMPTZ NULLABLE であること', () => {
      expect(migration.up).toMatch(/revoked_at\s+TIMESTAMPTZ\s+NULL/i);
    });

    it('created_at は TIMESTAMPTZ NOT NULL でデフォルト NOW() であること', () => {
      expect(migration.up).toMatch(/created_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT NOW\(\)/i);
    });

    it('user_agent は TEXT NULLABLE であること', () => {
      expect(migration.up).toMatch(/user_agent\s+TEXT\s+NULL/i);
    });

    it('ip_address は VARCHAR(45) NULLABLE であること（IPv6対応）', () => {
      expect(migration.up).toMatch(/ip_address\s+VARCHAR\(45\)\s+NULL/i);
    });
  });

  // ----------------------------------------------------------------
  // up() SQL 検証: インデックス
  // ----------------------------------------------------------------
  describe('up SQL - indexes', () => {
    it('token_hash のインデックスを作成すること', () => {
      expect(migration.up).toMatch(/CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash/i);
      expect(migration.up).toMatch(/ON refresh_tokens \(token_hash\)/i);
    });

    it('user_id のインデックスを作成すること', () => {
      expect(migration.up).toMatch(/CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id/i);
      expect(migration.up).toMatch(/ON refresh_tokens \(user_id\)/i);
    });

    it('べき等性のため IF NOT EXISTS を使用していること', () => {
      expect(migration.up).toMatch(/CREATE TABLE IF NOT EXISTS/i);
      // インデックスも IF NOT EXISTS
      const ifNotExistsCount = (migration.up.match(/IF NOT EXISTS/gi) ?? []).length;
      expect(ifNotExistsCount).toBeGreaterThanOrEqual(3); // table + 2 indexes
    });
  });

  // ----------------------------------------------------------------
  // down() SQL 検証
  // ----------------------------------------------------------------
  describe('down SQL', () => {
    it('down SQL が定義されていること', () => {
      expect(migration.down).toBeTruthy();
    });

    it('refresh_tokens テーブルを DROP すること', () => {
      expect(migration.down).toMatch(/DROP TABLE IF EXISTS refresh_tokens/i);
    });

    it('テーブル DROP で関連インデックスも削除されること（インデックス個別 DROP 不要）', () => {
      // テーブルを DROP すればインデックスは自動削除される
      // down SQL に idx_ 系の明示的 DROP がなくてよい
      expect(migration.down).not.toMatch(/DROP INDEX/i);
    });
  });

  // ----------------------------------------------------------------
  // up/down の対称性
  // ----------------------------------------------------------------
  describe('up/down symmetry', () => {
    it('up で作成したテーブルは down でも削除されること', () => {
      expect(migration.up).toMatch(/refresh_tokens/i);
      expect(migration.down).toMatch(/refresh_tokens/i);
    });
  });

  // ----------------------------------------------------------------
  // セキュリティ設計の検証
  // ----------------------------------------------------------------
  describe('security design', () => {
    it('トークン平文保存フィールドが存在しないこと（token カラムなし）', () => {
      // token_hash のみが存在し、token という単独カラムがないことを確認
      expect(migration.up).not.toMatch(/\btoken\b\s+VARCHAR/i);
      expect(migration.up).not.toMatch(/\btoken\b\s+TEXT/i);
    });

    it('token_hash カラムが存在すること', () => {
      expect(migration.up).toMatch(/token_hash/i);
    });
  });
});
