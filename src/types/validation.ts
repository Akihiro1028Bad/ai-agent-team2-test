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
