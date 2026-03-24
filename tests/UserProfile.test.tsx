/**
 * UserProfile コンポーネントのユニットテスト
 *
 * 前提: Vitest + React Testing Library を使用
 * `src/api/user.ts` の fetchUser をモック化してテストする
 */

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

  it("データ取得中はスピナーと「読み込み中...」ラベルが表示される", () => {
    // fetchUser が解決しない Promise を返す（ローディング状態を維持）
    mockFetchUser.mockImplementation(() => new Promise(() => {}));

    render(<UserProfile id="u_123" />);

    // スピナー要素が存在する
    expect(screen.getByRole("status")).toBeInTheDocument();
    // 視覚的テキストラベルが表示される
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
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

  it("404 エラー時にユーザーフレンドリーなメッセージが表示され、再試行ボタンは表示されない", async () => {
    mockFetchUser.mockRejectedValue(new UserNotFoundError("u_999"));

    render(<UserProfile id="u_999" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText(/ユーザーが見つかりません/)).toBeInTheDocument();
    expect(screen.getByText(/URLを確認してください/)).toBeInTheDocument();
    // 404 は再試行しても無意味なのでボタンは表示しない
    expect(screen.queryByRole("button", { name: "再試行" })).not.toBeInTheDocument();
  });

  it("5xx エラー時に汎用エラーメッセージと再試行ボタンが表示される", async () => {
    mockFetchUser.mockRejectedValue(new ApiError(500, "Internal Server Error"));

    render(<UserProfile id="u_123" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
    expect(screen.getByText(/再度お試しください/)).toBeInTheDocument();
    // 再試行ボタンが表示される
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });

  it("再試行ボタンをクリックするとデータを再取得する", async () => {
    // 1回目はエラー、2回目は成功
    mockFetchUser
      .mockRejectedValueOnce(new ApiError(500, "Internal Server Error"))
      .mockResolvedValueOnce(mockUser);

    render(<UserProfile id="u_123" />);

    // エラー表示を待つ
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
    });

    // 再試行ボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    // 2回目の取得成功後にプロフィールが表示される
    await waitFor(() => {
      expect(screen.getByText("Akihiro")).toBeInTheDocument();
    });

    expect(mockFetchUser).toHaveBeenCalledTimes(2);
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
