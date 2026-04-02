import { renderHook, act } from '@testing-library/react';
import { useFormValidation } from '../useFormValidation';
import { ValidationRules } from '../../types/validation';

type TestField = 'name' | 'email' | 'website';

const testRules: ValidationRules<TestField> = {
  name: [
    { type: 'required', message: '名前は必須です' },
    { type: 'maxLength', maxLength: 10, message: '名前は10文字以内で入力してください' },
  ],
  email: [
    { type: 'required', message: 'メールアドレスは必須です' },
    {
      type: 'pattern',
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: '正しいメールアドレス形式で入力してください',
    },
  ],
  website: [
    {
      type: 'pattern',
      pattern: /^https?:\/\/.+$/,
      message: 'URLはhttp://またはhttps://で始めてください',
    },
  ],
};

describe('useFormValidation', () => {
  it('初期状態でエラーなし', () => {
    const { result } = renderHook(() => useFormValidation<TestField>(testRules));

    expect(result.current.errors).toEqual({});
    expect(result.current.hasErrors).toBe(false);
  });

  it('required ルール - 空文字でエラー', () => {
    const { result } = renderHook(() => useFormValidation<TestField>(testRules));

    let error: string | undefined;
    act(() => {
      error = result.current.validateField('name', '');
    });

    expect(error).toBe('名前は必須です');
    expect(result.current.errors.name).toBe('名前は必須です');
    expect(result.current.hasErrors).toBe(true);
  });

  it('required ルール - 値ありでエラーなし', () => {
    const { result } = renderHook(() => useFormValidation<TestField>(testRules));

    let error: string | undefined;
    act(() => {
      error = result.current.validateField('name', 'テスト');
    });

    expect(error).toBeUndefined();
    expect(result.current.errors.name).toBeUndefined();
  });

  it('maxLength ルール - 超過でエラー', () => {
    const { result } = renderHook(() => useFormValidation<TestField>(testRules));

    let error: string | undefined;
    act(() => {
      error = result.current.validateField('name', '12345678901');
    });

    expect(error).toBe('名前は10文字以内で入力してください');
    expect(result.current.errors.name).toBe('名前は10文字以内で入力してください');
  });

  it('maxLength ルール - 以内でエラーなし', () => {
    const { result } = renderHook(() => useFormValidation<TestField>(testRules));

    let error: string | undefined;
    act(() => {
      error = result.current.validateField('name', '1234567890');
    });

    expect(error).toBeUndefined();
    expect(result.current.errors.name).toBeUndefined();
  });

  it('pattern ルール - 不一致でエラー', () => {
    const { result } = renderHook(() => useFormValidation<TestField>(testRules));

    let error: string | undefined;
    act(() => {
      error = result.current.validateField('email', 'invalid-email');
    });

    expect(error).toBe('正しいメールアドレス形式で入力してください');
    expect(result.current.errors.email).toBe('正しいメールアドレス形式で入力してください');
  });

  it('pattern ルール - 一致でエラーなし', () => {
    const { result } = renderHook(() => useFormValidation<TestField>(testRules));

    let error: string | undefined;
    act(() => {
      error = result.current.validateField('email', 'test@example.com');
    });

    expect(error).toBeUndefined();
    expect(result.current.errors.email).toBeUndefined();
  });

  it('pattern ルール - 空文字でエラーなし（任意フィールド）', () => {
    const { result } = renderHook(() => useFormValidation<TestField>(testRules));

    let error: string | undefined;
    act(() => {
      error = result.current.validateField('website', '');
    });

    expect(error).toBeUndefined();
    expect(result.current.errors.website).toBeUndefined();
  });

  it('validateAll - 複数エラー', () => {
    const { result } = renderHook(() => useFormValidation<TestField>(testRules));

    let errors: Record<string, string | undefined> = {};
    act(() => {
      errors = result.current.validateAll({
        name: '',
        email: 'invalid',
        website: 'not-a-url',
      });
    });

    expect(errors.name).toBe('名前は必須です');
    expect(errors.email).toBe('正しいメールアドレス形式で入力してください');
    expect(errors.website).toBe('URLはhttp://またはhttps://で始めてください');
    expect(result.current.hasErrors).toBe(true);
  });

  it('validateAll - エラーなし', () => {
    const { result } = renderHook(() => useFormValidation<TestField>(testRules));

    let errors: Record<string, string | undefined> = {};
    act(() => {
      errors = result.current.validateAll({
        name: 'テスト',
        email: 'test@example.com',
        website: 'https://example.com',
      });
    });

    expect(errors).toEqual({});
    expect(result.current.hasErrors).toBe(false);
  });

  it('clearErrors で全エラーがクリアされる', () => {
    const { result } = renderHook(() => useFormValidation<TestField>(testRules));

    act(() => {
      result.current.validateAll({
        name: '',
        email: 'invalid',
        website: '',
      });
    });

    expect(result.current.hasErrors).toBe(true);

    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.errors).toEqual({});
    expect(result.current.hasErrors).toBe(false);
  });

  it('clearFieldError で指定フィールドのエラーのみクリアされる', () => {
    const { result } = renderHook(() => useFormValidation<TestField>(testRules));

    act(() => {
      result.current.validateAll({
        name: '',
        email: 'invalid',
        website: '',
      });
    });

    expect(result.current.errors.name).toBeDefined();
    expect(result.current.errors.email).toBeDefined();

    act(() => {
      result.current.clearFieldError('name');
    });

    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.errors.email).toBeDefined();
    expect(result.current.hasErrors).toBe(true);
  });
});
