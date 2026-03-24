/**
 * UserProfile コンポーネントのユニットテスト
 *
 * 前提: Vitest + React Testing Library を使用
 * `src/api/user.ts` の fetchUser をモック化してテストする
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserProfile, UserProfileCard } from "../src/components/UserProfile";
import { UserNotFoundError, ApiError } from "../src/api/user";
import type { User } from "../src/types/user";

// ---------------------------------------------------------------------------
// fetchUser のモック
// ---------------------------------------------------------------------------
vi.mock("../src/api/user", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/api/user")>();
  return {
    ...original,
    fetchUser: vi.fn(),
  };
});

import { fetchUser } from "../src/api/user";
const mockFetchUser = vi.mocked(fetchUser);

// ---------------------------------------------------------------------------
// テストデータ
// ---------------------------------------------------------------------------
const mockUser: User = {
  id: "u_123",
  name: "Akihiro",
  email: "akihiro@example.com",
  avatarUrl: "https://example.com/avatars/u_123.png",
  bio: "TypeScript好きのエンジニアです。",
};

// ---------------------------------------------------------------------------
// UserProfileCard のテスト
// ---------------------------------------------------------------------------
describe("UserProfileCard", () => {
  it("ユーザー名が表示される", () => {
    render(<UserProfileCard user={mockUser} />);
    expect(screen.getByText("Akihiro")).toBeInTheDocument();
  });

  it("メールアドレスが表示される", () => {
    render(<UserProfileCard user={mockUser} />);
    expect(screen.getByText("akihiro@example.com")).toBeInTheDocument();
  });

  it("自己紹介文が表示される", () => {
    render(<UserProfileCard user={mockUser} />);
    expect(screen.getByText("TypeScript好きのエンジニアです。")).toBeInTheDocument();
  });

  it("アバター画像が正しい src で表示される", () => {
    render(<UserProfileCard user={mockUser} />);
    const avatar = screen.getByAltText("Akihiroのアバター") as HTMLImageElement;
    expect(avatar.src).toBe("https://example.com/avatars/u_123.png");
  });

  it("avatarUrl が空の場合、デフォルト画像が表示される", () => {
    const userWithoutAvatar: User = { ...mockUser, avatarUrl: "" };
    render(<UserProfileCard user={userWithoutAvatar} />);
    const avatar = screen.getByAltText("Akihiroのアバター") as HTMLImageElement;
    // デフォルトのSVGデータURLが設定されている
    expect(avatar.src).toContain("data:image/svg+xml");
  });

  it("bio が空の場合、フォールバックメッセージが表示される", () => {
    const userWithoutBio: User = { ...mockUser, bio: "" };
    render(<UserProfileCard user={userWithoutBio} />);
    expect(screen.getByText("自己紹介文はまだ登録されていません。")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UserProfile（ページコンポーネント）のテスト
// ---------------------------------------------------------------------------
describe("UserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("データ取得中はスピナーが表示される", () => {
    // fetchUser が解決しない Promise を返す（ローディング状態を維持）
    mockFetchUser.mockImplementation(() => new Promise(() => {}));

    render(<UserProfile id="u_123" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("正常取得時にユーザー情報が表示される", async () => {
    mockFetchUser.mockResolvedValue(mockUser);

    render(<UserProfile id="u_123" />);

    await waitFor(() => {
      expect(screen.getByText("Akihiro")).toBeInTheDocument();
    });

    expect(screen.getByText("akihiro@example.com")).toBeInTheDocument();
    expect(screen.getByText("TypeScript好きのエンジニアです。")).toBeInTheDocument();
  });

  it("404 エラー時に「ユーザーが見つかりません」が表示される", async () => {
    mockFetchUser.mockRejectedValue(new UserNotFoundError("u_999"));

    render(<UserProfile id="u_999" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText(/ユーザーが見つかりません/)).toBeInTheDocument();
  });

  it("5xx エラー時に汎用エラーメッセージが表示される", async () => {
    mockFetchUser.mockRejectedValue(new ApiError(500, "Internal Server Error"));

    render(<UserProfile id="u_123" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
    expect(screen.getByText(/再度お試しください/)).toBeInTheDocument();
  });

  it("id が変わると再フェッチされる", async () => {
    mockFetchUser
      .mockResolvedValueOnce(mockUser)
      .mockResolvedValueOnce({ ...mockUser, id: "u_456", name: "Sato" });

    const { rerender } = render(<UserProfile id="u_123" />);

    await waitFor(() => {
      expect(screen.getByText("Akihiro")).toBeInTheDocument();
    });

    rerender(<UserProfile id="u_456" />);

    await waitFor(() => {
      expect(screen.getByText("Sato")).toBeInTheDocument();
    });

    expect(mockFetchUser).toHaveBeenCalledTimes(2);
    expect(mockFetchUser).toHaveBeenCalledWith("u_123");
    expect(mockFetchUser).toHaveBeenCalledWith("u_456");
  });
});
