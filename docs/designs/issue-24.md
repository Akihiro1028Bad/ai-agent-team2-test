# [Issue #24] JWT発行・検証ロジック実装

## 概要

JWT（JSON Web Token）を用いたアクセストークンの発行・検証・更新ロジックを実装する。
Issue #23 で設計した `users` / `refresh_tokens` テーブルスキーマおよび型定義を前提とする。

- **親Issue**: #9 (JWT認証実装)
- **優先順位**: 2
- **依存**: #23 (DBスキーマ設計変更) ← 完了済み

---

## 変更ファイル一覧

| ファイルパス | 種別 | 説明 |
|---|---|---|
| `src/types/jwt.ts` | 新規作成 | JWTペイロード・オプション型定義 |
| `src/auth/jwt.ts` | 新規作成 | JWT発行・検証・ユーティリティ関数 |
| `tests/auth/jwt.test.ts` | 新規作成 | JWTロジックのユニットテスト |

---

## 実装方針

### 1. トークン種別と有効期限

| トークン種別 | 有効期限 | 用途 |
|---|---|---|
| アクセストークン (Access Token) | 15分 | API認証 |
| リフレッシュトークン (Refresh Token) | 7日 | アクセストークン再発行 |

- アクセストークンは **ステートレス** に JWT で管理する。
- リフレッシュトークンは DB (`refresh_tokens` テーブル) で管理し、失効・ローテーションを可能にする。
  本 Issue では JWT ロジック層のみを実装し、DB 操作は別 Issue（リポジトリ層）で対応する。

### 2. JWT アルゴリズム

- **HS256**（HMAC-SHA256）を採用する。
- シークレットキーは環境変数 `JWT_SECRET` から取得する。
- 本番環境では十分な長さ（256bit 以上）の安全なランダム文字列を使用する。

### 3. ペイロード設計

```
AccessTokenPayload:
  sub      : string   ← User UUID (users.id)
  email    : string   ← メールアドレス
  type     : "access"
  iat      : number   ← JWT 標準クレーム（発行日時）
  exp      : number   ← JWT 標準クレーム（有効期限）

RefreshTokenPayload:
  sub      : string   ← User UUID (users.id)
  type     : "refresh"
  jti      : string   ← JWT ID（UUIDv4 / DB の refresh_tokens.id と紐付け）
  iat      : number
  exp      : number
```

`type` クレームにより、アクセストークンとリフレッシュトークンを相互に使い回せないように区別する。

### 4. エラーハンドリング

`verify` 関数は例外をスローせず `Result` 型（成功 / 失敗）を返す。
失敗理由は以下を識別できるようにする:

| reason | 説明 |
|---|---|
| `expired` | 有効期限切れ (`TokenExpiredError`) |
| `invalid` | 署名不正・形式不正 (`JsonWebTokenError`) |
| `wrong_type` | トークン種別ミスマッチ（例：refresh を access として検証） |

---

## API 設計

### `signAccessToken(payload, options?)`

```typescript
function signAccessToken(
  payload: AccessTokenInput,
  options?: SignOptions,
): string
```

- `payload.sub`、`payload.email` からアクセストークンを生成する。
- デフォルト有効期限: 15分。

### `signRefreshToken(payload, options?)`

```typescript
function signRefreshToken(
  payload: RefreshTokenInput,
  options?: SignOptions,
): string
```

- `payload.sub`、`payload.jti` からリフレッシュトークンを生成する。
- デフォルト有効期限: 7日。

### `verifyAccessToken(token)`

```typescript
function verifyAccessToken(token: string): JwtVerifyResult<AccessTokenPayload>
```

- アクセストークンを検証し、成功時はデコード済みペイロードを返す。
- 失敗時は `{ success: false, reason }` を返す。

### `verifyRefreshToken(token)`

```typescript
function verifyRefreshToken(token: string): JwtVerifyResult<RefreshTokenPayload>
```

- リフレッシュトークンを検証する。

### `decodeToken(token)`

```typescript
function decodeToken(token: string): JwtPayload | null
```

- 署名検証なしでペイロードをデコードする（ログ・デバッグ用）。

---

## セキュリティ考慮事項

- JWT_SECRET は環境変数から読み込み、未設定の場合は起動時にエラーを throw する。
- `type` クレームで用途別に分離し、トークンの混用を防ぐ。
- アクセストークンの有効期限を短く（15分）設定し、漏洩時のリスクを最小化する。
- リフレッシュトークンは DB に hash を保存し、ローテーション時に旧トークンを revoke する（DB操作は別 Issue）。
- `jsonwebtoken` ライブラリの `algorithms` オプションを明示し、アルゴリズム混同攻撃を防ぐ。
