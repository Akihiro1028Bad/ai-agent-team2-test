/**
 * Route Handler テスト: GET /api/users/[id]/profile および PATCH /api/users/[id]/profile
 *
 * NextRequest / NextResponse を jest でモックして正常系・異常系を検証する。
 */

// next/server をモック化
jest.mock('next/server', () => {
  const actualNextResponse = {
    json: (body: unknown, init?: ResponseInit) => ({
      _body: body,
      _status: init?.status ?? 200,
      json: async () => body,
      status: init?.status ?? 200,
    }),
  };
  return {
    NextRequest: class MockNextRequest {
      private _body: string;
      constructor(_url: string, init?: { method?: string; body?: string }) {
        this._body = init?.body ?? '';
      }
      async json() {
        return JSON.parse(this._body);
      }
    },
    NextResponse: actualNextResponse,
  };
});

import { GET, PATCH } from './route';
import { NextRequest } from 'next/server';

// テスト用ヘルパー: NextRequest を生成
function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/users/test-id/profile', {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// テスト前にモックプロファイルをリセットするため、元の状態に戻す
// (route.ts の mockProfiles はモジュールスコープで保持されるため、各テスト後に確認)

describe('GET /api/users/[id]/profile', () => {
  it('正常系: 既存ユーザーのプロフィールを返す', async () => {
    const req = makeRequest('GET');
    const res = await GET(req, { params: { id: 'current-user-id' } });

    expect(res._status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('current-user-id');
    expect(data.name).toBe('サンプルユーザー');
    expect(data.email).toBe('sample@example.com');
  });

  it('異常系: 存在しないユーザーIDで404を返す', async () => {
    const req = makeRequest('GET');
    const res = await GET(req, { params: { id: 'non-existent-user' } });

    expect(res._status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('User not found');
  });

  it('異常系: 空のIDで400を返す', async () => {
    const req = makeRequest('GET');
    const res = await GET(req, { params: { id: '' } });

    expect(res._status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('User ID is required');
  });
});

describe('PATCH /api/users/[id]/profile', () => {
  it('正常系: nameを更新できる', async () => {
    const req = makeRequest('PATCH', { name: '更新されたユーザー' });
    const res = await PATCH(req, { params: { id: 'current-user-id' } });

    expect(res._status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('更新されたユーザー');
    expect(data.email).toBe('sample@example.com'); // email は変更不可
  });

  it('正常系: bio / location / website を更新できる', async () => {
    const req = makeRequest('PATCH', {
      bio: '自己紹介文',
      location: '東京',
      website: 'https://example.com',
    });
    const res = await PATCH(req, { params: { id: 'current-user-id' } });

    expect(res._status).toBe(200);
    const data = await res.json();
    expect(data.bio).toBe('自己紹介文');
    expect(data.location).toBe('東京');
    expect(data.website).toBe('https://example.com');
  });

  it('セキュリティ: id / email / createdAt は更新されない (allowlist)', async () => {
    const req = makeRequest('PATCH', {
      id: 'hacked-id',
      email: 'hacked@example.com',
      createdAt: '2000-01-01T00:00:00.000Z',
      name: '正当な更新',
    });
    const res = await PATCH(req, { params: { id: 'current-user-id' } });

    expect(res._status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('current-user-id');
    expect(data.email).toBe('sample@example.com');
    expect(data.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('バリデーション: name が空文字の場合は400を返す', async () => {
    const req = makeRequest('PATCH', { name: '' });
    const res = await PATCH(req, { params: { id: 'current-user-id' } });

    expect(res._status).toBe(400);
    const data = await res.json();
    expect(data.errors).toBeDefined();
    expect(data.errors[0].field).toBe('name');
  });

  it('バリデーション: bio が200文字超の場合は400を返す', async () => {
    const req = makeRequest('PATCH', { bio: 'a'.repeat(201) });
    const res = await PATCH(req, { params: { id: 'current-user-id' } });

    expect(res._status).toBe(400);
    const data = await res.json();
    expect(data.errors[0].field).toBe('bio');
  });

  it('バリデーション: location が100文字超の場合は400を返す', async () => {
    const req = makeRequest('PATCH', { location: 'a'.repeat(101) });
    const res = await PATCH(req, { params: { id: 'current-user-id' } });

    expect(res._status).toBe(400);
    const data = await res.json();
    expect(data.errors[0].field).toBe('location');
  });

  it('バリデーション: website が https:// で始まらない場合は400を返す', async () => {
    const req = makeRequest('PATCH', { website: 'http://example.com' });
    const res = await PATCH(req, { params: { id: 'current-user-id' } });

    expect(res._status).toBe(400);
    const data = await res.json();
    expect(data.errors[0].field).toBe('website');
  });

  it('異常系: 存在しないユーザーIDで404を返す', async () => {
    const req = makeRequest('PATCH', { name: 'テスト' });
    const res = await PATCH(req, { params: { id: 'non-existent-user' } });

    expect(res._status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('User not found');
  });

  it('異常系: 空のIDで400を返す', async () => {
    const req = makeRequest('PATCH', { name: 'テスト' });
    const res = await PATCH(req, { params: { id: '' } });

    expect(res._status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('User ID is required');
  });

  it('境界値: bio がちょうど200文字は許容される', async () => {
    const req = makeRequest('PATCH', { bio: 'a'.repeat(200) });
    const res = await PATCH(req, { params: { id: 'current-user-id' } });

    expect(res._status).toBe(200);
  });

  it('境界値: location がちょうど100文字は許容される', async () => {
    const req = makeRequest('PATCH', { location: 'a'.repeat(100) });
    const res = await PATCH(req, { params: { id: 'current-user-id' } });

    expect(res._status).toBe(200);
  });
});
