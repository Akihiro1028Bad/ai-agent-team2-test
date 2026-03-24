import React, { useState } from "react";
import { validateEmail } from "../utils/validate";

interface RegisterFormValues {
  email: string;
}

interface FieldError {
  email?: string;
}

export function RegisterForm() {
  const [values, setValues] = useState<RegisterFormValues>({ email: "" });
  const [errors, setErrors] = useState<FieldError>({});
  const [touched, setTouched] = useState<{ email?: boolean }>({});

  /** メールアドレスのバリデーションを実行してエラー状態を更新する */
  const runEmailValidation = (email: string): boolean => {
    const result = validateEmail(email);
    setErrors((prev) => ({
      ...prev,
      email: result.valid ? undefined : result.message,
    }));
    return result.valid;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setValues((prev) => ({ ...prev, email: value }));
    // touched 済みのフィールドはリアルタイムで再バリデーション
    if (touched.email) {
      runEmailValidation(value);
    }
  };

  const handleBlur = () => {
    setTouched((prev) => ({ ...prev, email: true }));
    runEmailValidation(values.email);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ email: true });
    const isValid = runEmailValidation(values.email);
    if (!isValid) return;
    // TODO: 送信処理
    alert(`登録メール: ${values.email}`);
  };

  const hasError = Boolean(errors.email);

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ marginBottom: "16px" }}>
        <label htmlFor="email" style={{ display: "block", marginBottom: "4px" }}>
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          value={values.email}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={hasError}
          aria-describedby={hasError ? "email-error" : undefined}
          style={{
            border: `1px solid ${hasError ? "#e53e3e" : "#ccc"}`,
            borderRadius: "4px",
            padding: "8px 12px",
            width: "100%",
            boxSizing: "border-box",
          }}
        />
        {hasError && (
          <p
            id="email-error"
            role="alert"
            style={{ color: "#e53e3e", fontSize: "0.875rem", marginTop: "4px" }}
          >
            {errors.email}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={hasError}
        style={{
          backgroundColor: hasError ? "#a0aec0" : "#3182ce",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          padding: "8px 24px",
          cursor: hasError ? "not-allowed" : "pointer",
        }}
      >
        登録する
      </button>
    </form>
  );
}
