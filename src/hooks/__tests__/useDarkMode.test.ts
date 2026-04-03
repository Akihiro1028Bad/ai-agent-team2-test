import { renderHook, act, waitFor } from '@testing-library/react';
import { useDarkMode } from '../useDarkMode';

describe('useDarkMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it('初期値（localStorageなし、OS設定なし）: isDarkがfalseであること', async () => {
    const { result } = renderHook(() => useDarkMode());

    await waitFor(() => {
      expect(result.current.isDark).toBe(false);
    });
  });

  it('localStorageに"dark"が保存されている場合: isDarkがtrueであること', async () => {
    localStorage.setItem('theme', 'dark');

    const { result } = renderHook(() => useDarkMode());

    await waitFor(() => {
      expect(result.current.isDark).toBe(true);
    });
  });

  it('localStorageに"light"が保存されている場合: isDarkがfalseであること', async () => {
    localStorage.setItem('theme', 'light');

    const { result } = renderHook(() => useDarkMode());

    await waitFor(() => {
      expect(result.current.isDark).toBe(false);
    });
  });

  it('OS設定がダークモードの場合（localStorageなし）: isDarkがtrueであること', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    const { result } = renderHook(() => useDarkMode());

    await waitFor(() => {
      expect(result.current.isDark).toBe(true);
    });
  });

  it('toggleを呼び出した場合: isDarkが反転すること', async () => {
    const { result } = renderHook(() => useDarkMode());

    await waitFor(() => {
      expect(result.current.isDark).toBe(false);
    });

    act(() => {
      result.current.toggle();
    });

    await waitFor(() => {
      expect(result.current.isDark).toBe(true);
    });

    act(() => {
      result.current.toggle();
    });

    await waitFor(() => {
      expect(result.current.isDark).toBe(false);
    });
  });

  it('toggle後にlocalStorage.setItemが正しいキー・値で呼ばれること', async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() => useDarkMode());

    await waitFor(() => {
      expect(result.current.isDark).toBe(false);
    });

    act(() => {
      result.current.toggle();
    });

    await waitFor(() => {
      expect(result.current.isDark).toBe(true);
    });

    expect(setItemSpy).toHaveBeenCalledWith('theme', 'dark');

    setItemSpy.mockRestore();
  });

  it('toggle後にdocument.documentElement.getAttribute("data-theme")が正しい値になること', async () => {
    const { result } = renderHook(() => useDarkMode());

    await waitFor(() => {
      expect(result.current.isDark).toBe(false);
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    act(() => {
      result.current.toggle();
    });

    await waitFor(() => {
      expect(result.current.isDark).toBe(true);
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
