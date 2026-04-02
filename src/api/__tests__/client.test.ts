import { getUser, getUserProfile, updateUser, updateUserProfile } from '../client';

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
