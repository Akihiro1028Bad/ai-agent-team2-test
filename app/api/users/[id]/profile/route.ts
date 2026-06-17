import { NextRequest, NextResponse } from 'next/server';
import { UserProfile } from '../../../../../src/types/user';

// 静的モックデータストア (メモリ内)
const mockProfiles: Record<string, UserProfile> = {
  'current-user-id': {
    id: 'current-user-id',
    name: 'サンプルユーザー',
    email: 'sample@example.com',
    avatarUrl: undefined,
    bio: undefined,
    location: undefined,
    website: undefined,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
};

interface ValidationError {
  field: string;
  message: string;
}

function validatePatchBody(body: Partial<UserProfile>): ValidationError[] {
  const errors: ValidationError[] = [];

  if ('name' in body) {
    if (!body.name || body.name.trim() === '') {
      errors.push({ field: 'name', message: 'name は必須です' });
    }
  }

  if ('bio' in body && body.bio !== undefined && body.bio !== null) {
    if (body.bio.length > 200) {
      errors.push({ field: 'bio', message: 'bio は200文字以内で入力してください' });
    }
  }

  if ('location' in body && body.location !== undefined && body.location !== null) {
    if (body.location.length > 100) {
      errors.push({ field: 'location', message: 'location は100文字以内で入力してください' });
    }
  }

  if ('website' in body && body.website !== undefined && body.website !== null && body.website !== '') {
    if (!body.website.startsWith('https://')) {
      errors.push({ field: 'website', message: 'website は https:// で始まる必要があります' });
    }
  }

  return errors;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = params;

    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 環境変数 BACKEND_API_URL が設定されている場合は外部 API へプロキシ
    const backendUrl = process.env.BACKEND_API_URL;
    if (backendUrl) {
      const res = await fetch(`${backendUrl}/users/${id}/profile`);
      if (!res.ok) {
        if (res.status === 404) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
      const data = await res.json();
      return NextResponse.json(data);
    }

    // モックデータから返す
    const profile = mockProfiles[id];
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (err) {
    console.error('[GET /api/users/[id]/profile] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = params;

    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const profile = mockProfiles[id];
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let body: Partial<UserProfile>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const errors = validatePatchBody(body);
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // allowlist 方式: 更新可能フィールドのみ適用 (id, email, createdAt は無視)
    const updatedProfile: UserProfile = {
      ...profile,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.bio !== undefined ? { bio: body.bio } : {}),
      ...(body.location !== undefined ? { location: body.location } : {}),
      ...(body.website !== undefined ? { website: body.website } : {}),
    };

    mockProfiles[id] = updatedProfile;

    return NextResponse.json(updatedProfile);
  } catch (err) {
    console.error('[PATCH /api/users/[id]/profile] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
