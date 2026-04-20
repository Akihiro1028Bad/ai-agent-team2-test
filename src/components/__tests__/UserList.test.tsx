import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserList } from '../UserList';
import { User } from '../../types/user';

const mockUsers: User[] = [
  { id: '1', name: '山田太郎', email: 'yamada@example.com', createdAt: '2024-01-01T00:00:00Z' },
  { id: '2', name: '鈴木花子', email: 'suzuki@example.com', createdAt: '2024-02-01T00:00:00Z' },
];

describe('UserList', () => {
  it('渡されたユーザーがUserCardで表示される', () => {
    render(<UserList users={mockUsers} isFiltered={false} />);

    expect(screen.getByText('山田太郎')).toBeInTheDocument();
    expect(screen.getByText('鈴木花子')).toBeInTheDocument();
  });

  it('フィルタリング結果0件時に「該当するユーザーが見つかりません」が表示される', () => {
    render(<UserList users={[]} isFiltered={true} />);

    expect(screen.getByText('該当するユーザーが見つかりません')).toBeInTheDocument();
  });

  it('ユーザー未登録時に「ユーザーが登録されていません」が表示される', () => {
    render(<UserList users={[]} isFiltered={false} />);

    expect(screen.getByText('ユーザーが登録されていません')).toBeInTheDocument();
  });

  it('ユーザーカードクリック時にonUserClickが呼ばれる', () => {
    const mockOnUserClick = jest.fn();
    render(<UserList users={mockUsers} isFiltered={false} onUserClick={mockOnUserClick} />);

    fireEvent.click(screen.getByText('山田太郎'));

    expect(mockOnUserClick).toHaveBeenCalledWith(mockUsers[0]);
  });
});
