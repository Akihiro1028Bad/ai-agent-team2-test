import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from '@testing-library/react';
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

  it('website が不正な形式の場合にバリデーションエラー', async () => {
    render(
      <ProfileEditForm
        profile={{ ...mockProfile, website: '' }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const websiteInput = screen.getByLabelText('Webサイト');
    await userEvent.type(websiteInput, 'not-a-url');

    fireEvent.submit(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(
        screen.getByText('URLは http:// または https:// で始まる正しい形式で入力してください')
      ).toBeInTheDocument();
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

  // --- 新規テストケース ---

  it('名前が51文字以上の場合にバリデーションエラーが表示される', async () => {
    render(
      <ProfileEditForm
        profile={{ ...mockProfile, name: '' }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const nameInput = screen.getByLabelText('名前 *');
    // fireEvent.change で直接51文字を設定（maxLength属性をバイパス）
    fireEvent.change(nameInput, { target: { value: 'あ'.repeat(51) } });

    fireEvent.submit(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.getByText('名前は50文字以内で入力してください')).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('自己紹介が201文字以上の場合にバリデーションエラーが表示される', async () => {
    render(
      <ProfileEditForm
        profile={{ ...mockProfile, bio: '' }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const bioInput = screen.getByLabelText('自己紹介');
    // fireEvent.change で直接201文字を設定（maxLength属性をバイパス）
    fireEvent.change(bioInput, { target: { value: 'あ'.repeat(201) } });

    fireEvent.submit(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.getByText('自己紹介は200文字以内で入力してください')).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('websiteが http:// の場合はバリデーションエラーにならない', async () => {
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
      expect(mockOnSave).toHaveBeenCalled();
    });

    expect(
      screen.queryByText('URLは http:// または https:// で始まる正しい形式で入力してください')
    ).not.toBeInTheDocument();
  });

  it('websiteが不正な形式の場合にエラーメッセージが表示される', async () => {
    render(
      <ProfileEditForm
        profile={{ ...mockProfile, website: '' }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const websiteInput = screen.getByLabelText('Webサイト');
    await userEvent.type(websiteInput, 'invalid-url');

    fireEvent.submit(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(
        screen.getByText('URLは http:// または https:// で始まる正しい形式で入力してください')
      ).toBeInTheDocument();
    });
  });

  it('onBlurでバリデーションが発火する', async () => {
    render(
      <ProfileEditForm
        profile={mockProfile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const nameInput = screen.getByDisplayValue('テストユーザー');
    await userEvent.clear(nameInput);
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(screen.getByText('名前は必須です')).toBeInTheDocument();
    });
  });

  it('バリデーションエラー時に送信ボタンがdisabledになる', async () => {
    render(
      <ProfileEditForm
        profile={mockProfile}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const nameInput = screen.getByDisplayValue('テストユーザー');
    await userEvent.clear(nameInput);
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(screen.getByText('名前は必須です')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  });

  it('文字数カウンターが表示される', async () => {
    render(
      <ProfileEditForm
        profile={{ ...mockProfile, bio: 'テスト' }}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    // 初期値の文字数カウンター
    expect(screen.getByText('3/200')).toBeInTheDocument();

    // 入力後の文字数カウンター変化
    const bioInput = screen.getByLabelText('自己紹介');
    await userEvent.type(bioInput, 'ABC');

    await waitFor(() => {
      expect(screen.getByText('6/200')).toBeInTheDocument();
    });
  });
});
