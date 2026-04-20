import { NextResponse } from 'next/server';
import { User } from '../../../src/types/user';

// モックデータ: 実際のバックエンド実装後に置き換える
const mockUsers: User[] = [
  {
    id: '1',
    name: '山田太郎',
    email: 'yamada@example.com',
    avatarUrl: '/default-avatar.png',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: '鈴木花子',
    email: 'suzuki@example.com',
    avatarUrl: '/default-avatar.png',
    createdAt: '2024-02-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'John Smith',
    email: 'john.smith@example.com',
    avatarUrl: '/default-avatar.png',
    createdAt: '2024-03-01T00:00:00Z',
  },
];

export async function GET() {
  return NextResponse.json(mockUsers);
}
