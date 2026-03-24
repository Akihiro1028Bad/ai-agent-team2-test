import { validateEmail } from "../src/utils/validate";

describe("validateEmail", () => {
  // ── 正常系 ──────────────────────────────────────────────────
  describe("正常系: 有効なメールアドレス", () => {
    const validAddresses = [
      "user@example.com",
      "user.name@example.com",
      "user+tag@example.co.jp",
      "user-name@sub.example.org",
      "user_name@example.io",
      "123@example.com",
    ];

    test.each(validAddresses)('"%s" はエラーなし', (email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });
  });

  // ── 異常系: 空文字 ─────────────────────────────────────────
  describe("異常系: 空文字", () => {
    test("空文字のとき「入力してください」メッセージを返す", () => {
      const result = validateEmail("");
      expect(result.valid).toBe(false);
      expect(result.message).toBe("メールアドレスを入力してください");
    });
  });

  // ── 異常系: フォーマット不正 ───────────────────────────────
  describe("異常系: フォーマット不正", () => {
    const invalidAddresses = [
      // @ なし
      ["userexample.com", "@ なし"],
      // ドメインなし
      ["user@", "ドメインなし"],
      // TLD なし
      ["user@example", "TLD なし"],
      // 連続ドット (ローカルパート)
      ["user..name@example.com", "ローカルパートに連続ドット"],
      // 連続ドット (ドメイン)
      ["user@ex..ample.com", "ドメインに連続ドット"],
      // @ が複数
      ["user@@example.com", "@ が複数"],
      // ローカルパートなし
      ["@example.com", "ローカルパートなし"],
      // スペース含む
      ["user name@example.com", "スペース含む"],
    ];

    test.each(invalidAddresses)("%s (%s) はエラーメッセージを返す", (email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(false);
      expect(result.message).toBe(
        "有効なメールアドレスの形式で入力してください"
      );
    });
  });
});
