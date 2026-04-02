import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import UsersPage from '../page';
import { getUsers } from '../../../src/api/client';
import { User } from '../../../src/types/user';

jest.mock('../../../src/api/client');

const mockGetUsers = getUsers as jest.MockedFunction<typeof getUsers>;

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

describe('UsersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('ユーザー一覧ページが正しく表示される', async () => {
    mockGetUsers.mockResolvedValue(mockUsers);

    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('ユーザー一覧')).toBeInTheDocument();
    });

    expect(screen.getByText('山田太郎')).toBeInTheDocument();
    expect(screen.getByText('佐藤花子')).toBeInTheDocument();
  });

  it('読み込み中に「読み込み中...」が表示される', () => {
    mockGetUsers.mockReturnValue(new Promise(() => {}));

    render(<UsersPage />);

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('エラー時にエラーメッセージが表示される', async () => {
    mockGetUsers.mockRejectedValue(new Error('Network error'));

    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
    });
  });

  it('検索フィールドに入力するとフィルタリングされる', async () => {
    jest.useFakeTimers();
    mockGetUsers.mockResolvedValue(mockUsers);

    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('山田太郎')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('名前またはメールアドレスで検索'), {
      target: { value: '山田' },
    });

    // debounce 300ms を待つ
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText('山田太郎')).toBeInTheDocument();
      expect(screen.queryByText('佐藤花子')).not.toBeInTheDocument();
    });
  });
});
