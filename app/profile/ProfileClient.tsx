'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useUserProfile } from '../../src/hooks/useUserProfile';
import { UserProfileView } from '../../src/components/UserProfileView';
import { ProfileEditForm } from '../../src/components/ProfileEditForm';
import { UserProfile } from '../../src/types/user';

interface ProfileClientProps {
  userId: string;
  onRetry?: () => void;
}

export default function ProfileClient({ userId, onRetry }: ProfileClientProps) {
  const { profile, loading, error, updateProfile } = useUserProfile(userId);
  const [isEditing, setIsEditing] = useState(false);

  const handleRetry = onRetry ?? (() => window.location.reload());

  if (loading) {
    return <div role="status">読み込み中...</div>;
  }

  if (error) {
    return (
      <div>
        <div>エラーが発生しました: {error.message}</div>
        <button onClick={handleRetry}>再試行</button>
      </div>
    );
  }

  if (!profile) {
    return <div>プロフィールが見つかりません</div>;
  }

  const handleSave = async (data: Partial<UserProfile>) => {
    await updateProfile(data);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <ProfileEditForm
        profile={profile}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div>
      <UserProfileView
        profile={profile}
        editable={true}
        onEdit={() => setIsEditing(true)}
      />
      <Link href="/settings/notifications">通知設定</Link>
    </div>
  );
}
