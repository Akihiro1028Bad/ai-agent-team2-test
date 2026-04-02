import { NextResponse } from 'next/server';
import { User } from '../../../src/types/user';

// モックデータ（10件）— 実際のDB連携は後続Issueで対応
const mockUsers: User[] = [
  {
    id: '1',
    name: '山田太郎',
    email: 'taro.yamada@example.com',
    createdAt: new Date('2024-01-15T09:00:00.000Z'),
  },
  {
    id: '2',
    name: '佐藤花子',
    email: 'hanako.sato@example.com',
    createdAt: new Date('2024-02-20T10:30:00.000Z'),
  },
  {
    id: '3',
    name: '鈴木一郎',
    email: 'ichiro.suzuki@example.com',
    createdAt: new Date('2024-03-10T14:00:00.000Z'),
  },
  {
    id: '4',
    name: '田中美咲',
    email: 'misaki.tanaka@example.com',
    createdAt: new Date('2024-04-05T08:15:00.000Z'),
  },
  {
    id: '5',
    name: '高橋健太',
    email: 'kenta.takahashi@example.com',
    createdAt: new Date('2024-05-12T11:45:00.000Z'),
  },
  {
    id: '6',
    name: '伊藤あゆみ',
    email: 'ayumi.ito@example.com',
    createdAt: new Date('2024-06-18T16:20:00.000Z'),
  },
  {
    id: '7',
    name: '渡辺大輔',
    email: 'daisuke.watanabe@example.com',
    createdAt: new Date('2024-07-22T13:00:00.000Z'),
  },
  {
    id: '8',
    name: '小林さくら',
    email: 'sakura.kobayashi@example.com',
    createdAt: new Date('2024-08-30T09:30:00.000Z'),
  },
  {
    id: '9',
    name: '加藤裕太',
    email: 'yuta.kato@example.com',
    createdAt: new Date('2024-09-14T15:00:00.000Z'),
  },
  {
    id: '10',
    name: '松本真理',
    email: 'mari.matsumoto@example.com',
    createdAt: new Date('2024-10-01T10:00:00.000Z'),
  },
];

export async function GET() {
  return NextResponse.json(mockUsers);
}
