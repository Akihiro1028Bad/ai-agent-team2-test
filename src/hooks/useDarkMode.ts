'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'theme';

function getInitialTheme(): boolean {
  // サーバーサイドレンダリング時は false を返す
  if (typeof window === 'undefined') return false;

  // localStorage から保存済みテーマを取得
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark') return true;
  if (saved === 'light') return false;

  // localStorage に値がない場合は OS の設定を参照
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useDarkMode(): {
  isDark: boolean;
  toggle: () => void;
} {
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    // クライアントサイドでのみ初期値を設定
    setIsDark(getInitialTheme());
  }, []);

  useEffect(() => {
    // data-theme 属性の更新と localStorage への保存
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [isDark]);

  const toggle = () => setIsDark((prev) => !prev);

  return { isDark, toggle };
}
