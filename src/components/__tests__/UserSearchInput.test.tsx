import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserSearchInput } from '../UserSearchInput';

describe('UserSearchInput', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('検索入力フィールドが表示される', () => {
    render(<UserSearchInput {...defaultProps} />);
    expect(screen.getByRole('textbox', { name: 'ユーザー検索' })).toBeInTheDocument();
  });

  it('プレースホルダーが表示される', () => {
    render(<UserSearchInput {...defaultProps} />);
    expect(screen.getByPlaceholderText('名前またはメールアドレスで検索')).toBeInTheDocument();
  });

  it('入力時にonChangeが呼ばれる', () => {
    render(<UserSearchInput {...defaultProps} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('test');
  });

  it('入力値がある場合にクリアボタンが表示される', () => {
    render(<UserSearchInput {...defaultProps} value="test" />);
    expect(screen.getByRole('button', { name: '検索をクリア' })).toBeInTheDocument();
  });

  it('入力値が空の場合にクリアボタンが非表示', () => {
    render(<UserSearchInput {...defaultProps} />);
    expect(screen.queryByRole('button', { name: '検索をクリア' })).not.toBeInTheDocument();
  });

  it('クリアボタン押下でonChange("")が呼ばれる', () => {
    render(<UserSearchInput {...defaultProps} value="test" />);
    fireEvent.click(screen.getByRole('button', { name: '検索をクリア' }));
    expect(defaultProps.onChange).toHaveBeenCalledWith('');
  });

  it('入力値がある場合に検索結果件数が表示される', () => {
    render(<UserSearchInput {...defaultProps} value="test" resultCount={3} />);
    expect(screen.getByText('検索結果: 3件')).toBeInTheDocument();
  });

  it('isSearchingがtrueの場合に「検索中...」が表示される', () => {
    render(<UserSearchInput {...defaultProps} value="test" isSearching={true} />);
    expect(screen.getByText('検索中...')).toBeInTheDocument();
  });
});
