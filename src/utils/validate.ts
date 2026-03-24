/**
 * メールアドレスのバリデーション関数
 * RFC 5322 準拠の正規表現でフォーマットチェックを行う
 */

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * RFC 5322 準拠のメールアドレス正規表現
 * - ローカルパート: 英数字・記号（ドット、ハイフン、アンダースコア、プラス）
 * - @ 記号必須
 * - ドメインパート: 英数字・ハイフン、ドット区切り
 * - 連続するドットは不可
 * - TLD は 2 文字以上
 */
const EMAIL_REGEX =
  /^(?!.*\.{2})[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export function validateEmail(email: string): ValidationResult {
  if (email.length === 0) {
    return { valid: false, message: "メールアドレスを入力してください" };
  }

  if (!EMAIL_REGEX.test(email)) {
    return {
      valid: false,
      message: "有効なメールアドレスの形式で入力してください",
    };
  }

  return { valid: true };
}
