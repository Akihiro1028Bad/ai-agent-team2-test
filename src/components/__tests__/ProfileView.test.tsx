import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProfileView } from '../ProfileView';
import { UserProfile } from '../../types/user';

const fullProfile: UserProfile = {
  id: 'u_123',
  name: 'Test User',
  email: 'test@example.com',
  avatarUrl: 'https://example.com/avatar.png',
  createdAt: new Date('2024-01-15T09:00:00Z'),
  bio: 'TypeScript好きのエンジニアです。',
  location: 'Tokyo, Japan',
  website: 'https://example.com',
};

const emptyProfile: UserProfile = {
  id: 'u_456',
  name: 'Empty User',
  email: 'empty@example.com',
  createdAt: new Date('2024-06-01T00:00:00Z'),
};

describe('ProfileView', () => {
  it('全フィールドが正しくレンダリングされる', () => {
    const onEdit = jest.fn();
    render(<ProfileView profile={fullProfile} onEdit={onEdit} />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('TypeScript好きのエンジニアです。')).toBeInTheDocument();
    expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();

    const avatar = screen.getByAltText('Test User') as HTMLImageElement;
    expect(avatar.src).toBe('https://example.com/avatar.png');
  });

  it('未設定フィールドで「未設定」が表示される', () => {
    const onEdit = jest.fn();
    render(<ProfileView profile={emptyProfile} onEdit={onEdit} />);

    const unsetElements = screen.getAllByText('未設定');
    expect(unsetElements.length).toBe(3); // bio, location, website
  });

  it('avatarUrl未設定時にデフォルト画像が使用される', () => {
    const onEdit = jest.fn();
    render(<ProfileView profile={emptyProfile} onEdit={onEdit} />);

    const avatar = screen.getByAltText('Empty User') as HTMLImageElement;
    expect(avatar.src).toContain('/default-avatar.png');
  });

  it('登録日がYYYY/MM/DD形式で表示される', () => {
    const onEdit = jest.fn();
    render(<ProfileView profile={fullProfile} onEdit={onEdit} />);

    expect(screen.getByText('2024/01/15')).toBeInTheDocument();
  });

  it('編集ボタンクリックでonEditが呼ばれる', () => {
    const onEdit = jest.fn();
    render(<ProfileView profile={fullProfile} onEdit={onEdit} />);

    fireEvent.click(screen.getByText('編集'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('websiteがリンクとして表示される', () => {
    const onEdit = jest.fn();
    render(<ProfileView profile={fullProfile} onEdit={onEdit} />);

    const link = screen.getByText('https://example.com') as HTMLAnchorElement;
    expect(link.tagName).toBe('A');
    expect(link.href).toBe('https://example.com/');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });
});
