import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationSettingsForm } from '../NotificationSettingsForm';
import { NotificationSettings } from '../../types/notification';

const mockSettings: NotificationSettings = {
  emailEnabled: true,
  pushEnabled: true,
  frequency: 'immediate',
};

describe('NotificationSettingsForm', () => {
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  it('初期表示で渡された設定値がフォームに反映される', () => {
    render(<NotificationSettingsForm settings={mockSettings} onSave={mockOnSave} />);

    expect(screen.getByText('通知設定')).toBeInTheDocument();
    expect(screen.getByLabelText('メール通知')).toBeChecked();
    expect(screen.getByLabelText('プッシュ通知')).toBeChecked();
    expect(screen.getByLabelText('通知頻度')).toHaveValue('immediate');
  });

  it('メール通知のON/OFF切り替えができる', async () => {
    render(<NotificationSettingsForm settings={mockSettings} onSave={mockOnSave} />);

    const emailCheckbox = screen.getByLabelText('メール通知');
    await userEvent.click(emailCheckbox);

    expect(emailCheckbox).not.toBeChecked();
  });

  it('プッシュ通知のON/OFF切り替えができる', async () => {
    render(<NotificationSettingsForm settings={mockSettings} onSave={mockOnSave} />);

    const pushCheckbox = screen.getByLabelText('プッシュ通知');
    await userEvent.click(pushCheckbox);

    expect(pushCheckbox).not.toBeChecked();
  });

  it('通知頻度の変更ができる', async () => {
    render(<NotificationSettingsForm settings={mockSettings} onSave={mockOnSave} />);

    const select = screen.getByLabelText('通知頻度');
    await userEvent.selectOptions(select, 'daily');

    expect(select).toHaveValue('daily');
  });

  it('保存ボタンクリックで onSave が正しいデータで呼ばれる', async () => {
    render(<NotificationSettingsForm settings={mockSettings} onSave={mockOnSave} />);

    fireEvent.submit(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        emailEnabled: true,
        pushEnabled: true,
        frequency: 'immediate',
      });
    });
  });

  it('保存中は「保存中...」が表示され、ボタンが非活性になる', async () => {
    let resolveOnSave: () => void;
    mockOnSave.mockImplementation(
      () => new Promise<void>((resolve) => { resolveOnSave = resolve; })
    );

    render(<NotificationSettingsForm settings={mockSettings} onSave={mockOnSave} />);

    fireEvent.submit(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.getByText('保存中...')).toBeInTheDocument();
      expect(screen.getByText('保存中...')).toBeDisabled();
    });

    await act(async () => {
      resolveOnSave!();
    });
  });

  it('保存エラー時にエラーメッセージが表示される', async () => {
    mockOnSave.mockRejectedValue(new Error('サーバーエラー'));

    render(<NotificationSettingsForm settings={mockSettings} onSave={mockOnSave} />);

    fireEvent.submit(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.getByText('設定の保存に失敗しました')).toBeInTheDocument();
    });
  });

  it('保存成功時に成功メッセージが表示される', async () => {
    render(<NotificationSettingsForm settings={mockSettings} onSave={mockOnSave} />);

    fireEvent.submit(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.getByText('設定を保存しました')).toBeInTheDocument();
    });
  });
});
