import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserCard } from '../UserCard';
import { User } from '../../types/user';

const mockUser: User = {
  id: 'user-1',
  name: 'テストユーザー',
  email: 'test@example.com',
  avatarUrl: 'https://example.com/avatar.png',
  createdAt: new Date('2024-01-01'),
};

describe('UserCard', () => {
  it('正常な name が表示される', () => {
    render(<UserCard user={mockUser} />);

    expect(screen.getByText('テストユーザー')).toBeInTheDocument();
  });

  it('name が空文字の場合にフォールバック表示される', () => {
    const userWithEmptyName: User = { ...mockUser, name: '' };
    render(<UserCard user={userWithEmptyName} />);

    expect(screen.getByText('名前未設定')).toBeInTheDocument();
  });

  it('email が表示される', () => {
    render(<UserCard user={mockUser} />);

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('avatarUrl が未指定の場合にデフォルト画像が使用される', () => {
    const userWithoutAvatar: User = { ...mockUser, avatarUrl: undefined };
    render(<UserCard user={userWithoutAvatar} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/default-avatar.png');
  });

  it('onClick が呼ばれる', () => {
    const mockOnClick = jest.fn();
    render(<UserCard user={mockUser} onClick={mockOnClick} />);

    fireEvent.click(screen.getByText('テストユーザー'));

    expect(mockOnClick).toHaveBeenCalledWith(mockUser);
  });

  it('onClick が未指定でもエラーにならない', () => {
    expect(() => {
      render(<UserCard user={mockUser} />);
      fireEvent.click(screen.getByText('テストユーザー'));
    }).not.toThrow();
  });

  it('lastLoginAt が ISO 8601 文字列の場合に YYYY/MM/DD 形式で表示される', () => {
    const userWithLogin: User = { ...mockUser, lastLoginAt: '2026-06-12T10:30:00.000Z' };
    render(<UserCard user={userWithLogin} />);

    expect(screen.getByText(/最終ログイン:/)).toBeInTheDocument();
    expect(screen.getByText(/2026\/06\/12/)).toBeInTheDocument();
  });

  it('lastLoginAt が null の場合に「ログイン履歴なし」が表示される', () => {
    const userWithNullLogin: User = { ...mockUser, lastLoginAt: null };
    render(<UserCard user={userWithNullLogin} />);

    expect(screen.getByText(/ログイン履歴なし/)).toBeInTheDocument();
  });

  it('lastLoginAt が undefined の場合に「ログイン履歴なし」が表示される', () => {
    const userWithUndefinedLogin: User = { ...mockUser, lastLoginAt: undefined };
    render(<UserCard user={userWithUndefinedLogin} />);

    expect(screen.getByText(/ログイン履歴なし/)).toBeInTheDocument();
  });
});
