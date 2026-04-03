import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DarkModeToggle } from '../DarkModeToggle';

describe('DarkModeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ライトモード時（isDark=false）: 🌙アイコンと「ダークモード」ラベルが表示されること', () => {
    render(<DarkModeToggle isDark={false} onToggle={jest.fn()} />);

    expect(screen.getByText('🌙')).toBeInTheDocument();
    expect(screen.getByText('ダークモード')).toBeInTheDocument();
  });

  it('ダークモード時（isDark=true）: ☀️アイコンと「ライトモード」ラベルが表示されること', () => {
    render(<DarkModeToggle isDark={true} onToggle={jest.fn()} />);

    expect(screen.getByText('☀️')).toBeInTheDocument();
    expect(screen.getByText('ライトモード')).toBeInTheDocument();
  });

  it('ライトモード時のaria-label: 「ダークモードに切り替え」であること', () => {
    render(<DarkModeToggle isDark={false} onToggle={jest.fn()} />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'ダークモードに切り替え');
  });

  it('ダークモード時のaria-label: 「ライトモードに切り替え」であること', () => {
    render(<DarkModeToggle isDark={true} onToggle={jest.fn()} />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'ライトモードに切り替え');
  });

  it('クリック時にonToggleが1回呼ばれること', () => {
    const mockOnToggle = jest.fn();
    render(<DarkModeToggle isDark={false} onToggle={mockOnToggle} />);

    fireEvent.click(screen.getByRole('button'));

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });
});
