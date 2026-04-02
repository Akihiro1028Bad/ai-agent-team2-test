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
