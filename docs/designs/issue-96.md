# 設計書: Issue #96 プロフィール編集フォームにバリデーション追加

## 1. 概要

既存の `ProfileEditForm` コンポーネントにクライアントサイドバリデーションを追加する。バリデーションロジックは汎用カスタムhook（`useFormValidation`）に分離し、再利用可能な設計とする。

### 1.1 背景

現在の `ProfileEditForm` には最低限のバリデーション（名前の必須チェック、bioの500文字制限、websiteのhttpsチェック）がコンポーネント内にハードコードされている。Issue要件に基づきバリデーションルールを強化し、ロジックをカスタムhookに分離することで保守性・再利用性を向上させる。

### 1.2 スコープ

- **対象**: `ProfileEditForm` のバリデーション強化、`useFormValidation` hookの新規作成、型定義の拡張、テスト追加
- **対象外**: サーバーサイドバリデーション、emailフィールドの編集可能化（現状の読み取り専用を維持）

### 1.3 ヒアリング結果サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | emailフィールド | 読み取り専用のまま維持（バリデーション対象外） |
| 2 | bioの文字数上限 | 500→200文字に引き下げ（Issue要件に準拠） |
| 3 | locationフィールド | 既存バリデーション（100文字以内）をそのまま維持 |
| 4 | websiteのURL形式チェック | `https://` および `http://` を許可する |
| 5 | バリデーション発火タイミング | onBlur時にリアルタイムバリデーション + 送信時にも全体バリデーション |
| 6 | useFormValidation hookの汎用性 | 他のフォームでも再利用可能な汎用hookとして作成 |
| 7 | 送信ボタンの無効化 | バリデーションエラーがある場合は送信ボタンをdisabledにする |

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **型定義** | `src/types/user.ts` | `User` / `UserProfile` 定義済み | ✅ 変更なし |
| **コンポーネント** | `src/components/ProfileEditForm.tsx` | バリデーションがコンポーネント内にハードコード | ⚠️ 変更（hookへの移行、ルール強化） |
| **CSS** | `src/components/ProfileEditForm.module.css` | `.fieldError` クラスが定義済み | ⚠️ 軽微な変更（エラー入力スタイル追加） |
| **テスト** | `src/components/__tests__/ProfileEditForm.test.tsx` | 基本テスト7件あり | ⚠️ 変更（テストケース追加） |

### 2.2 現在のバリデーションルール

```typescript
// ProfileEditForm.tsx 内の validate() 関数（現状）
const validate = (): FormErrors => {
  const newErrors: FormErrors = {};
  if (!name.trim()) {
    newErrors.name = '名前は必須です';
  }
  if (bio.length > 500) {
    newErrors.bio = '自己紹介は500文字以内で入力してください';
  }
  if (location.length > 100) {
    newErrors.location = '所在地は100文字以内で入力してください';
  }
  if (website && !website.startsWith('https://')) {
    newErrors.website = 'URLは https:// で始めてください';
  }
  return newErrors;
};
```

### 2.3 変更後のバリデーションルール

| フィールド | 現状 | 変更後 |
|-----------|------|--------|
| name | 必須チェックのみ | 必須 + **50文字以内** |
| email | バリデーションなし（読み取り専用） | 変更なし（読み取り専用を維持） |
| bio | 500文字以内 | **200文字以内** |
| location | 100文字以内 | 変更なし |
| website | `https://` で始まるかチェック | **`http://` または `https://` で始まる + URL形式チェック** |

## 3. 型定義

### 3.1 新規ファイル: `src/types/validation.ts`

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

## 4. Hook設計

### 4.1 新規Hook: `src/hooks/useFormValidation.ts`

**責務**: バリデーションルールに基づいてフォーム入力値を検証するロジックをカプセル化。ProfileEditForm以外のフォーム（例: NotificationSettingsForm等）でも再利用可能な汎用hookとする。

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

**返却値**:

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `errors` | `ValidationErrors<T>` | 現在のバリデーションエラーマップ |
| `validateField` | `(field: T, value: string) => string \| undefined` | 単一フィールドのバリデーション（onBlur用） |
| `validateAll` | `(values: Record<T, string>) => ValidationErrors<T>` | 全フィールドのバリデーション（送信時用） |
| `hasErrors` | `boolean` | エラーが存在するか |
| `clearErrors` | `() => void` | 全エラーをクリア |
| `clearFieldError` | `(field: T) => void` | 指定フィールドのエラーをクリア |

## 5. コンポーネント設計

### 5.1 変更コンポーネント: `ProfileEditForm`

#### バリデーションルール定義

コンポーネント外で定数として定義し、`useFormValidation` に渡す。

```typescript
type ProfileFormField = 'name' | 'bio' | 'location' | 'website';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

#### コンポーネント変更内容

```typescript
'use client';

import React, { useState } from 'react';
import { UserProfile } from '../types/user';
import { useFormValidation } from '../hooks/useFormValidation';
import { ValidationRules } from '../types/validation';
import styles from './ProfileEditForm.module.css';

// --- バリデーションルール定義（上記の定数をここに配置） ---

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

interface ProfileEditFormProps {
  profile: UserProfile;
  onSave: (data: Partial<UserProfile>) => Promise<void>;
  onCancel: () => void;
}

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  profile,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState(profile.location || '');
  const [website, setWebsite] = useState(profile.website || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // useFormValidation hookでバリデーションロジックを分離
  const { errors, validateField, validateAll, hasErrors } =
    useFormValidation<ProfileFormField>(PROFILE_VALIDATION_RULES);

  // onBlur ハンドラー（リアルタイムバリデーション）
  const handleBlur = (field: ProfileFormField, value: string) => {
    validateField(field, value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 送信時に全フィールドバリデーション
    const validationErrors = validateAll({
      name,
      bio,
      location,
      website,
    });
    if (Object.keys(validationErrors).length > 0) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        name: name.trim(),
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
        website: website.trim() || undefined,
      });
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : '保存に失敗しました'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>プロフィール編集</h2>

      <div className={styles.field}>
        <label htmlFor="name">名前 *</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => handleBlur('name', name)}
          maxLength={50}
          className={errors.name ? styles.inputError : undefined}
        />
        {errors.name && <div className={styles.fieldError}>{errors.name}</div>}
      </div>

      <div className={styles.field}>
        <label>メールアドレス</label>
        <div className={styles.readOnly}>{profile.email}</div>
      </div>

      <div className={styles.field}>
        <label htmlFor="bio">自己紹介</label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          onBlur={() => handleBlur('bio', bio)}
          maxLength={200}
          className={errors.bio ? styles.inputError : undefined}
        />
        <div className={styles.charCount}>{bio.length}/200</div>
        {errors.bio && <div className={styles.fieldError}>{errors.bio}</div>}
      </div>

      <div className={styles.field}>
        <label htmlFor="location">所在地</label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => handleBlur('location', location)}
          maxLength={100}
          className={errors.location ? styles.inputError : undefined}
        />
        {errors.location && (
          <div className={styles.fieldError}>{errors.location}</div>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="website">Webサイト</label>
        <input
          id="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          onBlur={() => handleBlur('website', website)}
          placeholder="https://example.com"
          className={errors.website ? styles.inputError : undefined}
        />
        {errors.website && (
          <div className={styles.fieldError}>{errors.website}</div>
        )}
      </div>

      <div className={styles.field}>
        <label>登録日</label>
        <div className={styles.readOnly}>
          {new Date(profile.createdAt).toLocaleDateString('ja-JP')}
        </div>
      </div>

      {saveError && <div className={styles.errorMessage}>{saveError}</div>}

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.saveButton}
          disabled={isSaving || hasErrors}
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={isSaving}
        >
          キャンセル
        </button>
      </div>
    </form>
  );
};
```

#### 主要な変更点

| 変更箇所 | 変更前 | 変更後 |
|----------|--------|--------|
| バリデーションロジック | コンポーネント内 `validate()` 関数 | `useFormValidation` hook使用 |
| `FormErrors` 型 | コンポーネント内で定義 | `ValidationErrors` 型（`src/types/validation.ts`） |
| name バリデーション | 必須のみ | 必須 + 50文字以内 + `maxLength={50}` |
| bio 文字数制限 | 500文字 | 200文字 |
| website バリデーション | `https://` のみ | `http://` `https://` + URL形式正規表現 |
| バリデーション発火タイミング | 送信時のみ | onBlur + 送信時 |
| 送信ボタン | `disabled={isSaving}` | `disabled={isSaving \|\| hasErrors}` |
| 文字数カウンター | なし | bio に文字数カウンター表示 |

### 5.2 CSS変更: `ProfileEditForm.module.css`

追加するクラス:

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

## 6. 状態管理

### 6.1 バリデーション状態のフロー

```
[ユーザーがフィールドに入力]
  ↓
[フィールドからフォーカスアウト（onBlur）]
  ↓
[useFormValidation.validateField() 呼び出し]
  ↓
[該当フィールドのバリデーションルールを順次評価]
  ↓
[エラーあり → errors に追加、エラーメッセージ表示]
[エラーなし → errors から削除、エラーメッセージ非表示]
  ↓
[hasErrors 更新 → 送信ボタンの disabled 状態に反映]
```

```
[ユーザーが「保存」ボタンをクリック]
  ↓
[useFormValidation.validateAll() 呼び出し]
  ↓
[全フィールドのバリデーションルールを評価]
  ↓
[エラーあり → errors 更新、送信中止]
[エラーなし → onSave 実行]
```

### 6.2 状態一覧

| 状態 | 管理場所 | 説明 |
|------|----------|------|
| `name`, `bio`, `location`, `website` | `ProfileEditForm` (useState) | フォーム入力値 |
| `errors` | `useFormValidation` hook | フィールドごとのバリデーションエラー |
| `hasErrors` | `useFormValidation` hook | エラー有無（送信ボタン制御用） |
| `isSaving` | `ProfileEditForm` (useState) | 保存中フラグ |
| `saveError` | `ProfileEditForm` (useState) | API保存エラー |

## 7. ファイル変更一覧

### 7.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/types/validation.ts` | 型定義 | `ValidationRule`, `ValidationRules`, `ValidationErrors`, `UseFormValidationReturn` |
| `src/hooks/useFormValidation.ts` | Hook | 汎用フォームバリデーションhook |
| `src/hooks/__tests__/useFormValidation.test.ts` | テスト | useFormValidationのユニットテスト |

### 7.2 変更ファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `src/components/ProfileEditForm.tsx` | `useFormValidation` hook統合、バリデーションルール強化、onBlurバリデーション追加、送信ボタン無効化、文字数カウンター追加 |
| `src/components/ProfileEditForm.module.css` | `.inputError`、`.charCount` クラス追加 |
| `src/components/__tests__/ProfileEditForm.test.tsx` | 新バリデーションルールのテストケース追加 |

### 7.3 変更なしファイル

| ファイルパス | 理由 |
|-------------|------|
| `src/types/user.ts` | `UserProfile` 型は変更不要 |
| `src/hooks/useUserProfile.ts` | スコープ外 |
| `src/components/UserProfileView.tsx` | スコープ外 |
| `app/profile/page.tsx` | スコープ外 |

## 8. テスト方針

### 8.1 テスト対象

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `useFormValidation` | `src/hooks/__tests__/useFormValidation.test.ts` | hookの汎用バリデーションロジック |
| `ProfileEditForm` | `src/components/__tests__/ProfileEditForm.test.tsx` | コンポーネント統合テスト（既存テスト修正 + 追加） |

### 8.2 useFormValidation テストケース

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期状態でエラーなし | `errors` が空オブジェクト、`hasErrors` が `false` |
| 2 | required ルール - 空文字 | エラーメッセージが返ること |
| 3 | required ルール - 値あり | エラーなし |
| 4 | maxLength ルール - 超過 | エラーメッセージが返ること |
| 5 | maxLength ルール - 以内 | エラーなし |
| 6 | pattern ルール - 不一致 | エラーメッセージが返ること |
| 7 | pattern ルール - 一致 | エラーなし |
| 8 | pattern ルール - 空文字 | エラーなし（任意フィールドの場合） |
| 9 | validateAll - 複数エラー | 複数フィールドのエラーが返ること |
| 10 | validateAll - エラーなし | 空オブジェクトが返ること |
| 11 | clearErrors | 全エラーがクリアされること |
| 12 | clearFieldError | 指定フィールドのエラーのみクリアされること |

### 8.3 ProfileEditForm テストケース（追加分）

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 名前が51文字以上の場合 | 「名前は50文字以内で入力してください」が表示される |
| 2 | 自己紹介が201文字以上の場合 | 「自己紹介は200文字以内で入力してください」が表示される |
| 3 | websiteが `http://` の場合 | バリデーションエラーが表示されない（許可される） |
| 4 | websiteが不正な形式の場合 | エラーメッセージが表示される |
| 5 | onBlurでバリデーション発火 | フィールドからフォーカスアウト時にエラーが表示される |
| 6 | バリデーションエラー時の送信ボタン | `disabled` 属性が付与される |
| 7 | 文字数カウンター | bioフィールド下に「{入力文字数}/200」が表示される |

### 8.4 既存テストの修正

| テストケース | 修正内容 |
|-------------|----------|
| `website が https:// で始まらない場合にバリデーションエラー` | エラーメッセージが変更になるため期待値を更新 |

## 9. 実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 新規/変更 | 依存先 |
|------|----------|------|-----------|--------|
| 1 | `src/types/validation.ts` | 型定義 | 新規 | なし |
| 2 | `src/hooks/useFormValidation.ts` | Hook | 新規 | 順序1 |
| 3 | `src/components/ProfileEditForm.module.css` | スタイル | 変更 | なし |
| 4 | `src/components/ProfileEditForm.tsx` | コンポーネント | 変更 | 順序1, 2, 3 |
| 5 | `src/hooks/__tests__/useFormValidation.test.ts` | テスト | 新規 | 順序2 |
| 6 | `src/components/__tests__/ProfileEditForm.test.tsx` | テスト | 変更 | 順序4 |

**並列実装可能なグループ**:
- 順序2 と 順序3 は互いに独立しているため並列実装可能
- 順序5 と 順序6 は互いに独立しているため並列実装可能

## 10. 依存関係図

```
src/types/validation.ts（新規: 型定義）
  ├─→ src/hooks/useFormValidation.ts（新規: 汎用バリデーションhook）
  │     ↓
  │   src/components/ProfileEditForm.tsx（変更: hook統合、ルール強化）
  │     │
  │     ├── src/components/ProfileEditForm.module.css（変更: エラースタイル追加）
  │     │
  │     ├─→ src/hooks/__tests__/useFormValidation.test.ts（新規: hookテスト）
  │     └─→ src/components/__tests__/ProfileEditForm.test.tsx（変更: テスト追加）
```

## 11. 実装上の注意事項

### 11.1 useFormValidation hookの汎用性

- フィールド名をジェネリクス型パラメータ `T extends string` で受け取り、任意のフォームで使用可能にする
- バリデーションルールは外部から注入する設計（hookはルールの定義に関与しない）
- 将来的に `NotificationSettingsForm` 等でも使用可能

### 11.2 バリデーションルールの拡張性

- `ValidationRuleType` に新しいルールタイプを追加することで、`minLength`、`email`、`range` 等のルールを容易に追加可能
- `custom` ルールにより、任意のバリデーションロジックを関数として注入可能

### 11.3 既存テストとの整合性

- 既存のテストで `'URLは https:// で始めてください'` を期待しているテストケースがあるため、エラーメッセージ変更に伴い更新が必要
- bioの文字数制限変更（500→200）に伴い、`maxLength` 属性値の変更にも注意

### 11.4 パフォーマンス考慮

- `PROFILE_VALIDATION_RULES` はコンポーネント外に定数定義し、レンダリングのたびに再生成されないようにする
- `useFormValidation` 内の `validateField`、`validateAll` は `useCallback` でメモ化
- `hasErrors` は `useMemo` で算出し不要な再計算を防止
