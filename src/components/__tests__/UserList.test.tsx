import React from 'react';
import { render, screen } from '@testing-library/react';
import { UserList } from '../UserList';
import { User } from '../../types/user';

const mockUsers: User[] = [
  {
    id: '1',
    name: '山田太郎',
    email: 'taro.yamada@example.com',
    createdAt: new Date('2024-01-15T09:00:00.000Z'),
  },
  {
    id: '2',
    name: '佐藤花子',
    email: 'hanako.sato@example.com',
    createdAt: new Date('2024-02-20T10:30:00.000Z'),
  },
];

describe('UserList', () => {
  it('渡されたユーザーが一覧表示される', () => {
    render(<UserList users={mockUsers} isSearching={false} />);

    expect(screen.getByText('山田太郎')).toBeInTheDocument();
    expect(screen.getByText('佐藤花子')).toBeInTheDocument();
  });

  it('ユーザー名とメールアドレスが表示される', () => {
    render(<UserList users={mockUsers} isSearching={false} />);

    expect(screen.getByText('山田太郎')).toBeInTheDocument();
    expect(screen.getByText('taro.yamada@example.com')).toBeInTheDocument();
    expect(screen.getByText('佐藤花子')).toBeInTheDocument();
    expect(screen.getByText('hanako.sato@example.com')).toBeInTheDocument();
  });

  it('各ユーザーが /users/[id] へのリンクを持つ', () => {
    render(<UserList users={mockUsers} isSearching={false} />);

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/users/1');
    expect(links[1]).toHaveAttribute('href', '/users/2');
  });

  it('isSearching=true で0件の場合にメッセージが表示される', () => {
    render(<UserList users={[]} isSearching={true} />);

    expect(screen.getByText('該当するユーザーが見つかりませんでした')).toBeInTheDocument();
  });

  it('isSearching=false で0件の場合にメッセージが表示されない', () => {
    render(<UserList users={[]} isSearching={false} />);

    expect(screen.queryByText('該当するユーザーが見つかりませんでした')).not.toBeInTheDocument();
  });
});
