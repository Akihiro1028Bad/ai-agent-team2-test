import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "../src/components/RegisterForm";

describe("RegisterForm", () => {
  // ── 正常系 ──────────────────────────────────────────────────
  describe("正常系: 有効なメールアドレス入力", () => {
    test("有効なメールアドレスを入力してもエラーが表示されない", async () => {
      render(<RegisterForm />);
      const input = screen.getByLabelText("メールアドレス");

      await userEvent.type(input, "user@example.com");
      fireEvent.blur(input);

      expect(screen.queryByRole("alert")).toBeNull();
    });

    test("有効なメールアドレス入力後、送信ボタンが活性状態になる", async () => {
      render(<RegisterForm />);
      const input = screen.getByLabelText("メールアドレス");
      const button = screen.getByRole("button", { name: "登録する" });

      await userEvent.type(input, "user@example.com");
      fireEvent.blur(input);

      expect(button).not.toBeDisabled();
    });
  });

  // ── 異常系: フォーマット不正 ───────────────────────────────
  describe("異常系: 不正なフォーマット", () => {
    test("@ なしでフォーカスを外すとエラーメッセージが表示される", async () => {
      render(<RegisterForm />);
      const input = screen.getByLabelText("メールアドレス");

      await userEvent.type(input, "invalidemail");
      fireEvent.blur(input);

      expect(
        screen.getByText("有効なメールアドレスの形式で入力してください")
      ).toBeInTheDocument();
    });

    test("ドメインなしでフォーカスを外すとエラーメッセージが表示される", async () => {
      render(<RegisterForm />);
      const input = screen.getByLabelText("メールアドレス");

      await userEvent.type(input, "user@");
      fireEvent.blur(input);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "有効なメールアドレスの形式で入力してください"
      );
    });

    test("連続ドットを含む場合にエラーメッセージが表示される", async () => {
      render(<RegisterForm />);
      const input = screen.getByLabelText("メールアドレス");

      await userEvent.type(input, "user..name@example.com");
      fireEvent.blur(input);

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  // ── 異常系: 空文字 ─────────────────────────────────────────
  describe("異常系: 空文字入力", () => {
    test("何も入力せずフォーカスを外すとエラーメッセージが表示される", () => {
      render(<RegisterForm />);
      const input = screen.getByLabelText("メールアドレス");

      fireEvent.blur(input);

      expect(
        screen.getByText("メールアドレスを入力してください")
      ).toBeInTheDocument();
    });
  });

  // ── UI: 送信ボタン非活性 ───────────────────────────────────
  describe("UI: 送信ボタンの disabled 制御", () => {
    test("エラーがある状態で送信ボタンが非活性になる", async () => {
      render(<RegisterForm />);
      const input = screen.getByLabelText("メールアドレス");
      const button = screen.getByRole("button", { name: "登録する" });

      await userEvent.type(input, "bad-email");
      fireEvent.blur(input);

      expect(button).toBeDisabled();
    });

    test("エラーメッセージが表示されている状態で送信ボタンが非活性になる", async () => {
      render(<RegisterForm />);
      const input = screen.getByLabelText("メールアドレス");
      const button = screen.getByRole("button", { name: "登録する" });

      await userEvent.type(input, "notanemail");
      fireEvent.blur(input);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(button).toBeDisabled();
    });
  });

  // ── UI: エラー解消 ─────────────────────────────────────────
  describe("UI: 正しい形式に修正するとエラーが消える", () => {
    test("不正な入力を修正して有効な形式にするとエラーが消える", async () => {
      render(<RegisterForm />);
      const input = screen.getByLabelText("メールアドレス");

      // 不正な入力 → エラー表示
      await userEvent.type(input, "bad");
      fireEvent.blur(input);
      expect(screen.getByRole("alert")).toBeInTheDocument();

      // 有効な形式に修正
      await userEvent.clear(input);
      await userEvent.type(input, "valid@example.com");

      expect(screen.queryByRole("alert")).toBeNull();
    });

    test("エラー修正後、送信ボタンが活性状態に戻る", async () => {
      render(<RegisterForm />);
      const input = screen.getByLabelText("メールアドレス");
      const button = screen.getByRole("button", { name: "登録する" });

      // 不正な入力
      await userEvent.type(input, "bad");
      fireEvent.blur(input);
      expect(button).toBeDisabled();

      // 有効な形式に修正
      await userEvent.clear(input);
      await userEvent.type(input, "valid@example.com");

      expect(button).not.toBeDisabled();
    });
  });
});
