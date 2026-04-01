import { NextRequest, NextResponse } from 'next/server';
import { NotificationSettings } from '../../../../src/types/notification';

// モックデータ（インメモリ保存 — サーバー再起動でリセット）
let mockSettings: NotificationSettings = {
  emailEnabled: true,
  pushEnabled: true,
  frequency: 'immediate',
};

export async function GET() {
  // TODO: NextAuth.js 認証チェック
  return NextResponse.json(mockSettings);
}

export async function PATCH(request: NextRequest) {
  // TODO: NextAuth.js 認証チェック
  const body = await request.json();

  // バリデーション
  if (body.frequency && !['immediate', 'daily', 'weekly'].includes(body.frequency)) {
    return NextResponse.json(
      { error: '無効な通知頻度です' },
      { status: 400 }
    );
  }

  mockSettings = { ...mockSettings, ...body };
  return NextResponse.json(mockSettings);
}
