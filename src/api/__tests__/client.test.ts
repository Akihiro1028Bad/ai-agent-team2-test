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
