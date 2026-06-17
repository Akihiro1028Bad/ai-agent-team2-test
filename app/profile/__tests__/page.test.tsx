import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileClient from '../ProfileClient';
import { getUserProfile, updateUserProfile } from '../../../src/api/client';

jest.mock('../../../src/api/client');

const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const mockUpdateUserProfile = updateUserProfile as jest.MockedFunction<typeof updateUserProfile>;

const mockProfile = {
  id: 'current-user-id',
  name: 'テストユーザー',
  email: 'test@example.com',
  avatarUrl: 'https://example.com/avatar.png',
  bio: '自己紹介文です',
  location: '東京',
  website: 'https://example.com',
  createdAt: new Date('2024-01-01'),
};

describe('ProfileClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ローディング中は role="status" を持つ要素が表示される', () => {
    mockGetUserProfile.mockReturnValue(new Promise(() => {}));

    render(<ProfileClient userId="current-user-id" />);

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveTextContent('読み込み中...');
  });

  it('プロフィールが正常に表示される', async () => {
    mockGetUserProfile.mockResolvedValue(mockProfile);

    render(<ProfileClient userId="current-user-id" />);

    await waitFor(() => {
      expect(screen.getByText('テストユーザー')).toBeInTheDocument();
    });

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('プロフィールを編集')).toBeInTheDocument();
  });

  it('API エラー時にエラーメッセージと再試行ボタンが表示される', async () => {
    mockGetUserProfile.mockRejectedValue(new Error('Fetch failed'));

    render(<ProfileClient userId="current-user-id" />);

    await waitFor(() => {
      expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument();
  });

  it('再試行ボタンをクリックすると onRetry コールバックが呼ばれる', async () => {
    mockGetUserProfile.mockRejectedValue(new Error('Fetch failed'));

    const onRetryMock = jest.fn();
    render(<ProfileClient userId="current-user-id" onRetry={onRetryMock} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it('編集ボタン押下で編集モードに遷移する', async () => {
    mockGetUserProfile.mockResolvedValue(mockProfile);

    render(<ProfileClient userId="current-user-id" />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールを編集')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('プロフィールを編集'));

    expect(screen.getByText('プロフィール編集')).toBeInTheDocument();
    expect(screen.getByDisplayValue('テストユーザー')).toBeInTheDocument();
  });

  it('保存後に閲覧モードに復帰する', async () => {
    mockGetUserProfile.mockResolvedValue(mockProfile);
    mockUpdateUserProfile.mockResolvedValue({ ...mockProfile, name: '更新名' });

    render(<ProfileClient userId="current-user-id" />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールを編集')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('プロフィールを編集'));

    fireEvent.submit(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.queryByText('プロフィール編集')).not.toBeInTheDocument();
      expect(screen.getByText('プロフィールを編集')).toBeInTheDocument();
    });
  });
});
