import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserProfileView } from '../UserProfileView';
import { UserProfile } from '../../types/user';

const fullProfile: UserProfile = {
  id: 'user-1',
  name: 'テストユーザー',
  email: 'test@example.com',
  avatarUrl: 'https://example.com/avatar.png',
  bio: '自己紹介文です',
  location: '東京',
  website: 'https://example.com',
  createdAt: new Date('2024-01-01'),
};

const minimalProfile: UserProfile = {
  id: 'user-2',
  name: 'ミニマルユーザー',
  email: 'minimal@example.com',
  createdAt: new Date('2024-06-15'),
};

describe('UserProfileView', () => {
  it('全フィールドが表示される', () => {
    render(
      <UserProfileView profile={fullProfile} editable={false} />
    );

    expect(screen.getByText('テストユーザー')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('自己紹介文です')).toBeInTheDocument();
    expect(screen.getByText('東京')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByAltText('テストユーザー')).toHaveAttribute(
      'src',
      'https://example.com/avatar.png'
    );
  });

  it('オプショナルフィールドが無い場合は非表示', () => {
    render(
      <UserProfileView profile={minimalProfile} editable={false} />
    );

    expect(screen.getByText('ミニマルユーザー')).toBeInTheDocument();
    expect(screen.getByText('minimal@example.com')).toBeInTheDocument();
    expect(screen.queryByText('自己紹介')).not.toBeInTheDocument();
    expect(screen.queryByText('所在地')).not.toBeInTheDocument();
    expect(screen.queryByText('Webサイト')).not.toBeInTheDocument();
  });

  it('avatarUrl が無い場合はデフォルト画像が使われる', () => {
    render(
      <UserProfileView profile={minimalProfile} editable={false} />
    );

    expect(screen.getByAltText('ミニマルユーザー')).toHaveAttribute(
      'src',
      '/default-avatar.png'
    );
  });

  it('editable=true の場合に編集ボタンが表示される', () => {
    const onEdit = jest.fn();
    render(
      <UserProfileView profile={fullProfile} editable={true} onEdit={onEdit} />
    );

    const button = screen.getByText('プロフィールを編集');
    expect(button).toBeInTheDocument();
  });

  it('editable=false の場合に編集ボタンが非表示', () => {
    render(
      <UserProfileView profile={fullProfile} editable={false} />
    );

    expect(screen.queryByText('プロフィールを編集')).not.toBeInTheDocument();
  });

  it('profile が null の場合「ユーザーが見つかりません」が表示される', () => {
    render(
      <UserProfileView profile={null} editable={false} />
    );
    expect(screen.getByText('ユーザーが見つかりません')).toBeInTheDocument();
  });

  it('profile が undefined の場合「ユーザーが見つかりません」が表示される', () => {
    render(
      <UserProfileView profile={undefined} editable={false} />
    );
    expect(screen.getByText('ユーザーが見つかりません')).toBeInTheDocument();
  });

  it('編集ボタンクリックで onEdit が呼ばれる', () => {
    const onEdit = jest.fn();
    render(
      <UserProfileView profile={fullProfile} editable={true} onEdit={onEdit} />
    );

    fireEvent.click(screen.getByText('プロフィールを編集'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
