# 実装計画: Issue #96 プロフィール編集フォームにバリデーション追加

## 1. 概要

設計書 `docs/designs/issue-96.md` に基づき、`ProfileEditForm` コンポーネントのバリデーションを強化する。
バリデーションロジックを汎用カスタムhook（`useFormValidation`）に分離し、バリデーションルールの追加・変更、onBlurリアルタイムバリデーション、送信ボタンの無効化制御を実装する。

---

## 2. 変更ファイル一覧と実装順序

### Phase 1: 型定義（依存なし）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 1 | `src/types/validation.ts` | 新規 | `ValidationRuleType`, `ValidationRule`, `ValidationRules`, `ValidationErrors`, `UseFormValidationReturn` 型定義 |

### Phase 2: Hook + CSS（Phase 1 に依存、互いに独立 → 並列実装可能）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 2a | `src/hooks/useFormValidation.ts` | 新規 | 汎用フォームバリデーションhook — `validateField`（onBlur用）、`validateAll`（送信時用）、`hasErrors`、`clearErrors`、`clearFieldError` を提供 |
| 2b | `src/components/ProfileEditForm.module.css` | 変更 | `.inputError`（エラー時ボーダー色）、`.charCount`（文字数カウンター）クラス追加 |

### Phase 3: コンポーネント（Phase 1, 2a, 2b に依存）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 3 | `src/components/ProfileEditForm.tsx` | 変更 | `useFormValidation` hook統合、バリデーションルール強化、onBlurバリデーション追加、送信ボタン無効化、文字数カウンター追加 |

### Phase 4: テスト（Phase 2a, 3 に依存、互いに独立 → 並列実装可能）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 4a | `src/hooks/__tests__/useFormValidation.test.ts` | 新規 | useFormValidation hookのユニットテスト（12ケース） |
| 4b | `src/components/__tests__/ProfileEditForm.test.tsx` | 変更 | 既存テスト修正（エラーメッセージ変更対応）+ 新規テストケース追加（7ケース） |

### 変更なしファイル

| ファイルパス | 理由 |
|-------------|------|
| `src/types/user.ts` | `UserProfile` 型は変更不要 |
| `src/hooks/useUserProfile.ts` | スコープ外 |
| `src/components/UserProfileView.tsx` | スコープ外 |
| `app/profile/page.tsx` | スコープ外 |

---

## 3. 各ファイルの変更内容

### 3.1 `src/types/validation.ts`（新規）

バリデーションに関する型定義を新規作成する。`useFormValidation` hookおよび将来の他フォームでも再利用可能な汎用型。

```typescript
/**
 * バリデーションルールの種類
 */
export type ValidationRuleType =
  | 'required'
  | 'maxLength'
  | 'pattern'
  | 'custom';

/**
 * バリデーションルール定義
 */
export interface ValidationRule {
  /** ルールの種類 */
  type: ValidationRuleType;
  /** エラーメッセージ */
  message: string;
  /** maxLength ルールの場合の最大文字数 */
  maxLength?: number;
  /** pattern ルールの場合の正規表現 */
  pattern?: RegExp;
  /** custom ルールの場合のバリデーション関数 */
  validate?: (value: string) => boolean;
}

/**
 * フィールドごとのバリデーションルール定義
 * キーはフォームフィールド名、値はルールの配列
 */
export type ValidationRules<T extends string = string> = {
  [K in T]?: ValidationRule[];
};

/**
 * フィールドごとのバリデーションエラー
 * キーはフォームフィールド名、値はエラーメッセージ
 */
export type ValidationErrors<T extends string = string> = {
  [K in T]?: string;
};

/**
 * useFormValidation hookの返却値
 */
export interface UseFormValidationReturn<T extends string = string> {
  /** 現在のバリデーションエラー */
  errors: ValidationErrors<T>;
  /** 指定フィールドをバリデーションする（onBlur時に使用） */
  validateField: (field: T, value: string) => string | undefined;
  /** 全フィールドをバリデーションする（送信時に使用） */
  validateAll: (values: Record<T, string>) => ValidationErrors<T>;
  /** バリデーションエラーが存在するか */
  hasErrors: boolean;
  /** エラーをクリアする */
  clearErrors: () => void;
  /** 指定フィールドのエラーをクリアする */
  clearFieldError: (field: T) => void;
}
```

### 3.2 `src/hooks/useFormValidation.ts`（新規）

汎用フォームバリデーションhookを新規作成する。設計書セクション4.1のコードをそのまま実装する。

**主要ポイント**:
- `validateValue` ユーティリティ関数: 単一フィールドの値をルール群で検証（最初のエラーを返す）
- `validateField`: onBlur時の単一フィールドバリデーション（`useCallback`でメモ化）
- `validateAll`: 送信時の全フィールドバリデーション（`useCallback`でメモ化）
- `hasErrors`: エラー有無の算出値（`useMemo`で計算）
- `clearErrors` / `clearFieldError`: エラークリア関数

```typescript
import { useState, useCallback, useMemo } from 'react';
import {
  ValidationRule,
  ValidationRules,
  ValidationErrors,
  UseFormValidationReturn,
} from '../types/validation';

/**
 * 単一フィールドの値を指定ルール群でバリデーションする
 * 最初に見つかったエラーのメッセージを返す（なければundefined）
 */
function validateValue(value: string, rules: ValidationRule[]): string | undefined {
  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        if (!value.trim()) return rule.message;
        break;
      case 'maxLength':
        if (rule.maxLength !== undefined && value.length > rule.maxLength) return rule.message;
        break;
      case 'pattern':
        if (rule.pattern && value.trim() !== '' && !rule.pattern.test(value)) return rule.message;
        break;
      case 'custom':
        if (rule.validate && !rule.validate(value)) return rule.message;
        break;
    }
  }
  return undefined;
}

/**
 * 汎用フォームバリデーションhook
 */
export function useFormValidation<T extends string>(
  rules: ValidationRules<T>
): UseFormValidationReturn<T> {
  const [errors, setErrors] = useState<ValidationErrors<T>>({} as ValidationErrors<T>);

  const validateField = useCallback(
    (field: T, value: string): string | undefined => {
      const fieldRules = rules[field];
      if (!fieldRules) return undefined;
      const error = validateValue(value, fieldRules);
      setErrors((prev) => {
        const next = { ...prev };
        if (error) {
          next[field] = error;
        } else {
          delete next[field];
        }
        return next;
      });
      return error;
    },
    [rules]
  );

  const validateAll = useCallback(
    (values: Record<T, string>): ValidationErrors<T> => {
      const newErrors: ValidationErrors<T> = {} as ValidationErrors<T>;
      for (const field of Object.keys(rules) as T[]) {
        const value = values[field] || '';
        const fieldRules = rules[field];
        if (fieldRules) {
          const error = validateValue(value, fieldRules);
          if (error) {
            newErrors[field] = error;
          }
        }
      }
      setErrors(newErrors);
      return newErrors;
    },
    [rules]
  );

  const hasErrors = useMemo(
    () => Object.keys(errors).length > 0,
    [errors]
  );

  const clearErrors = useCallback(() => {
    setErrors({} as ValidationErrors<T>);
  }, []);

  const clearFieldError = useCallback((field: T) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  return { errors, validateField, validateAll, hasErrors, clearErrors, clearFieldError };
}
```

### 3.3 `src/components/ProfileEditForm.module.css`（変更）

ファイル末尾に以下の2クラスを追加する。

```css
/* バリデーションエラー時の入力フィールドスタイル */
.inputError {
  border-color: #e00 !important;
}

/* 文字数カウンター */
.charCount {
  text-align: right;
  font-size: 12px;
  color: #888;
  margin-top: 2px;
}
```

### 3.4 `src/components/ProfileEditForm.tsx`（変更）

**変更概要**: コンポーネント全体を設計書セクション5.1のコードで置き換える。

**変更点の詳細**:

| # | 変更箇所 | 変更前 | 変更後 |
|---|----------|--------|--------|
| 1 | import文 | `UserProfile`, `styles` のみ | `useFormValidation`, `ValidationRules` を追加 |
| 2 | `FormErrors` 型 | コンポーネント内で定義 | 削除（`ValidationErrors` 型に置き換え） |
| 3 | `validate()` 関数 | コンポーネント内にハードコード | 削除（`useFormValidation` hookに置き換え） |
| 4 | バリデーションルール定数 | なし | `PROFILE_VALIDATION_RULES` をコンポーネント外に定義 |
| 5 | `errors` state | `useState<FormErrors>({})` | `useFormValidation` hookから取得 |
| 6 | name フィールド | `maxLength` なし | `maxLength={50}`, `onBlur`, `className`（エラー時）追加 |
| 7 | bio フィールド | `maxLength={500}` | `maxLength={200}`, `onBlur`, `className`（エラー時）, 文字数カウンター追加 |
| 8 | location フィールド | `onBlur` なし | `onBlur`, `className`（エラー時）追加 |
| 9 | website フィールド | `onBlur` なし | `onBlur`, `className`（エラー時）追加 |
| 10 | 保存ボタン | `disabled={isSaving}` | `disabled={isSaving \|\| hasErrors}` |
| 11 | bio 文字数カウンター | なし | `<div className={styles.charCount}>{bio.length}/200</div>` 追加 |

**バリデーションルール定数（コンポーネント外に定義）**:

```typescript
type ProfileFormField = 'name' | 'bio' | 'location' | 'website';

const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/;

const PROFILE_VALIDATION_RULES: ValidationRules<ProfileFormField> = {
  name: [
    { type: 'required', message: '名前は必須です' },
    { type: 'maxLength', maxLength: 50, message: '名前は50文字以内で入力してください' },
  ],
  bio: [
    { type: 'maxLength', maxLength: 200, message: '自己紹介は200文字以内で入力してください' },
  ],
  location: [
    { type: 'maxLength', maxLength: 100, message: '所在地は100文字以内で入力してください' },
  ],
  website: [
    {
      type: 'pattern',
      pattern: URL_REGEX,
      message: 'URLは http:// または https:// で始まる正しい形式で入力してください',
    },
  ],
};
```

### 3.5 `src/hooks/__tests__/useFormValidation.test.ts`（新規）

既存テスト（`useUserProfile.test.ts`）のパターンに準拠。`renderHook` + `act` で hookをテスト。

```typescript
import { renderHook, act } from '@testing-library/react';
import { useFormValidation } from '../useFormValidation';
import { ValidationRules } from '../../types/validation';
```

**テストケース一覧**（12ケース）:

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期状態でエラーなし | `errors` が空オブジェクト、`hasErrors` が `false` |
| 2 | required ルール - 空文字 | `validateField` でエラーメッセージが返り、`errors` に格納されること |
| 3 | required ルール - 値あり | `validateField` で `undefined` が返り、`errors` にエラーなし |
| 4 | maxLength ルール - 超過 | エラーメッセージが返ること |
| 5 | maxLength ルール - 以内 | エラーなし |
| 6 | pattern ルール - 不一致 | エラーメッセージが返ること |
| 7 | pattern ルール - 一致 | エラーなし |
| 8 | pattern ルール - 空文字 | エラーなし（任意フィールドはスキップ） |
| 9 | validateAll - 複数エラー | 複数フィールドのエラーが返ること |
| 10 | validateAll - エラーなし | 空オブジェクトが返ること |
| 11 | clearErrors | 全エラーがクリアされ `hasErrors` が `false` になること |
| 12 | clearFieldError | 指定フィールドのエラーのみクリアされること |

### 3.6 `src/components/__tests__/ProfileEditForm.test.tsx`（変更）

**既存テストの修正（1件）**:

| テストケース | 修正内容 |
|-------------|----------|
| `website が https:// で始まらない場合にバリデーションエラー` (78-97行目) | テスト内容を変更: `http://example.com` は有効なURLなのでバリデーションエラーにならない。代わりに不正なURL形式（例: `not-a-url`）を入力し、新しいエラーメッセージ `'URLは http:// または https:// で始まる正しい形式で入力してください'` を期待するように修正 |

**新規テストケース追加（7件）**:

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 名前が51文字以上の場合 | 名前を51文字入力→送信→「名前は50文字以内で入力してください」が表示される |
| 2 | 自己紹介が201文字以上の場合 | bioを201文字入力→送信→「自己紹介は200文字以内で入力してください」が表示される |
| 3 | websiteが `http://` の場合 | `http://example.com` を入力→送信→バリデーションエラーなし、`onSave` が呼ばれる |
| 4 | websiteが不正な形式の場合 | `invalid-url` を入力→送信→エラーメッセージが表示される |
| 5 | onBlurでバリデーション発火 | 名前を空にしてフォーカスアウト→エラーが送信前に表示される |
| 6 | バリデーションエラー時の送信ボタン | バリデーションエラー発生後、送信ボタンに `disabled` 属性が付与されること |
| 7 | 文字数カウンター | bioフィールド下に「{入力文字数}/200」が表示されること（初期値 + 入力後の変化） |

---

## 4. 依存関係図

```
Phase 1: src/types/validation.ts（新規: 型定義）
           │
     ┌─────┴─────┐
     ▼           ▼
Phase 2a:      Phase 2b:
useFormValidation.ts   ProfileEditForm.module.css
（新規: Hook）         （変更: CSS追加）
     │                │
     └───────┬────────┘
             ▼
Phase 3: src/components/ProfileEditForm.tsx
         （変更: hook統合、ルール強化）
             │
     ┌───────┴────────┐
     ▼                ▼
Phase 4a:           Phase 4b:
useFormValidation   ProfileEditForm
.test.ts（新規）    .test.tsx（変更）
```

---

## 5. テスト方針

### 5.1 テストツール・パターン

既存テスト（`ProfileEditForm.test.tsx` / `useUserProfile.test.ts`）のパターンに準拠する。

- **テストフレームワーク**: Jest + ts-jest
- **テスト環境**: jsdom（`jest.config.js` で設定済み）
- **テストライブラリ**: `@testing-library/react` / `@testing-library/user-event`
- **Hook テスト**: `renderHook` + `act` パターン
- **CSS モジュール**: `identity-obj-proxy` で自動モック（`jest.config.js` で設定済み）

### 5.2 テスト実行コマンド

```bash
# 全テスト実行
npm test

# 個別テスト実行
npx jest src/hooks/__tests__/useFormValidation.test.ts
npx jest src/components/__tests__/ProfileEditForm.test.tsx
```

### 5.3 テスト合格基準

- 新規テスト（useFormValidation: 12ケース）が全て合格すること
- 既存テスト修正後の ProfileEditForm テスト（既存7件 + 追加7件 = 計14件）が全て合格すること
- `npm test` で全テストスイートが合格すること

---

## 6. 実装時の注意事項

### 6.1 既存テストとの整合性

- **エラーメッセージ変更**: 既存テスト（78行目）で `'URLは https:// で始めてください'` を期待しているが、新ルールでは `'URLは http:// または https:// で始まる正しい形式で入力してください'` に変更される。テストの期待値と入力値の両方を更新すること。
- **bio maxLength変更**: HTML属性の `maxLength={500}` → `maxLength={200}` の変更により、ブラウザレベルで200文字超の入力が制限される。テストでは `fireEvent.change` で直接値を設定してバリデーションを確認する。

### 6.2 パフォーマンス考慮

- `PROFILE_VALIDATION_RULES` はコンポーネント外に定数定義（レンダリングのたびに再生成されない）
- `URL_REGEX` もコンポーネント外に定数定義
- `useFormValidation` 内の関数は `useCallback` / `useMemo` でメモ化済み

### 6.3 既存パターンとの一貫性

| 項目 | 既存パターン（参照元） | 新規ファイルでの適用 |
|------|----------------------|---------------------|
| Hook | `useUserProfile.ts`: `useState` + ロジック分離 | `useFormValidation.ts` で同パターン |
| 型定義 | `src/types/user.ts`: `export type` / `export interface` | `src/types/validation.ts` で同パターン |
| テスト（Hook） | `useUserProfile.test.ts`: `renderHook` + `waitFor` | `useFormValidation.test.ts` で同パターン |
| テスト（Component） | `ProfileEditForm.test.tsx`: `render` + `screen` + `fireEvent` + `userEvent` | テスト追加で同パターン |

---

## 7. 見積もり

| Phase | 内容 | 規模 |
|-------|------|------|
| 1 | 型定義 (`validation.ts`) | 小 |
| 2a | Hook (`useFormValidation.ts`) | 中 |
| 2b | CSS追加 | 小 |
| 3 | コンポーネント変更 (`ProfileEditForm.tsx`) | 中 |
| 4a | Hookテスト | 中 |
| 4b | コンポーネントテスト修正・追加 | 中 |
