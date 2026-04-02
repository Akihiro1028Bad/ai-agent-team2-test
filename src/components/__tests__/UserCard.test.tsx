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
});
