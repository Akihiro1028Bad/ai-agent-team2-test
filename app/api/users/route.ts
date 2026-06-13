import { NextResponse } from 'next/server';
import { User } from '../../../src/types/user';

const mockUsers: User[] = [
  {
    id: '1',
    name: '山田 太郎',
    email: 'taro.yamada@example.com',
    avatarUrl: 'https://i.pravatar.cc/150?img=1',
    createdAt: '2025-01-15T09:00:00.000Z',
    lastLoginAt: '2026-06-12T10:30:00.000Z',
  },
  {
    id: '2',
    name: '鈴木 花子',
    email: 'hanako.suzuki@example.com',
    avatarUrl: 'https://i.pravatar.cc/150?img=2',
    createdAt: '2025-03-20T12:00:00.000Z',
    lastLoginAt: '2026-05-28T08:15:00.000Z',
  },
  {
    id: '3',
    name: '田中 一郎',
    email: 'ichiro.tanaka@example.com',
    avatarUrl: undefined,
    createdAt: '2025-06-01T15:30:00.000Z',
    lastLoginAt: null,
  },
  {
    id: '4',
    name: '佐藤 美咲',
    email: 'misaki.sato@example.com',
    avatarUrl: 'https://i.pravatar.cc/150?img=4',
    createdAt: '2025-08-10T11:00:00.000Z',
    lastLoginAt: '2026-06-10T20:45:00.000Z',
  },
  {
    id: '5',
    name: '伊藤 健太',
    email: 'kenta.ito@example.com',
    avatarUrl: undefined,
    createdAt: '2026-01-05T08:00:00.000Z',
    lastLoginAt: null,
  },
];

export async function GET() {
  try {
    return NextResponse.json(mockUsers);
  } catch {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
