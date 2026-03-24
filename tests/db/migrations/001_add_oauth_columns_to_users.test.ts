/**
 * Migration 001 テスト: users テーブルへの OAuth カラム追加
 *
 * テスト戦略:
 *   - up() / down() の SQL 内容を静的検証
 *   - 実DB接続なし（テスト用リポのためモックベース）
 *   - 実際の結合テストは Docker PostgreSQL 環境で行う想定
 *
 * Issue #23
 */

import { describe, it, expect } from 'vitest';
import { migration } from '../../../src/db/migrations/001_add_oauth_columns_to_users';

describe('Migration 001: add_oauth_columns_to_users', () => {
  // ----------------------------------------------------------------
  // メタ情報
  // ----------------------------------------------------------------
  describe('migration name', () => {
    it('正しいマイグレーション名を持つこと', () => {
      expect(migration.name).toBe('001_add_oauth_columns_to_users');
    });
  });

  // ----------------------------------------------------------------
  // up() SQL 検証
  // ----------------------------------------------------------------
  describe('up SQL', () => {
    it('up SQL が定義されていること', () => {
      expect(migration.up).toBeTruthy();
    });

    it('oauth_provider カラムの追加文を含むこと', () => {
      expect(migration.up).toMatch(/ADD COLUMN IF NOT EXISTS oauth_provider/i);
    });

    it('oauth_provider は VARCHAR(50) NULLABLE であること', () => {
      expect(migration.up).toMatch(/oauth_provider\s+VARCHAR\(50\)\s+NULL/i);
    });

    it('oauth_id カラムの追加文を含むこと', () => {
      expect(migration.up).toMatch(/ADD COLUMN IF NOT EXISTS oauth_id/i);
    });

    it('oauth_id は VARCHAR(255) NULLABLE であること', () => {
      expect(migration.up).toMatch(/oauth_id\s+VARCHAR\(255\)\s+NULL/i);
    });

    it('(oauth_provider, oauth_id) の複合ユニークインデックスを作成すること', () => {
      expect(migration.up).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_users_oauth/i);
      expect(migration.up).toMatch(/ON users \(oauth_provider, oauth_id\)/i);
    });

    it('ユニークインデックスは部分インデックス（WHERE 句あり）であること', () => {
      expect(migration.up).toMatch(/WHERE oauth_provider IS NOT NULL AND oauth_id IS NOT NULL/i);
    });

    it('べき等性のため IF NOT EXISTS を使用していること', () => {
      expect(migration.up).toMatch(/ADD COLUMN IF NOT EXISTS/i);
      expect(migration.up).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS/i);
    });
  });

  // ----------------------------------------------------------------
  // down() SQL 検証
  // ----------------------------------------------------------------
  describe('down SQL', () => {
    it('down SQL が定義されていること', () => {
      expect(migration.down).toBeTruthy();
    });

    it('uq_users_oauth インデックスを削除すること', () => {
      expect(migration.down).toMatch(/DROP INDEX IF EXISTS uq_users_oauth/i);
    });

    it('oauth_provider カラムを削除すること', () => {
      expect(migration.down).toMatch(/DROP COLUMN IF EXISTS oauth_provider/i);
    });

    it('oauth_id カラムを削除すること', () => {
      expect(migration.down).toMatch(/DROP COLUMN IF EXISTS oauth_id/i);
    });

    it('インデックス削除がカラム削除より先に記述されていること', () => {
      const dropIndexPos = migration.down.indexOf('DROP INDEX');
      const dropColumnPos = migration.down.indexOf('DROP COLUMN');
      expect(dropIndexPos).toBeLessThan(dropColumnPos);
    });
  });

  // ----------------------------------------------------------------
  // up/down の対称性
  // ----------------------------------------------------------------
  describe('up/down symmetry', () => {
    it('up で追加したカラムは down でも削除されること（oauth_provider）', () => {
      expect(migration.up).toMatch(/oauth_provider/i);
      expect(migration.down).toMatch(/oauth_provider/i);
    });

    it('up で追加したカラムは down でも削除されること（oauth_id）', () => {
      expect(migration.up).toMatch(/oauth_id/i);
      expect(migration.down).toMatch(/oauth_id/i);
    });

    it('up で作成したインデックスは down でも削除されること', () => {
      expect(migration.up).toMatch(/uq_users_oauth/i);
      expect(migration.down).toMatch(/uq_users_oauth/i);
    });
  });
});
