import React, { useEffect, useState } from "react";
import { fetchUser, UserNotFoundError } from "../api/user";
import type { User } from "../types/user";

// ---------------------------------------------------------------------------
// フォールバック用のデフォルトアバター（SVG データ URL）
// ---------------------------------------------------------------------------
const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'%3E%3Cpath d='M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z'/%3E%3C/svg%3E";

// ---------------------------------------------------------------------------
// Avatar コンポーネント
// ---------------------------------------------------------------------------
interface AvatarProps {
  src: string;
  alt: string;
}

function Avatar({ src, alt }: AvatarProps) {
  const [imgSrc, setImgSrc] = useState(src || DEFAULT_AVATAR);

  useEffect(() => {
    setImgSrc(src || DEFAULT_AVATAR);
  }, [src]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      onError={() => setImgSrc(DEFAULT_AVATAR)}
      style={{
        width: "96px",
        height: "96px",
        borderRadius: "50%",
        objectFit: "cover",
        border: "2px solid #e2e8f0",
        backgroundColor: "#f1f5f9",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// UserProfileCard コンポーネント
// ---------------------------------------------------------------------------
interface UserProfileCardProps {
  user: User;
}

export function UserProfileCard({ user }: UserProfileCardProps) {
  return (
    <div
      style={{
        maxWidth: "480px",
        width: "100%",
        margin: "0 auto",
        padding: "24px",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      {/* アバター */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
        <Avatar src={user.avatarUrl} alt={`${user.name}のアバター`} />
      </div>

      {/* ユーザー名 */}
      <h2
        style={{
          textAlign: "center",
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "#1e293b",
          margin: "0 0 4px",
        }}
      >
        {user.name}
      </h2>

      {/* メールアドレス */}
      <p
        style={{
          textAlign: "center",
          fontSize: "0.875rem",
          color: "#64748b",
          margin: "0 0 16px",
        }}
      >
        {user.email}
      </p>

      {/* 区切り線 */}
      <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "0 0 16px" }} />

      {/* 自己紹介文 */}
      <p
        style={{
          fontSize: "0.9375rem",
          color: "#334155",
          lineHeight: 1.7,
          margin: 0,
          whiteSpace: "pre-wrap",
        }}
      >
        {user.bio || "自己紹介文はまだ登録されていません。"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserProfile ページコンポーネント（データ取得込み）
// ---------------------------------------------------------------------------
interface UserProfileProps {
  /** 表示するユーザーの ID */
  id: string;
}

type LoadingState = { status: "loading" };
type SuccessState = { status: "success"; user: User };
type ErrorState = { status: "error"; message: string; notFound: boolean };
type State = LoadingState | SuccessState | ErrorState;

export function UserProfile({ id }: UserProfileProps) {
  const [state, setState] = useState<State>({ status: "loading" });

  /** データ取得処理（再試行にも利用） */
  const load = (targetId: string, signal: { cancelled: boolean }) => {
    setState({ status: "loading" });

    fetchUser(targetId)
      .then((user) => {
        if (!signal.cancelled) setState({ status: "success", user });
      })
      .catch((err: unknown) => {
        if (signal.cancelled) return;

        if (err instanceof UserNotFoundError) {
          setState({
            status: "error",
            message: "指定されたユーザーは存在しません。URLを確認してください。",
            notFound: true,
          });
        } else {
          setState({
            status: "error",
            message:
              "データの取得中にエラーが発生しました。しばらく経ってから再度お試しください。",
            notFound: false,
          });
        }
      });
  };

  useEffect(() => {
    const signal = { cancelled: false };
    load(id, signal);
    return () => {
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ローディング中: スピナー + 視覚的テキストラベルを表示
  if (state.status === "loading") {
    return (
      <div
        aria-label="読み込み中"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          padding: "48px",
        }}
      >
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span
          role="status"
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "40px",
            height: "40px",
            border: "4px solid #e2e8f0",
            borderTopColor: "#6366f1",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        {/* スクリーンリーダー向けテキスト + 視覚的ラベル */}
        <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
          読み込み中...
        </span>
      </div>
    );
  }

  // エラー: ユーザーフレンドリーなメッセージ + 再試行ボタンを表示
  if (state.status === "error") {
    return (
      <div
        role="alert"
        style={{
          maxWidth: "480px",
          margin: "48px auto",
          padding: "24px",
          borderRadius: "8px",
          backgroundColor: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#dc2626",
          textAlign: "center",
        }}
      >
        {/* エラー種別の見出し */}
        <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: "1rem" }}>
          {state.notFound ? "ユーザーが見つかりません" : "エラーが発生しました"}
        </p>

        {/* 詳細メッセージ */}
        <p style={{ margin: "0 0 16px", fontSize: "0.875rem", color: "#991b1b" }}>
          {state.message}
        </p>

        {/* 再試行ボタン（404以外の場合のみ表示） */}
        {!state.notFound && (
          <button
            type="button"
            onClick={() => load(id, { cancelled: false })}
            style={{
              display: "inline-block",
              padding: "8px 20px",
              borderRadius: "6px",
              border: "1px solid #fca5a5",
              backgroundColor: "#ffffff",
              color: "#dc2626",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            再試行
          </button>
        )}
      </div>
    );
  }

  // 成功: プロフィールカードを表示
  return (
    <div style={{ padding: "24px 16px" }}>
      <UserProfileCard user={state.user} />
    </div>
  );
}

export default UserProfile;
