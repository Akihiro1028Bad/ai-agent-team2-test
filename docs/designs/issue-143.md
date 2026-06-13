# 設計書: Issue #143 ユーザー一覧画面への最終ログイン日表示

## 概要

ユーザー一覧画面（`app/users/page.tsx`）を新規作成し、各ユーザーカードに最終ログイン日（`lastLoginAt`）を `YYYY/MM/DD` 形式で表示する。
バックエンドは存在しないため、既存の `getUser` と同方針でメモリ内モックの Route Handler（`GET /api/users`）を新規追加する。
未ログインユーザーの `lastLoginAt: null` は「ログイン履歴なし」と表示する。

---

## 要件まとめ

| 項目 | 内容 |
|------|------|
| 表示画面 | `app/users/page.tsx`（新規作成） |
| 表示項目 | 既存項目（name, email, avatarUrl）＋ **最終ログイン日** |
| 表示形式 | `YYYY/MM/DD`（例: `2026/06/12`） |
| null 時の表示 | `ログイン履歴なし` |
| データ取得 | `GET /api/users`（メモリ内モック Route Handler を新規追加） |

---

## 変更対象ファイル一覧

| ファイル | 種別 | 内容 |
|---------|------|------|
| `src/types/user.ts` | 変更 | `User` に `lastLoginAt?: string \| null` を追加 |
| `app/api/users/route.ts` | 新規 | モックデータを返す Route Handler |
| `src/api/client.ts` | 変更 | `getUsers()` 関数を追加 |
| `src/api/__tests__/client.test.ts` | 変更 | `getUsers` のテストを追加 |
| `src/hooks/useUsers.ts` | 新規 | ユーザー一覧取得フック |
| `src/hooks/__tests__/useUsers.test.ts` | 新規 | `useUsers` のユニットテスト |
| `src/components/UserCard.tsx` | 変更 | `lastLoginAt` 表示ロジックを追加 |
| `src/components/__tests__/UserCard.test.tsx` | 変更 | `lastLoginAt` 表示のテストを追加 |
| `app/users/page.tsx` | 新規 | ユーザー一覧ページ |
| `app/users/__tests__/page.test.tsx` | 新規 | 一覧ページのテスト |

---

## 詳細設計

### 1. 型定義の変更（`src/types/user.ts`）

`User` インターフェースに `lastLoginAt` フィールドを追加する。

```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: Date | string;
  lastLoginAt?: string | null; // 追加: ISO 8601形式、未ログインはnull
}
```

- `string` 型（ISO 8601）とすることで JSON レスポンスと整合性を保つ
- `null` 許容とすることで未ログインユーザーを表現できる
- `optional（?）` とすることで既存コードの型互換性を維持する

---

### 2. Route Handler（`app/api/users/route.ts`）

`GET /api/users` を受け付けるモック Route Handler を新規作成する。

#### モックデータ仕様

- 3〜5 件程度のユーザーデータをメモリ内配列で定義
- `lastLoginAt` は一部 `null`（未ログインユーザーを含む）
- `lastLoginAt` は ISO 8601 形式の文字列（例: `"2026-06-12T10:30:00.000Z"`）

#### レスポンス仕様

```
GET /api/users
→ 200 OK
   Content-Type: application/json
   Body: User[]
```

エラー時は適切なステータスコードとメッセージを返す。

---

### 3. APIクライアント（`src/api/client.ts`）

`getUsers()` 関数を追加する。

```typescript
export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
  return res.json();
}
```

- 既存の `getUser`・`updateUser` と同じエラーハンドリングパターンを踏襲する
- パラメータ不要のため `validateUserId` の呼び出しは不要

---

### 4. フック（`src/hooks/useUsers.ts`）

ユーザー一覧を取得するカスタムフックを新規作成する。

```typescript
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { users, loading, error };
}
```

- 既存の `useUser` フックのパターンを踏襲する

---

### 5. UserCard コンポーネント（`src/components/UserCard.tsx`）

`lastLoginAt` フィールドの表示ロジックを追加する。

#### 日付フォーマット関数

```typescript
function formatLastLoginAt(lastLoginAt: string | null | undefined): string {
  if (lastLoginAt == null) return 'ログイン履歴なし';
  const date = new Date(lastLoginAt);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}
```

#### 表示内容

- `lastLoginAt` が `null` または `undefined` の場合: `ログイン履歴なし`
- `lastLoginAt` が ISO 8601 文字列の場合: `YYYY/MM/DD` 形式

#### JSX 変更差分（概要）

```tsx
<div className="user-card" onClick={() => onClick?.(user)}>
  <img src={user.avatarUrl || '/default-avatar.png'} alt={user.name || '名前未設定'} />
  <h3>{user.name || '名前未設定'}</h3>
  <p>{user.email}</p>
  <p>最終ログイン: {formatLastLoginAt(user.lastLoginAt)}</p>  {/* 追加 */}
</div>
```

---

### 6. ユーザー一覧ページ（`app/users/page.tsx`）

`useUsers` フックを使用してユーザー一覧を表示するページを新規作成する。

```
'use client'

- ローディング中: 「読み込み中...」
- エラー時: 「エラーが発生しました: {message}」
- データなし: 「ユーザーが見つかりません」
- 正常: UserCard のリスト表示
```

#### UIレイアウト方針

- シンプルなカード/リスト表示
- 既存の `app/users/[id]/page.tsx` と同様のエラー・ローディング処理パターン

---

## テスト戦略

### テストカバレッジ目標: 80% 以上

### ユニットテスト対象とテスト方針

#### `src/api/__tests__/client.test.ts`（既存ファイルに追加）

- `getUsers()`: `fetch` をモック化し正しいエンドポイント（`/api/users`）が呼ばれることを検証
- `getUsers()`: レスポンスが `ok: false` のとき `Error` がスローされることを検証
- `getUsers()`: 正常なレスポンスが `User[]` として返されることを検証

#### `src/hooks/__tests__/useUsers.test.ts`（新規）

- `getUsers` をモック化し、フックが以下の状態遷移を正しく行うことを検証:
  - 初期状態: `loading: true`, `users: []`, `error: null`
  - 成功時: `loading: false`, `users: <データ>`
  - 失敗時: `loading: false`, `error: <Error>`
- `renderHook` + `act` を使用

#### `src/components/__tests__/UserCard.test.tsx`（既存ファイルに追加）

- `lastLoginAt` が ISO 8601 文字列のとき `YYYY/MM/DD` 形式で表示される
- `lastLoginAt: null` のとき「ログイン履歴なし」が表示される
- `lastLoginAt: undefined` のとき「ログイン履歴なし」が表示される
- 既存テスト（name, email, avatar, onClick 等）が引き続き通ること

#### `app/users/__tests__/page.test.tsx`（新規）

- `useUsers` をモック化し以下を検証:
  - ローディング中は「読み込み中...」が表示される
  - エラー時は「エラーが発生しました」が表示される
  - 正常時はユーザー名・最終ログイン日が表示される
  - 空リスト時は「ユーザーが見つかりません」が表示される

### Fake 実装方針

- `fetch` は `jest.fn()` で `global.fetch` をモック化（既存 `client.test.ts` と同パターン）
- `useUsers` フックは `jest.mock` でモジュールごとモック化してページテストを独立させる

---

## セキュリティ考慮事項

- **外部入力のバリデーション**: `GET /api/users` はパラメータなし。将来的にフィルタ等を追加する場合はサーバーサイドでバリデーションを実施する
- **秘密情報の管理**: Route Handler はメモリ内モックのみ。実際の DB 接続情報は `.env` で管理し、クライアントサイドに露出させない
- **エラーメッセージ**: `res.status` のみをエラーメッセージに含め、スタックトレースや内部情報を露出させない（既存パターンを踏襲）
- **`lastLoginAt` のパース**: `new Date()` で不正な文字列が渡された場合は `Invalid Date` になる。Route Handler のモックデータは正規 ISO 8601 のみとし、将来的に外部 API に切り替える際はサーバーサイドでバリデーションを追加する

---

## サブタスク

### subtask-1: 型定義の拡張と Route Handler の新規作成
- files: [`src/types/user.ts`, `app/api/users/route.ts`]
- depends_on: []
- description: `User` インターフェースに `lastLoginAt?: string | null` を追加する。`GET /api/users` を返すメモリ内モック Route Handler を新規作成し、`lastLoginAt` を含む 3〜5 件のモックデータを定義する（null を含む）。

### subtask-2: APIクライアントへの getUsers 追加
- files: [`src/api/client.ts`, `src/api/__tests__/client.test.ts`]
- depends_on: [1]
- description: `getUsers(): Promise<User[]>` 関数を `src/api/client.ts` に追加する。既存 `getUser` と同パターンで fetch とエラーハンドリングを実装する。テストファイルに `getUsers` の正常系・異常系テストを追加する。

### subtask-3: useUsers フックの新規作成
- files: [`src/hooks/useUsers.ts`, `src/hooks/__tests__/useUsers.test.ts`]
- depends_on: [2]
- description: `getUsers` を呼び出す `useUsers` カスタムフックを新規作成する。`{ users, loading, error }` を返す。`useUser` と同パターン。テストファイルでは `getUsers` をモック化し、ローディング・成功・失敗の各状態遷移を検証する。

### subtask-4: UserCard コンポーネントへの最終ログイン日表示追加
- files: [`src/components/UserCard.tsx`, `src/components/__tests__/UserCard.test.tsx`]
- depends_on: [1]
- description: `UserCard` に `lastLoginAt` を `YYYY/MM/DD` 形式でフォーマットする関数を追加し、「最終ログイン: YYYY/MM/DD」として表示する。`null`/`undefined` 時は「ログイン履歴なし」を表示する。テストファイルに対応するケースを追加する。

### subtask-5: ユーザー一覧ページの新規作成
- files: [`app/users/page.tsx`, `app/users/__tests__/page.test.tsx`]
- depends_on: [3, 4]
- description: `useUsers` フックを使用したユーザー一覧ページ (`app/users/page.tsx`) を新規作成する。ローディング・エラー・空リスト・正常表示の各状態を実装する。テストファイルでは `useUsers` をモック化し各状態の表示を検証する。
