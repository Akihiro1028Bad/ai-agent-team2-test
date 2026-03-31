'use client';

import React, { useState } from 'react';
import { useUserProfile } from '../../../src/hooks/useUserProfile';
import { ProfileView } from '../../../src/components/ProfileView';
import { ProfileEditForm } from '../../../src/components/ProfileEditForm';
import { UserProfileUpdateInput } from '../../../src/types/user';

interface PageProps {
  params: { id: string };
}

export default function ProfilePage({ params }: PageProps) {
  const { profile, loading, error, updating, updateProfile } = useUserProfile(params.id);
  const [isEditing, setIsEditing] = useState(false);

  if (loading) {
    return <div className="profile-loading">読み込み中...</div>;
  }

  if (error) {
    return <div className="profile-error">エラーが発生しました: {error.message}</div>;
  }

  if (!profile) {
    return <div className="profile-error">ユーザーが見つかりません</div>;
  }

  const handleSave = async (data: UserProfileUpdateInput) => {
    await updateProfile(data);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="profile-page">
        <h1>プロフィール編集</h1>
        <ProfileEditForm
          initialValues={{
            bio: profile.bio,
            location: profile.location,
            website: profile.website,
          }}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
          saving={updating}
        />
      </div>
    );
  }

  return (
    <div className="profile-page">
      <h1>プロフィール</h1>
      <ProfileView profile={profile} onEdit={() => setIsEditing(true)} />
    </div>
  );
}
