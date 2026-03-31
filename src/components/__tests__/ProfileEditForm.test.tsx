import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileEditForm } from '../ProfileEditForm';
import { UserProfile } from '../../types/user';

const mockProfile: UserProfile = {
  id: 'user-1',
  name: 'テストユーザー',
  email: 'test@example.com',
  avatarUrl: 'https://example.com/avatar.png',
  bio: '自己紹介文です',
  location: '東京',
  website: 'https://example.com',
  createdAt: new Date('2024-01-01'),
};

describe('ProfileEditForm', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  it('初期値が正しく表示される', () => {
    render(
      <ProfileEditForm
        profile={mockProfile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByDisplayValue('テストユーザー')).toBeInTheDocument();
    expect(screen.getByDisplayValue('自己紹介文です')).toBeInTheDocument();
    expect(screen.getByDisplayValue('東京')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument();
  });

  it('email と createdAt が読み取り専用で表示される', () => {
    render(
      <ProfileEditForm
        profile={mockProfile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    // メールアドレスは input ではなくテキストとして表示
    const emailInputs = screen.queryAllByDisplayValue('test@example.com');
    expect(emailInputs).toHaveLength(0);
  });

  it('名前が空の場合にバリデーションエラーが表示される', async () => {
    render(
      <ProfileEditForm
        profile={mockProfile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const nameInput = screen.getByDisplayValue('テストユーザー');
    await userEvent.clear(nameInput);

    fireEvent.submit(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.getByText('名前は必須です')).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('website が https:// で始まらない場合にバリデーションエラー', async () => {
    render(
      <ProfileEditForm
        profile={{ ...mockProfile, website: '' }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const websiteInput = screen.getByLabelText('Webサイト');
    await userEvent.type(websiteInput, 'http://example.com');

    fireEvent.submit(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.getByText('URLは https:// で始めてください')).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('正しい値で保存ボタンを押すと onSave が呼ばれる', async () => {
    render(
      <ProfileEditForm
        profile={mockProfile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.submit(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'テストユーザー',
        bio: '自己紹介文です',
        location: '東京',
        website: 'https://example.com',
      });
    });
  });

  it('保存失敗時にエラーメッセージが表示される', async () => {
    mockOnSave.mockRejectedValue(new Error('サーバーエラー'));

    render(
      <ProfileEditForm
        profile={mockProfile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.submit(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.getByText('サーバーエラー')).toBeInTheDocument();
    });
  });

  it('キャンセルボタンで onCancel が呼ばれる', () => {
    render(
      <ProfileEditForm
        profile={mockProfile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByText('キャンセル'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('保存中はボタンが無効化される', async () => {
    let resolveOnSave: () => void;
    mockOnSave.mockImplementation(
      () => new Promise<void>((resolve) => { resolveOnSave = resolve; })
    );

    render(
      <ProfileEditForm
        profile={mockProfile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.submit(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.getByText('保存中...')).toBeInTheDocument();
      expect(screen.getByText('保存中...')).toBeDisabled();
      expect(screen.getByText('キャンセル')).toBeDisabled();
    });

    await act(async () => {
      resolveOnSave!();
    });
  });
});

// act を import
import { act } from '@testing-library/react';
