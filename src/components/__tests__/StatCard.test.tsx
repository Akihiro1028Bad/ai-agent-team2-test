import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  it('タイトル・値・単位が正しく表示される', () => {
    render(<StatCard title="月間アクティブ日数" value={18} unit="日" />);

    expect(screen.getByText('月間アクティブ日数')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('日')).toBeInTheDocument();
  });

  it('aria-labelが正しく設定される', () => {
    render(<StatCard title="累計投稿数" value={142} unit="件" />);

    expect(screen.getByRole('region')).toHaveAttribute(
      'aria-label',
      '累計投稿数: 142件'
    );
  });
});
