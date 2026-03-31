import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProfileEditForm } from '../ProfileEditForm';

const defaultProps = {
  initialValues: {
    bio: 'テスト自己紹介',
    location: 'Tokyo, Japan',
    website: 'https://example.com',
  },
  onSave: jest.fn().mockResolvedValue(undefined),
  onCancel: jest.fn(),
  saving: false,
};

describe('ProfileEditForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('初期値がフォームに反映される', () => {
    render(<ProfileEditForm {...defaultProps} />);

    expect(screen.getByLabelText('自己紹介')).toHaveValue('テスト自己紹介');
    expect(screen.getByLabelText('所在地')).toHaveValue('Tokyo, Japan');
    expect(screen.getByLabelText('Webサイト')).toHaveValue('https://example.com');
  });

  it('bio 500文字超でバリデーションエラーが表示される', async () => {
    render(<ProfileEditForm {...defaultProps} />);

    const bioField = screen.getByLabelText('自己紹介');
    // maxLength属性があるため直接setで超過値をセット
    fireEvent.change(bioField, { target: { value: 'a'.repeat(501) } });
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(screen.getByText('自己紹介は500文字以内で入力してください')).toBeInTheDocument();
    });

    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('websiteに不正なURLを入力するとバリデーションエラーが表示される', async () => {
    render(<ProfileEditForm {...defaultProps} />);

    const websiteField = screen.getByLabelText('Webサイト');
    fireEvent.change(websiteField, { target: { value: 'invalid-url' } });
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(screen.getByText('有効なURL（http:// または https://）を入力してください')).toBeInTheDocument();
    });

    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('正常入力時に保存ボタンクリックでonSaveが正しい引数で呼ばれる', async () => {
    render(<ProfileEditForm {...defaultProps} />);

    const bioField = screen.getByLabelText('自己紹介');
    fireEvent.change(bioField, { target: { value: '更新された自己紹介' } });

    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith({
        bio: '更新された自己紹介',
        location: 'Tokyo, Japan',
        website: 'https://example.com',
      });
    });
  });

  it('キャンセルボタンクリックでonCancelが呼ばれる', () => {
    render(<ProfileEditForm {...defaultProps} />);

    fireEvent.click(screen.getByText('キャンセル'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('saving=true時にボタンがdisabledになり「保存中...」が表示される', () => {
    render(<ProfileEditForm {...defaultProps} saving={true} />);

    const saveButton = screen.getByText('保存中...');
    expect(saveButton).toBeDisabled();

    const cancelButton = screen.getByText('キャンセル');
    expect(cancelButton).toBeDisabled();
  });
});
