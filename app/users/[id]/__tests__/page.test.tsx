import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import UserProfilePage from '../page';
import { getUserProfile } from '../../../../src/api/client';

jest.mock('../../../../src/api/client');
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'user-123' }),
}));

const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;

const mockProfile = {
  id: 'user-123',
  name: '他のユーザー',
  email: 'other@example.com',
  avatarUrl: 'https://example.com/other-avatar.png',
  bio: '他のユーザーの自己紹介',
  location: '大阪',
  website: 'https://other.example.com',
  createdAt: new Date('2024-03-15'),
};

describe('UserProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('URL パラメータからプロフィールを取得して表示する', async () => {
    mockGetUserProfile.mockResolvedValue(mockProfile);

    render(<UserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('他のユーザー')).toBeInTheDocument();
    });

    expect(screen.getByText('other@example.com')).toBeInTheDocument();
    expect(screen.getByText('他のユーザーの自己紹介')).toBeInTheDocument();
    expect(mockGetUserProfile).toHaveBeenCalledWith('user-123');
  });

  it('編集ボタンが非表示である', async () => {
    mockGetUserProfile.mockResolvedValue(mockProfile);

    render(<UserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('他のユーザー')).toBeInTheDocument();
    });

    expect(screen.queryByText('プロフィールを編集')).not.toBeInTheDocument();
  });

  it('API エラー時にエラーメッセージが表示される', async () => {
    mockGetUserProfile.mockRejectedValue(new Error('User not found'));

    render(<UserProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
    });
  });

  it('ローディング中は「読み込み中...」が表示される', () => {
    mockGetUserProfile.mockReturnValue(new Promise(() => {}));

    render(<UserProfilePage />);
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });
});
