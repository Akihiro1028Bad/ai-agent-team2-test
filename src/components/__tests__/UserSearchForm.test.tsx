import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserSearchForm } from '../UserSearchForm';

describe('UserSearchForm', () => {
  it('検索入力フィールドが表示される', () => {
    render(<UserSearchForm query="" onQueryChange={jest.fn()} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('プレースホルダーが表示される', () => {
    render(<UserSearchForm query="" onQueryChange={jest.fn()} />);

    expect(screen.getByPlaceholderText('名前またはメールアドレスで検索')).toBeInTheDocument();
  });

  it('テキスト入力時に onQueryChange が呼ばれる', () => {
    const mockOnQueryChange = jest.fn();
    render(<UserSearchForm query="" onQueryChange={mockOnQueryChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '山田' } });

    expect(mockOnQueryChange).toHaveBeenCalledWith('山田');
  });
});
