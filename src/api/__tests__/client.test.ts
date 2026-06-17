import { getUser, getUsers, getUserProfile, updateUser, updateUserProfile } from '../client';

// global.fetch をモック化
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({}),
  });
});

describe('getUsers', () => {
  it('正しいエンドポイント(/api/users)にfetchが呼ばれる', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    await getUsers();
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/users');
  });

  it('正常なレスポンスがUser[]として返される', async () => {
    const mockUsers = [
      { id: '1', name: 'Alice', email: 'alice@example.com', createdAt: '2026-01-01', lastLoginAt: '2026-06-12T10:00:00.000Z' },
      { id: '2', name: 'Bob', email: 'bob@example.com', createdAt: '2026-01-02', lastLoginAt: null },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockUsers });
    const result = await getUsers();
    expect(result).toEqual(mockUsers);
  });

  it('ok: falseのときErrorがthrowされる', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(getUsers()).rejects.toThrow('Failed to fetch users: 500');
  });
});

describe('IDバリデーション', () => {
  describe('getUser', () => {
    it('空文字を渡すとエラーがthrowされる', async () => {
      await expect(getUser('')).rejects.toThrow('User ID is required');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('空白のみの文字列を渡すとエラーがthrowされる', async () => {
      await expect(getUser('   ')).rejects.toThrow('User ID is required');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('正常なIDを渡すとfetchが正しいURLで呼び出される', async () => {
      await getUser('user-1');
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/users/user-1');
    });
  });

  describe('getUserProfile', () => {
    it('空文字を渡すとエラーがthrowされる', async () => {
      await expect(getUserProfile('')).rejects.toThrow('User ID is required');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('空文字を渡すとエラーがthrowされる', async () => {
      await expect(updateUser('', { name: 'test' })).rejects.toThrow('User ID is required');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('updateUserProfile', () => {
    it('空文字を渡すとエラーがthrowされる', async () => {
      await expect(updateUserProfile('', { bio: 'test' })).rejects.toThrow('User ID is required');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

describe('getUserProfile - Route Handler 統合観点', () => {
  it('正常なIDを渡すと GET /api/users/[id]/profile エンドポイントを呼び出す', async () => {
    const mockProfile = {
      id: 'current-user-id',
      name: 'サンプルユーザー',
      email: 'sample@example.com',
      bio: null,
      location: null,
      website: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfile,
    });

    const result = await getUserProfile('current-user-id');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/users/current-user-id/profile'
    );
    expect(result.id).toBe('current-user-id');
    expect(result.name).toBe('サンプルユーザー');
    expect(result.email).toBe('sample@example.com');
  });

  it('Route Handler が404を返した場合にエラーをthrowする', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'User not found' }),
    });

    await expect(getUserProfile('non-existent-user')).rejects.toThrow(
      'Failed to fetch profile: 404'
    );
  });

  it('Route Handler が500を返した場合にエラーをthrowする', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });

    await expect(getUserProfile('current-user-id')).rejects.toThrow(
      'Failed to fetch profile: 500'
    );
  });
});

describe('updateUserProfile - Route Handler 統合観点', () => {
  it('正常なIDとデータを渡すと PATCH /api/users/[id]/profile エンドポイントを呼び出す', async () => {
    const updateData = { name: '更新ユーザー', bio: '新しい自己紹介' };
    const mockUpdated = {
      id: 'current-user-id',
      name: '更新ユーザー',
      email: 'sample@example.com',
      bio: '新しい自己紹介',
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUpdated,
    });

    const result = await updateUserProfile('current-user-id', updateData);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/users/current-user-id/profile',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })
    );
    expect(result.name).toBe('更新ユーザー');
    expect(result.bio).toBe('新しい自己紹介');
  });

  it('Route Handler がバリデーションエラー(400)を返した場合にエラーをthrowする', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ errors: [{ field: 'name', message: 'name は必須です' }] }),
    });

    await expect(updateUserProfile('current-user-id', { name: '' })).rejects.toThrow(
      'Failed to update profile: 400'
    );
  });

  it('Route Handler が404を返した場合にエラーをthrowする', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'User not found' }),
    });

    await expect(updateUserProfile('non-existent-user', { name: 'テスト' })).rejects.toThrow(
      'Failed to update profile: 404'
    );
  });
});
