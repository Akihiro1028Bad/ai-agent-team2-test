import React from 'react';
import { render, screen } from '@testing-library/react';
import { Header } from '../Header';
import { useUnreadCount } from '../../hooks/useUnreadCount';

jest.mock('../../hooks/useUnreadCount', () => ({
  useUnreadCount: jest.fn(),
}));

const mockUseUnreadCount = useUnreadCount as jest.Mock;

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockUseUnreadCount.mockReturnValue({ unreadCount: 0 });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it('<header>要素が表示されること', () => {
    render(<Header />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('「Sample App」が表示されること', () => {
    render(<Header />);

    expect(screen.getByText('Sample App')).toBeInTheDocument();
  });

  it('DarkModeToggle（トグルボタン）が含まれること', () => {
    render(<Header />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  describe('通知バッジ', () => {
    it('未読が0件のときバッジが表示されないこと', () => {
      mockUseUnreadCount.mockReturnValue({ unreadCount: 0 });
      render(<Header />);

      expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
    });

    it('未読が3件のときバッジに「3」が表示されること', () => {
      mockUseUnreadCount.mockReturnValue({ unreadCount: 3 });
      render(<Header />);

      const badge = screen.getByTestId('notification-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('3');
    });

    it('未読が1件のときバッジが表示されること', () => {
      mockUseUnreadCount.mockReturnValue({ unreadCount: 1 });
      render(<Header />);

      expect(screen.getByTestId('notification-badge')).toHaveTextContent('1');
    });

    it('未読が99件のときバッジに「99」が表示されること', () => {
      mockUseUnreadCount.mockReturnValue({ unreadCount: 99 });
      render(<Header />);

      expect(screen.getByTestId('notification-badge')).toHaveTextContent('99');
    });

    it('useUnreadCountがcount: 0を返すときバッジがDOMに存在しないこと（JSX短絡評価バグの回帰テスト）', () => {
      mockUseUnreadCount.mockReturnValue({ unreadCount: 0 });
      render(<Header />);

      // "0" という文字がDOMに描画されていないことも確認
      expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });
});
