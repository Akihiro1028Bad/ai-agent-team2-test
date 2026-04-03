import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserSearchInput } from '../UserSearchInput';

describe('UserSearchInput', () => {
  it('検索入力フィールドが表示される', () => {
    render(<UserSearchInput value="" onChange={jest.fn()} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('デフォルトのプレースホルダーが表示される', () => {
    render(<UserSearchInput value="" onChange={jest.fn()} />);

    expect(screen.getByPlaceholderText('名前またはメールアドレスで検索')).toBeInTheDocument();
  });

  it('テキスト入力時にonChangeが呼ばれる', () => {
    const mockOnChange = jest.fn();
    render(<UserSearchInput value="" onChange={mockOnChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'テスト' } });

    expect(mockOnChange).toHaveBeenCalledWith('テスト');
  });

  it('value propsが入力フィールドに反映される', () => {
    render(<UserSearchInput value="検索テキスト" onChange={jest.fn()} />);

    expect(screen.getByRole('textbox')).toHaveValue('検索テキスト');
  });

  it('aria-label="ユーザー検索"が付与されている', () => {
    render(<UserSearchInput value="" onChange={jest.fn()} />);

    expect(screen.getByLabelText('ユーザー検索')).toBeInTheDocument();
  });
});
