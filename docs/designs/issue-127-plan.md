# 実装計画: Issue #127 ユーザープロフィール画面の追加

## 概要

設計書 `docs/designs/issue-127.md` に基づき、ユーザープロフィール閲覧・編集画面を実装する。

- `/profile` でプロフィール閲覧・編集が可能になる
- 型定義 → APIクライアント → コンポーネント → フック・ページ → テストの順で実装する

## 実装ファイル一覧

| ファイル | 種別 | 説明 |
|---------|------|------|
| `src/types/user.ts` | 型定義 | `User`, `UserProfile` インターフェース |
| `src/api/client.ts` | APIクライアント | `getUserProfile`, `updateUserProfile` |
| `src/components/UserProfileView.tsx` | コンポーネント | プロフィール閲覧UI |
| `src/components/UserProfileView.module.css` | スタイル | `UserProfileView` のCSS Modules |
| `src/components/ProfileEditForm.tsx` | コンポーネント | プロフィール編集フォームUI |
| `src/components/ProfileEditForm.module.css` | スタイル | `ProfileEditForm` のCSS Modules |
| `src/hooks/useUserProfile.ts` | フック | プロフィール取得・更新の状態管理 |
| `app/profile/page.tsx` | ページ | `/profile` ルート、閲覧・編集モード管理 |
| `src/api/__tests__/client.test.ts` | テスト | APIクライアントのユニットテスト |
| `src/hooks/__tests__/useUserProfile.test.ts` | テスト | `useUserProfile` のユニットテスト |
| `src/components/__tests__/UserProfileView.test.tsx` | テスト | `UserProfileView` のユニットテスト |
| `src/components/__tests__/ProfileEditForm.test.tsx` | テスト | `ProfileEditForm` のユニットテスト |
| `app/profile/__tests__/page.test.tsx` | テスト | プロフィールページの統合テスト |

## サブタスク

### subtask-1: 型定義・APIクライアント
- files: [`src/types/user.ts`, `src/api/client.ts`]
- depends_on: []
- description: |
    `User` / `UserProfile` インターフェースを `src/types/user.ts` に定義する。
    その型を用いて `src/api/client.ts` に `getUserProfile(id)` (GET) と
    `updateUserProfile(id, data)` (PATCH) を実装する。
    IDが空文字列の場合は `Error('User ID is required')` をスローし、
    HTTPエラー時は `Error('Failed to fetch/update profile: {status}')` をスローする。

### subtask-2: UserProfileView コンポーネント
- files: [`src/components/UserProfileView.tsx`, `src/components/UserProfileView.module.css`]
- depends_on: [1]
- description: |
    プロフィール閲覧用コンポーネントを実装する。
    Props: `profile: UserProfile | null | undefined`, `editable: boolean`, `onEdit?: () => void`。
    `profile` が null/undefined の場合は「ユーザーが見つかりません」を表示。
    bio / location / website は値がある場合のみセクション表示。
    `avatarUrl` 未設定時は `/default-avatar.png` を使用。
    website リンクはプロトコルなしの場合 `https://` を自動付与。
    `createdAt` が不正値の場合は「不明」を表示。
    `editable=true` の場合のみ「プロフィールを編集」ボタンを表示。
    スタイルは CSS Modules (`.container` / `.header` / `.avatar` / `.name` /
    `.email` / `.section` / `.label` / `.value` / `.meta` / `.editButton`)。

### subtask-3: ProfileEditForm コンポーネント
- files: [`src/components/ProfileEditForm.tsx`, `src/components/ProfileEditForm.module.css`]
- depends_on: [1]
- description: |
    プロフィール編集フォームコンポーネントを実装する。
    Props: `profile: UserProfile`, `onSave: (data: Partial<UserProfile>) => Promise<void>`, `onCancel: () => void`。
    フォームフィールド: 名前(必須)・メール(読み取り専用)・bio(textarea, 200文字以内, 残字数カウンター)・
    location(100文字以内)・website(`https://` 始まり)・登録日(読み取り専用)。
    バリデーションエラーは各フィールド下に表示。
    保存中は保存ボタンを disabled にして「保存中...」と表示。
    APIエラー時は `saveError` をフォーム内に表示。
    bio が 180 文字以上の場合はカウンターに警告スタイル (`.charCountWarning`) を適用。
    スタイルは CSS Modules (`.form` / `.title` / `.field` / `.readOnly` / `.charCount` /
    `.charCountWarning` / `.fieldError` / `.errorMessage` / `.actions` / `.saveButton` / `.cancelButton`)。

### subtask-4: フック・ページ
- files: [`src/hooks/useUserProfile.ts`, `app/profile/page.tsx`]
- depends_on: [1, 2, 3]
- description: |
    `useUserProfile(id)` フックを実装する。返却値は
    `{ profile: UserProfile | null, loading: boolean, error: Error | null, updateProfile }` 。
    `useEffect` で `id` が変わるたびに `getUserProfile(id)` を呼び出し、
    成功・失敗それぞれ状態を更新する。
    `updateProfile(data)` は `updateUserProfile(id, data)` を呼び、成功後に `profile` を更新して返す。

    `app/profile/page.tsx` はフックを利用してローディング・エラー・プロフィール表示を行う。
    `isEditing` フラグで `UserProfileView` と `ProfileEditForm` を切り替える。
    ユーザーIDは `getCurrentUserId()` で取得し、TODO コメントで認証基盤導入後の差し替えを明示する。

### subtask-5: APIクライアント・フックのテスト
- files: [`src/api/__tests__/client.test.ts`, `src/hooks/__tests__/useUserProfile.test.ts`]
- depends_on: [1, 4]
- description: |
    `client.test.ts`: `fetch` をグローバルモックして正常系・HTTPエラー・IDが空文字の
    各ケースを `getUserProfile` / `updateUserProfile` の両関数に対してテストする。

    `useUserProfile.test.ts`: APIクライアントを `jest.mock` でモック化して
    以下をテストする。
    - 正常取得: `loading: true` → 取得完了後 `profile` がセットされ `loading: false`
    - APIエラー: `error` 状態にエラーオブジェクトがセットされる
    - `updateProfile` 正常: 更新後 `profile` が最新値に更新される
    - `updateProfile` 失敗: エラーがスローされる
    - ID変更による再取得: `rerender` で ID 変更後に `getUserProfile` が再度呼ばれる

### subtask-6: コンポーネント・ページのテスト
- files: [`src/components/__tests__/UserProfileView.test.tsx`, `src/components/__tests__/ProfileEditForm.test.tsx`, `app/profile/__tests__/page.test.tsx`]
- depends_on: [2, 3, 4]
- description: |
    `UserProfileView.test.tsx`: Testing Library でレンダリングし、全15ケースを検証する。
    主な観点: 全フィールド表示・オプショナルフィールドなし・デフォルトアバター・
    `editable` フラグ・profile が null/undefined・URL補完・createdAt の各ケース・編集ボタンクリック。

    `ProfileEditForm.test.tsx`: フォーム操作をシミュレートし、全12ケースを検証する。
    主な観点: 初期値反映・メール読み取り専用・各フィールドのバリデーションエラー・
    正常送信・保存中の disabled 表示・API保存エラー・キャンセル・bio文字数カウンター・警告スタイル。

    `page.test.tsx`: APIクライアントをモック化し、以下の5ケースを統合的に検証する。
    - ローディング中: 「読み込み中...」が表示される
    - 正常表示: ユーザー名・メールが表示される
    - APIエラー時: 「エラーが発生しました」メッセージが表示される
    - 編集ボタン押下: 編集フォームに遷移する
    - 保存後: `UserProfileView` に戻る

## 依存関係図

```
subtask-1: 型定義・APIクライアント
    ├── subtask-2: UserProfileView コンポーネント ──────────────────────────┐
    └── subtask-3: ProfileEditForm コンポーネント ──────────────────────────┤
                                                                           ↓
                                                         subtask-4: フック・ページ
                                                              ├── subtask-5: APIクライアント・フックのテスト
                                                              └── subtask-6: コンポーネント・ページのテスト
                                                                  (subtask-2, 3 にも依存)
```

## テスト戦略

- `fetch` グローバルモック + `jest.mock` でAPIクライアントを分離
- Testing Library (`render`, `screen`, `userEvent`) でUIを操作
- カバレッジ目標: 80% 以上（特に `ProfileEditForm` バリデーション分岐は100% を目指す）
- 境界値テスト: bio 200文字・180文字、location 100文字、websiteプロトコル有無を必ず含める
- 確認コマンド: `npm test`
