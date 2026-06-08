import React from 'react';
import { render, screen } from '@testing-library/react';
import { Header } from '../Header';

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
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

  it('「プロフィール」リンクが表示されること', () => {
    render(<Header />);

    const link = screen.getByRole('link', { name: 'プロフィール' });
    expect(link).toBeInTheDocument();
  });

  it('「プロフィール」リンクが /profile を指すこと', () => {
    render(<Header />);

    const link = screen.getByRole('link', { name: 'プロフィール' });
    expect(link).toHaveAttribute('href', '/profile');
  });
});
