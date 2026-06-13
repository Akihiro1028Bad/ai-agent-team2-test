import React from 'react';
import { render, screen } from '@testing-library/react';
import UsersPage from '../page';
import { useUsers } from '../../../src/hooks/useUsers';

jest.mock('../../../src/hooks/useUsers');

const mockUseUsers = useUsers as jest.MockedFunction<typeof useUsers>;

const mockUsers = [
  {
    id: 'user-1',
    name: '田中 太郎',
    email: 'taro@example.com',
    avatarUrl: 'https://example.com/taro.png',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastLoginAt: '2026-06-12T10:30:00.000Z',
  },
  {
    id: 'user-2',
    name: '佐藤 花子',
    email: 'hanako@example.com',
    createdAt: '2024-02-01T00:00:00.000Z',
    lastLoginAt: null,
  },
];

describe('UsersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ローディング中は「読み込み中...」が表示される', () => {
    mockUseUsers.mockReturnValue({ users: [], loading: true, error: null });

    render(<UsersPage />);
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('エラー時は「エラーが発生しました」が表示される', () => {
    mockUseUsers.mockReturnValue({
      users: [],
      loading: false,
      error: new Error('Network error'),
    });

    render(<UsersPage />);
    expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });

  it('空リスト時は「ユーザーが見つかりません」が表示される', () => {
    mockUseUsers.mockReturnValue({ users: [], loading: false, error: null });

    render(<UsersPage />);
    expect(screen.getByText('ユーザーが見つかりません')).toBeInTheDocument();
  });

  it('正常時はユーザー名が表示される', () => {
    mockUseUsers.mockReturnValue({ users: mockUsers, loading: false, error: null });

    render(<UsersPage />);
    expect(screen.getByText('田中 太郎')).toBeInTheDocument();
    expect(screen.getByText('佐藤 花子')).toBeInTheDocument();
  });

  it('正常時は最終ログイン日が YYYY/MM/DD 形式で表示される', () => {
    mockUseUsers.mockReturnValue({ users: mockUsers, loading: false, error: null });

    render(<UsersPage />);
    expect(screen.getByText('最終ログイン: 2026/06/12')).toBeInTheDocument();
  });

  it('lastLoginAt が null のユーザーには「ログイン履歴なし」が表示される', () => {
    mockUseUsers.mockReturnValue({ users: mockUsers, loading: false, error: null });

    render(<UsersPage />);
    expect(screen.getByText('最終ログイン: ログイン履歴なし')).toBeInTheDocument();
  });
});
